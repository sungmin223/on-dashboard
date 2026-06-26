/* Home.jsx — 영업 인텔리전스 홈.
   외근 전 한눈에: 방문 후보·미확인 페어링·매출감소 거래처·지역 추천 요약.
   모든 카드는 데이터 출처(샘플/업로드)와 근거를 함께 노출한다. */
import React, { useMemo } from "react";
import { useSales, Card, EmptyState, SourceBadge, ConfBadge, V, ReasonNote } from "./ui.jsx";
import { deliveryStatus, freshnessWarn, won } from "../../lib/salesData.js";

export default function Home({ onGo }) {
  const { data, err } = useSales();

  const summary = useMemo(() => {
    if (!data) return null;
    const accounts = data.accounts || [];
    const deliveries = data.deliveries || [];
    const pairings = data.pairings || [];
    const regions = data.regions || [];

    // 거래처별 마지막 출고일
    const lastByAcc = {};
    for (const d of deliveries) {
      if (!lastByAcc[d.account_id] || d.출고일 > lastByAcc[d.account_id]) lastByAcc[d.account_id] = d.출고일;
    }
    const dormant = accounts
      .map((a) => ({ a, st: deliveryStatus(lastByAcc[a.account_id]) }))
      .filter((x) => x.st.tone === "bad" || x.a.거래상태 === "최근매출감소");

    const noGeo = accounts.filter((a) => !a.위도 || !a.경도);
    const proposal = accounts.filter((a) => a.거래상태 === "제안진행");

    // 오래된 페어링(확인일 30일+)
    const staleP = pairings
      .map((p) => ({ p, w: freshnessWarn(p.확인일) }))
      .filter((x) => x.w.tone === "warn" || x.w.tone === "bad");
    // 페어링 중 신동 미포함(경쟁) 비중
    const compN = pairings.filter((p) => String(p.신동와인제품여부).toUpperCase() !== "Y").length;

    return { accounts, deliveries, pairings, regions, dormant, noGeo, proposal, staleP, compN };
  }, [data]);

  if (err) return <div className="s-wrap"><Card>{err}</Card></div>;
  if (!data) return <div className="s-wrap"><Card>영업 데이터 불러오는 중…</Card></div>;
  const s = summary;
  const sample = (data._meta?.note || "").includes("샘플");

  return (
    <div className="s-wrap">
      <div className="s-head">
        <h2>영업 인텔리전스 홈</h2>
        <span className="s-sub">
          {sample && <span className="badge b-sample">샘플 데이터</span>}
          거래처 {s.accounts.length} · 납품 {s.deliveries.length} · 페어링 {s.pairings.length} · 지역선호 {s.regions.length}
        </span>
      </div>

      <ReasonNote>
        거래처·납품·페어링·지역선호는 현재 <b>샘플</b>입니다. 각 모듈 상단의 업로드로 실제 CSV를 올리면 즉시 교체됩니다.
        제품/재고는 실데이터(932 SKU)입니다.
      </ReasonNote>

      {/* KPI */}
      <div className="kpi-row">
        <Kpi label="등록 거래처" val={s.accounts.length} sub="샘플" go={() => onGo?.("route")} />
        <Kpi label="집중관리(미출고·매출감소)" val={s.dormant.length} sub="6개월+ 또는 감소" tone="warn" go={() => onGo?.("portfolio")} />
        <Kpi label="재확인 필요 페어링" val={s.staleP.length} sub="확인일 30일+" tone="warn" go={() => onGo?.("pairing")} />
        <Kpi label="신규 제안 거래처" val={s.proposal.length} sub="제안진행" go={() => onGo?.("route")} />
      </div>

      <div className="home-grid">
        {/* 집중 관리 거래처 */}
        <Card title="🔴 이번 주 집중 관리 거래처" right={<span className="muted">미출고·매출감소</span>}>
          {!s.dormant.length ? <EmptyState title="해당 거래처 없음" /> : (
            <ul className="list">
              {s.dormant.map(({ a, st }) => (
                <li key={a.account_id}>
                  <div className="li-main">{a.거래처명} <SourceBadge row={a} /></div>
                  <div className="li-sub">
                    {[a.지역1, a.지역2].filter(Boolean).join(" ")} · {a.담당자 || "담당 미정"} ·
                    <span className={"st st-" + st.tone}> {a.거래상태 === "최근매출감소" ? "최근 매출감소" : st.label}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <ReasonNote>근거: 납품이력 마지막 출고일 + 거래처 상태(최근매출감소).</ReasonNote>
        </Card>

        {/* 재확인 필요 페어링 */}
        <Card title="🍷 재확인 필요 페어링" right={<button className="linklike" onClick={() => onGo?.("pairing")}>페어링 모듈 →</button>}>
          {!s.staleP.length ? <EmptyState title="30일 이상 미확인 항목 없음" /> : (
            <ul className="list">
              {s.staleP.slice(0, 6).map(({ p, w }) => (
                <li key={p.pairing_id}>
                  <div className="li-main">{p.거래처명} · {p.메뉴명} <SourceBadge row={p} /></div>
                  <div className="li-sub">{p.glass_type} · {p.와인명} · <span className={"st st-" + w.tone}>{w.label}</span></div>
                </li>
              ))}
            </ul>
          )}
          <ReasonNote>기준: 확인일 30/60/90일 경과. 가격·구성와인 변동 가능 → 재방문 시 확인.</ReasonNote>
        </Card>

        {/* 주소/좌표 미확보 */}
        <Card title="📍 주소·좌표 미확보(동선 제외)" right={<span className="muted">{s.noGeo.length}건</span>}>
          {!s.noGeo.length ? <EmptyState title="모든 거래처 좌표 보유" /> : (
            <ul className="list">
              {s.noGeo.map((a) => (
                <li key={a.account_id}>
                  <div className="li-main">{a.거래처명} <span className="need-check">주소 필요</span></div>
                  <div className="li-sub"><V>{[a.지역1, a.지역2].filter(Boolean).join(" ")}</V> · 동선 최적화에서 제외됨</div>
                </li>
              ))}
            </ul>
          )}
          <ReasonNote>좌표(위도/경도)가 없으면 거리 계산이 불가하여 동선에서 제외합니다.</ReasonNote>
        </Card>

        {/* 지역 추천 요약 */}
        <Card title="🗺 지역별 추천 카테고리" right={<button className="linklike" onClick={() => onGo?.("region")}>지역선호 →</button>}>
          {!s.regions.length ? <EmptyState title="지역선호 데이터 없음" /> : (
            <ul className="list">
              {s.regions.slice(0, 6).map((r) => (
                <li key={r.region_id}>
                  <div className="li-main">{r.세부지역} · {r.업장타입} <ConfBadge grade={r.신뢰도} /></div>
                  <div className="li-sub">추천: <V>{r.추천포트폴리오}</V> · 출처 {r.데이터출처 || "—"}</div>
                </li>
              ))}
            </ul>
          )}
          <ReasonNote>신뢰도 A(실매출)~D(추정/샘플). 현재 대부분 C/D(샘플) → 확정적 판단 금지.</ReasonNote>
        </Card>
      </div>
    </div>
  );
}

function Kpi({ label, val, sub, tone, go }) {
  return (
    <button className={"kpi" + (tone ? " kpi-" + tone : "")} onClick={go}>
      <div className="kpi-val">{won(val)}</div>
      <div className="kpi-label">{label}</div>
      <div className="kpi-sub">{sub}</div>
    </button>
  );
}
