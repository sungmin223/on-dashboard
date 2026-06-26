/* Validate.jsx — 데이터 검증(경량 1차판). 누락/매칭오류/좌표없음/오래된정보 점검.
   8단계에서 더 확장. 지금도 실데이터 기준으로 실제 점검 결과를 보여준다(정직성). */
import React, { useMemo } from "react";
import { useSales, Card, EmptyState, ReasonNote } from "./ui.jsx";
import { freshnessWarn } from "../../lib/salesData.js";

export default function Validate() {
  const { data, err } = useSales();
  const checks = useMemo(() => {
    if (!data) return null;
    const accounts = data.accounts || [], deliveries = data.deliveries || [],
      pairings = data.pairings || [], products = data.productMaster?.products || [];
    const accIds = new Set(accounts.map((a) => a.account_id));
    const prodIds = new Set(products.map((p) => p.product_id));

    const noGeo = accounts.filter((a) => !a.위도 || !a.경도).map((a) => a.account_id + " " + a.거래처명);
    const dupAcc = dups(accounts.map((a) => a.거래처명));
    const orphanAccInDel = [...new Set(deliveries.filter((d) => !accIds.has(d.account_id)).map((d) => d.account_id))];
    const orphanProdInDel = [...new Set(deliveries.filter((d) => !prodIds.has(d.product_id)).map((d) => d.product_id))];
    const badPrice = deliveries.filter((d) => d.공급가 !== "" && (Number(d.공급가) <= 0 || isNaN(Number(d.공급가)))).map((d) => d.order_id);
    const badDate = deliveries.filter((d) => d.출고일 && isNaN(new Date(d.출고일))).map((d) => d.order_id);
    const staleP = pairings.filter((p) => { const w = freshnessWarn(p.확인일); return w.tone === "bad"; }).map((p) => p.pairing_id);
    const needMatch = pairings.filter((p) => String(p.신동와인제품여부).toUpperCase() !== "Y" && p.와인명).length;

    return { noGeo, dupAcc, orphanAccInDel, orphanProdInDel, badPrice, badDate, staleP, needMatch };
  }, [data]);

  if (err) return <div className="s-wrap"><Card>{err}</Card></div>;
  if (!data) return <div className="s-wrap"><Card>데이터 불러오는 중…</Card></div>;
  const c = checks;

  const rows = [
    ["주소·좌표 없는 거래처 (동선 제외)", c.noGeo],
    ["거래처명 중복", c.dupAcc],
    ["납품이력의 거래처가 거래처마스터에 없음", c.orphanAccInDel],
    ["납품이력의 제품이 제품마스터에 없음", c.orphanProdInDel],
    ["비정상 공급가(0/숫자아님)", c.badPrice],
    ["출고일 형식 오류", c.badDate],
    ["90일+ 미확인 페어링", c.staleP],
  ];

  return (
    <div className="s-wrap">
      <div className="s-head">
        <h2>데이터 검증</h2>
        <span className="s-sub">현재 로드된 데이터 기준 실시간 점검</span>
      </div>
      <ReasonNote>임의 추정·허위 데이터를 막기 위한 점검입니다. 항목이 0이면 정상, 그 외는 확인 대상입니다.</ReasonNote>

      <div className="home-grid">
        {rows.map(([label, list]) => (
          <Card key={label} title={label} right={<span className={"badge " + (list.length ? "b-bad" : "b-ok")}>{list.length}건</span>}>
            {!list.length ? <EmptyState title="이상 없음" /> : (
              <ul className="list">
                {list.slice(0, 12).map((x, i) => <li key={i}><div className="li-main mono">{x}</div></li>)}
                {list.length > 12 && <li className="muted">…외 {list.length - 12}건</li>}
              </ul>
            )}
          </Card>
        ))}
        <Card title="신동 제품 매칭 필요(페어링)" right={<span className="badge b-warn">{c.needMatch}건</span>}>
          <p className="muted" style={{ margin: 0 }}>신동제품여부 ≠ Y 인 페어링 와인. 4단계 페어링 모듈에서 “매칭 후보”로 제시(자동 확정 안 함).</p>
        </Card>
      </div>
    </div>
  );
}

function dups(arr) {
  const seen = {}, out = [];
  for (const v of arr) { if (!v) continue; seen[v] = (seen[v] || 0) + 1; }
  for (const k in seen) if (seen[k] > 1) out.push(`${k} (${seen[k]}건)`);
  return out;
}
