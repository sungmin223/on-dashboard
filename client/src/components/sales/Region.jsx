/* Region.jsx — 지역별 소비자·레스토랑 선호 카테고리 분석 + 신동 포트폴리오 매칭.
   ⚠ 신뢰도 A~D·데이터 출처를 항상 노출. 대부분 C/D(샘플)이므로 확정적 시장단정 금지. */
import React, { useMemo, useState } from "react";
import { useSales, Card, EmptyState, SourceBadge, ConfBadge, V, ReasonNote } from "./ui.jsx";
import DataToolbar from "./DataToolbar.jsx";
import { won } from "../../lib/salesData.js";
import { regionMatch } from "../../lib/recommend.js";

export default function Region() {
  const { data, err } = useSales();
  const [region, setRegion] = useState("");
  const [type, setType] = useState("");
  const [conf, setConf] = useState("");

  const regions = data?.regions || [];
  const products = data?.productMaster?.products || [];

  const areas = [...new Set(regions.map((r) => r.대권역).filter(Boolean))];
  const types = [...new Set(regions.map((r) => r.업장타입).filter(Boolean))];

  const filtered = useMemo(() => regions.filter((r) => {
    if (region && r.대권역 !== region) return false;
    if (type && r.업장타입 !== type) return false;
    if (conf && String(r.신뢰도).toUpperCase() !== conf) return false;
    return true;
  }), [regions, region, type, conf]);

  // 신뢰도 분포
  const confDist = useMemo(() => {
    const m = { A: 0, B: 0, C: 0, D: 0 };
    regions.forEach((r) => { const g = String(r.신뢰도).toUpperCase(); if (m[g] != null) m[g]++; });
    return m;
  }, [regions]);

  if (err) return <div className="s-wrap"><Card>{err}</Card></div>;
  if (!data) return <div className="s-wrap"><Card>영업 데이터 불러오는 중…</Card></div>;

  return (
    <div className="s-wrap">
      <div className="s-head">
        <h2>지역별 선호 카테고리 분석</h2>
        <span className="s-sub">지역×업장 {regions.length}건</span>
      </div>
      <DataToolbar dataset="regions" rows={regions} onReload={() => location.reload()} />

      <ReasonNote>
        신뢰도 <b>A</b>(실매출/납품) · <b>B</b>(거래처 와인리스트) · <b>C</b>(담당자 코멘트) · <b>D</b>(추정/샘플).
        현재 분포 — A:{confDist.A} B:{confDist.B} C:{confDist.C} D:{confDist.D}. C/D 항목은 참고용이며 확정 판단에 쓰지 마세요.
      </ReasonNote>

      <Card>
        <div className="s-filters">
          <label>대권역
            <select value={region} onChange={(e) => setRegion(e.target.value)}>
              <option value="">전체</option>{areas.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </label>
          <label>업장타입
            <select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">전체</option>{types.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label>신뢰도
            <select value={conf} onChange={(e) => setConf(e.target.value)}>
              <option value="">전체</option>{["A", "B", "C", "D"].map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
        </div>
      </Card>

      {!filtered.length ? <EmptyState title="조건에 맞는 지역 데이터가 없습니다" /> : (
        <div className="home-grid">
          {filtered.map((r) => {
            const match = regionMatch(r, products, 4);
            return (
              <Card key={r.region_id}
                title={`${r.세부지역} · ${r.업장타입}`}
                right={<><ConfBadge grade={r.신뢰도} /> <SourceBadge row={r} /></>}>
                <div className="pref-grid">
                  <Pref k="선호 국가" v={r.선호국가} />
                  <Pref k="선호 지역" v={r.선호지역} />
                  <Pref k="선호 스타일" v={r.선호스타일} />
                  <Pref k="선호 품종" v={r.선호품종} />
                  <Pref k="가격대" v={r.선호가격대} />
                  <Pref k="추천 포트폴리오" v={r.추천포트폴리오} />
                </div>
                {r.담당자코멘트 && <div className="memo-text" style={{ marginTop: 6 }}>💬 {r.담당자코멘트}</div>}
                <div className="match-box">
                  <div className="memo-label">신동 보유 매칭 ({match.basis || "추정 불가"})</div>
                  {match.items.length ? (
                    <div className="chip-row">
                      {match.items.map((p) => (
                        <span key={p.product_id} className="alt-chip">{p.와인명} <small>{p.포트폴리오카테고리}·재고 {won(p.재고수량)}</small></span>
                      ))}
                    </div>
                  ) : <span className="muted">{match.reason || "매칭 후보 없음 — 데이터 보강 필요"}</span>}
                </div>
                <div className="src-line">출처: <V>{r.데이터출처}</V></div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Pref({ k, v }) {
  return <div className="pref"><span className="pref-k">{k}</span><span className="pref-v"><V>{v === "확인필요" ? "" : v}</V></span></div>;
}
