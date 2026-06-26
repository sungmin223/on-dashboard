/* RoutePlan.jsx — 외근 방문 동선 최적화.
   좌표 보유 거래처를 선택 → Haversine 최근접 + 우선순위 가중으로 순서 제안.
   외부 지도 API 없이 동작(구글/카카오 길찾기 링크 생성). 좌표 없는 거래처는 제외 사유 표기. */
import React, { useMemo, useState } from "react";
import { useSales, Card, EmptyState, ReasonNote, V } from "./ui.jsx";
import DataToolbar from "./DataToolbar.jsx";
import { toPoint, planRoute, googleMapsDirUrl, kakaoMapUrl } from "../../lib/geo.js";
import { getVisitState, setVisit, VISIT_RESULTS } from "../../lib/salesData.js";

const STARTS = {
  "서울시청": { lat: 37.5663, lon: 126.9779 },
  "강남(회사 예시)": { lat: 37.4979, lon: 127.0276 },
  "부산시청": { lat: 35.1798, lon: 129.0750 },
};

export default function RoutePlan() {
  const { data, err } = useSales();
  const [sel, setSel] = useState({});            // account_id → true
  const [dwell, setDwell] = useState({});        // account_id → 분
  const [prio, setPrio] = useState({});          // account_id → 필수/가능/후순위
  const [startKey, setStartKey] = useState("서울시청");
  const [startPt, setStartPt] = useState(STARTS["서울시청"]);
  const [startMin, setStartMin] = useState("10:00");
  const [endMin, setEndMin] = useState("18:00");
  const [visit, setVisitState] = useState(getVisitState);
  const [planned, setPlanned] = useState(null);

  if (err) return <div className="s-wrap"><Card>{err}</Card></div>;
  if (!data) return <div className="s-wrap"><Card>영업 데이터 불러오는 중…</Card></div>;

  const accounts = data.accounts || [];
  const geoAccounts = accounts.map((a) => ({ ...a, point: toPoint(a) }));
  const noGeo = geoAccounts.filter((a) => !a.point);

  const hm = (s) => { const m = String(s).match(/(\d{1,2}):(\d{2})/); return m ? +m[1] * 60 + +m[2] : null; };

  function useCurrentLocation() {
    if (!navigator.geolocation) return alert("이 브라우저는 위치를 지원하지 않습니다.");
    navigator.geolocation.getCurrentPosition(
      (p) => { setStartPt({ lat: p.coords.latitude, lon: p.coords.longitude }); setStartKey("현재 위치"); },
      () => alert("위치 권한이 거부되었습니다.")
    );
  }

  function run() {
    const stops = geoAccounts
      .filter((a) => sel[a.account_id])
      .map((a) => ({
        account_id: a.account_id, 거래처명: a.거래처명, point: a.point,
        dwell: Number(dwell[a.account_id]) || 30,
        priority: prio[a.account_id] || "가능",
        중요도: a.중요도, 운영시간: a.운영시간, 지역: [a.지역1, a.지역2].filter(Boolean).join(" "),
      }));
    // 선택했지만 좌표 없는 것도 제외 목록에 포함
    const selectedNoGeo = noGeo.filter((a) => sel[a.account_id])
      .map((a) => ({ account_id: a.account_id, 거래처명: a.거래처명, reason: "주소/좌표 없음 → 거리 계산 불가" }));
    const res = planRoute(startPt, stops, { startMin: hm(startMin), endMin: hm(endMin) });
    res.excluded = [...res.excluded, ...selectedNoGeo];
    setPlanned(res);
  }

  const selCount = Object.values(sel).filter(Boolean).length;

  function saveVisit(accId, patch) {
    setVisit(accId, patch);
    setVisitState(getVisitState());
  }

  return (
    <div className="s-wrap">
      <div className="s-head">
        <h2>외근 방문 동선 최적화</h2>
        <span className="s-sub">좌표 보유 거래처 {geoAccounts.length - noGeo.length} · 좌표없음 {noGeo.length}</span>
      </div>
      <DataToolbar dataset="accounts" rows={accounts} onReload={() => location.reload()} />

      <Card title="① 조건 설정">
        <div className="s-filters">
          <label>출발지
            <select value={startKey} onChange={(e) => { setStartKey(e.target.value); if (STARTS[e.target.value]) setStartPt(STARTS[e.target.value]); }}>
              {Object.keys(STARTS).map((k) => <option key={k} value={k}>{k}</option>)}
              {startKey === "현재 위치" && <option value="현재 위치">현재 위치</option>}
            </select>
          </label>
          <button className="clear" onClick={useCurrentLocation}>📍 현재 위치 사용</button>
          <label>방문 시작
            <input type="time" value={startMin} onChange={(e) => setStartMin(e.target.value)} />
          </label>
          <label>방문 종료
            <input type="time" value={endMin} onChange={(e) => setEndMin(e.target.value)} />
          </label>
          <button className="run-btn" onClick={run} disabled={!selCount}>🗺 동선 계산 ({selCount})</button>
        </div>
        <ReasonNote>점심 12:00~13:00 자동 회피, 평균 이동속도 18km/h(도심) 가정. 운영시간 밖 도착은 비추천 표시.</ReasonNote>
      </Card>

      <Card title="② 방문 거래처 선택" right={<span className="muted">{selCount}곳 선택</span>}>
        <div className="scroll">
          <table className="s-tbl">
            <thead><tr><th>방문</th><th>거래처</th><th>지역</th><th>중요도</th><th>운영시간</th><th>체류(분)</th><th>우선순위</th></tr></thead>
            <tbody>
              {geoAccounts.map((a) => {
                const disabled = !a.point;
                return (
                  <tr key={a.account_id} className={disabled ? "row-dim" : ""}>
                    <td><input type="checkbox" disabled={disabled} checked={!!sel[a.account_id]}
                      onChange={(e) => setSel((s) => ({ ...s, [a.account_id]: e.target.checked }))} /></td>
                    <td className="name">{a.거래처명}{disabled && <span className="need-check">주소 필요</span>}</td>
                    <td><V>{[a.지역1, a.지역2].filter(Boolean).join(" ")}</V></td>
                    <td>{a.중요도 || "—"}</td>
                    <td>{a.운영시간 === "확인필요" ? <span className="need-check">확인 필요</span> : (a.운영시간 || "—")}</td>
                    <td><input className="mini-in" type="number" min="10" step="10" disabled={disabled}
                      value={dwell[a.account_id] ?? 30} onChange={(e) => setDwell((s) => ({ ...s, [a.account_id]: e.target.value }))} /></td>
                    <td>
                      <select className="mini-in" disabled={disabled} value={prio[a.account_id] || "가능"}
                        onChange={(e) => setPrio((s) => ({ ...s, [a.account_id]: e.target.value }))}>
                        <option value="필수">필수</option><option value="가능">가능하면</option><option value="후순위">후순위</option>
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {planned && (
        <Card title="③ 추천 방문 순서"
          right={planned.order.length ? <a className="run-btn" href={googleMapsDirUrl(startPt, planned.order)} target="_blank" rel="noreferrer">구글지도 길찾기 ↗</a> : null}>
          {!planned.order.length ? (
            <EmptyState title="계산할 좌표 보유 거래처가 없습니다" hint="좌표가 있는 거래처를 선택하세요." />
          ) : (
            <>
              <div className="mini-kpis">
                <MiniKpi label="방문 가능" val={`${planned.summary.count}곳`} />
                <MiniKpi label="총 이동거리" val={`${planned.summary.totalDist} km`} />
                <MiniKpi label="총 이동시간" val={`${planned.summary.totalTravel}분`} />
                <MiniKpi label="종료 예상" val={planned.summary.endClock} tone={planned.summary.withinTime ? "ok" : "warn"} />
              </div>
              {!planned.summary.withinTime && <div className="warn-line">⚠ 방문 종료시간({endMin})을 초과합니다. 거래처 수/체류시간을 줄이세요.</div>}

              <div className="scroll">
                <table className="s-tbl">
                  <thead><tr><th>#</th><th>거래처</th><th>도착</th><th>출발</th><th className="num">이동</th><th className="num">누적</th><th>지도</th><th>방문결과</th><th>메모</th></tr></thead>
                  <tbody>
                    {planned.order.map((o, i) => {
                      const vs = visit[o.account_id] || {};
                      return (
                        <tr key={o.account_id}>
                          <td className="num">{i + 1}</td>
                          <td className="name">{o.거래처명}
                            {o.offHours && <span className="need-check">운영시간 밖</span>}
                            {o.over && <span className="need-check">시간초과</span>}
                          </td>
                          <td>{o.arrive}</td>
                          <td>{o.leave}</td>
                          <td className="num">{o.legDist}km·{o.travelMin}분</td>
                          <td className="num">{o.cumDist}km</td>
                          <td><a className="linklike" href={kakaoMapUrl(o.거래처명, o.point)} target="_blank" rel="noreferrer">카카오</a></td>
                          <td>
                            <select className="mini-in" value={vs.result || "미방문"} onChange={(e) => saveVisit(o.account_id, { result: e.target.value })}>
                              {VISIT_RESULTS.map((r) => <option key={r} value={r}>{r}</option>)}
                            </select>
                          </td>
                          <td><input className="mini-in wide" placeholder="방문 메모/다음 예정" defaultValue={vs.memo || ""}
                            onBlur={(e) => saveVisit(o.account_id, { memo: e.target.value })} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {planned.excluded.length > 0 && (
                <div className="excluded">
                  <b>제외된 거래처 ({planned.excluded.length})</b>
                  <ul className="list">
                    {planned.excluded.map((e) => <li key={e.account_id}><div className="li-sub">{e.거래처명} — {e.reason}</div></li>)}
                  </ul>
                </div>
              )}
              <ReasonNote>
                추천 근거: 출발지에서 <b>최근접 이웃</b>으로 순서를 잡되, <b>필수(+3)·중요도A(+1.5km 환산)</b> 가중으로 핵심 거래처를 앞당깁니다.
                거리=Haversine 직선거리(실주행거리와 차이 가능). 방문결과/메모는 이 브라우저에 저장됩니다.
              </ReasonNote>
            </>
          )}
        </Card>
      )}
    </div>
  );
}

function MiniKpi({ label, val, tone }) {
  return <div className={"mini-kpi" + (tone ? " mk-" + tone : "")}><div className="mk-val">{val}</div><div className="mk-label">{label}</div></div>;
}
