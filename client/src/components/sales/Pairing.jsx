/* Pairing.jsx — 거래처별 와인 페어링/글라스 가격 리스트 + 신동 매칭/대체추천.
   ⚠ 신동제품여부는 데이터값을 우선 신뢰하고, 미표기/경쟁 와인은 '매칭 후보'를 제시(자동 확정 금지). */
import React, { useMemo, useState } from "react";
import { useSales, Card, EmptyState, SourceBadge, V, ReasonNote } from "./ui.jsx";
import DataToolbar from "./DataToolbar.jsx";
import { freshnessWarn, won } from "../../lib/salesData.js";
import { pairingInsights } from "../../lib/recommend.js";
import { matchCandidates } from "../../lib/productMaster.js";

export default function Pairing() {
  const { data, err } = useSales();
  const [acc, setAcc] = useState("");

  const pairings = data?.pairings || [];
  const products = data?.productMaster?.products || [];

  // 거래처 목록(페어링 보유)
  const accs = useMemo(() => {
    const m = new Map();
    pairings.forEach((p) => { if (!m.has(p.account_id)) m.set(p.account_id, p.거래처명); });
    return [...m.entries()];
  }, [pairings]);

  const current = acc || (accs[0]?.[0] ?? "");
  const rows = pairings.filter((p) => p.account_id === current);

  // 메뉴(메뉴명+glass_type)별 그룹
  const menus = useMemo(() => {
    const m = new Map();
    rows.forEach((r) => {
      const key = `${r.메뉴명}|${r.glass_type}`;
      if (!m.has(key)) m.set(key, { 메뉴명: r.메뉴명, glass_type: r.glass_type, 가격: r.가격, items: [] });
      m.get(key).items.push(r);
    });
    return [...m.values()].map((g) => ({ ...g, items: g.items.sort((a, b) => Number(a.wine_order) - Number(b.wine_order)) }));
  }, [rows]);

  const insights = useMemo(() => pairingInsights(rows, products), [rows, products]);

  if (err) return <div className="s-wrap"><Card>{err}</Card></div>;
  if (!data) return <div className="s-wrap"><Card>영업 데이터 불러오는 중…</Card></div>;

  return (
    <div className="s-wrap">
      <div className="s-head">
        <h2>페어링 / 글라스 가격 리스트</h2>
        <span className="s-sub">거래처 {accs.length} · 페어링 항목 {pairings.length}</span>
      </div>
      <DataToolbar dataset="pairings" rows={pairings} onReload={() => location.reload()} />

      <Card>
        <div className="s-filters">
          <label>거래처
            <select value={current} onChange={(e) => setAcc(e.target.value)}>
              {accs.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
          </label>
        </div>
      </Card>

      {!rows.length ? (
        <EmptyState title="이 거래처의 페어링 데이터가 없습니다" hint="페어링리스트.csv 업로드 또는 거래처를 변경하세요." />
      ) : (
        <>
          {/* 인사이트 */}
          <Card title="📊 구성 분석 & 영업 제안" right={<span className={"badge " + (insights.pct >= 50 ? "b-real" : "b-warn")}>신동 {insights.pct}%</span>}>
            <div className="mini-kpis">
              <MiniKpi label="총 구성" val={`${insights.total}종`} />
              <MiniKpi label="신동 포함" val={`${insights.sindong}종`} tone="ok" />
              <MiniKpi label="경쟁 수입사" val={`${insights.comp}종`} tone={insights.comp ? "warn" : ""} />
            </div>
            <div className="dist-row">
              <Dist title="국가 분포" map={insights.byCountry} />
              <Dist title="카테고리 분포" map={insights.byCat} />
            </div>
            <div className="memo-box">
              <div className="memo-label">자동 영업 제안 메모</div>
              <div className="memo-text">{insights.memo}</div>
            </div>
            <ReasonNote>비중·분포는 표시된 페어링 데이터 기준. 메모는 규칙 기반 초안이며 현장 확인 후 사용하세요.</ReasonNote>
          </Card>

          {/* 대체 추천 */}
          {insights.swaps.length > 0 && (
            <Card title="🔁 신동 대체 추천 (경쟁 → 신동)">
              <div className="scroll">
                <table className="s-tbl">
                  <thead><tr><th>경쟁 와인</th><th>수입사</th><th>지역</th><th>신동 대체 후보(재고 우선)</th><th>근거</th></tr></thead>
                  <tbody>
                    {insights.swaps.map((s, i) => (
                      <tr key={i}>
                        <td className="name">{s.wine}</td>
                        <td><V>{s.importer === "확인필요" ? "" : s.importer}</V></td>
                        <td><V>{s.region}</V></td>
                        <td>{s.alt.items.map((p) => <span key={p.product_id} className="alt-chip">{p.와인명} <small>재고 {won(p.재고수량)}·{won(p.공급가)}원</small></span>)}</td>
                        <td className="muted">{s.alt.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* 메뉴판(5G/7G 비교) */}
          {menus.map((g, gi) => (
            <Card key={gi} title={`${g.메뉴명} · ${g.glass_type}`} right={<b>{won(g.가격)}원</b>}>
              <div className="scroll">
                <table className="s-tbl">
                  <thead>
                    <tr><th>순서</th><th>와인</th><th>생산자</th><th>국가/지역</th><th>품종</th><th>빈티지</th><th>신동</th><th>확인</th></tr>
                  </thead>
                  <tbody>
                    {g.items.map((r) => {
                      const isSindong = String(r.신동와인제품여부).toUpperCase() === "Y";
                      const w = freshnessWarn(r.확인일);
                      const cand = !isSindong && r.와인명 ? matchCandidates(r.와인명, r.생산자, products, 1)[0] : null;
                      return (
                        <tr key={r.pairing_id}>
                          <td className="num">{r.wine_order}</td>
                          <td className="name">{r.와인명}
                            {cand && cand.score >= 0.4 && (
                              <div className="cand">매칭 후보: {cand.product.와인명} <span className="muted">({Math.round(cand.score * 100)}%·확인필요)</span></div>
                            )}
                          </td>
                          <td><V>{r.생산자 === "확인필요" ? "" : r.생산자}</V></td>
                          <td><V>{[r.국가, r.지역].filter((x) => x && x !== "확인필요").join(" ")}</V></td>
                          <td><V>{r.품종 === "확인필요" ? "" : r.품종}</V></td>
                          <td><V>{r.빈티지 === "확인필요" ? "" : r.빈티지}</V></td>
                          <td>{isSindong ? <span className="badge b-real">신동</span> : <span className="badge b-warn">{r.수입사 && r.수입사 !== "확인필요" ? r.수입사 : "경쟁/미상"}</span>}</td>
                          <td><span className={"st st-" + w.tone}>{w.label}</span> <SourceBadge row={r} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          ))}
        </>
      )}
    </div>
  );
}

function MiniKpi({ label, val, tone }) {
  return <div className={"mini-kpi" + (tone ? " mk-" + tone : "")}><div className="mk-val">{val}</div><div className="mk-label">{label}</div></div>;
}
function Dist({ title, map }) {
  const entries = Object.entries(map).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((s, e) => s + e[1], 0) || 1;
  return (
    <div className="dist">
      <div className="dist-title">{title}</div>
      {!entries.length ? <span className="muted">데이터 없음</span> : entries.map(([k, v]) => (
        <div key={k} className="dist-bar">
          <span className="db-label">{k}</span>
          <span className="db-track"><span className="db-fill" style={{ width: `${(v / total) * 100}%` }} /></span>
          <span className="db-val">{v}</span>
        </div>
      ))}
    </div>
  );
}
