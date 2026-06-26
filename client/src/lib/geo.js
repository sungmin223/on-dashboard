/* geo.js — 동선 최적화(외부 지도 API 없이 동작).
   - Haversine 거리, 최근접 이웃(greedy) 순서, 도착/출발 시각 스케줄, 지도 링크.
   ⚠ 좌표 없는 거래처는 계산 제외(사유 반환). 가능 시간 초과 시 경고. */

const R = 6371; // km
export function haversine(a, b) {
  if (!a || !b || a.lat == null || b.lat == null) return null;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLon = toRad(b.lon - a.lon);
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

const num = (v) => { if (v === "" || v == null) return null; const n = Number(v); return isNaN(n) ? null : n; };

/* 거래처 → 좌표 점 */
export function toPoint(acc) {
  const lat = num(acc.위도), lon = num(acc.경도);
  if (lat == null || lon == null) return null;
  return { lat, lon };
}

const impRank = { A: 3, B: 2, C: 1, D: 0 };
const prioRank = { 필수: 3, 가능: 2, 후순위: 1 };

/* 분→"HH:MM" */
function fmt(min) {
  min = Math.round(min);
  const h = Math.floor(min / 60), m = min % 60;   // 24시 초과는 그대로 노출(초과를 숨기지 않음)
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
function parseHM(s) {
  const m = String(s || "").match(/(\d{1,2}):(\d{2})/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/* 최근접 이웃 순서 + 스케줄.
   stops: [{account_id, 거래처명, point, dwell, priority, 중요도, 운영시간}]
   opts: { startPoint, startMin, endMin, speedKmh=18, lunch=[12:00..13:00] } */
export function planRoute(start, stops, opts = {}) {
  const speed = opts.speedKmh || 18;
  const startMin = opts.startMin ?? 10 * 60;
  const endMin = opts.endMin ?? 18 * 60;
  const lunchA = opts.lunchStart ?? 12 * 60, lunchB = opts.lunchEnd ?? 13 * 60;

  const withGeo = stops.filter((s) => s.point);
  const excluded = stops.filter((s) => !s.point).map((s) => ({ ...s, reason: "주소/좌표 없음 → 거리 계산 불가" }));

  // greedy nearest neighbor, 단 '필수' 우선순위는 가중(가까우면서 중요한 곳 먼저)
  const remaining = [...withGeo];
  const order = [];
  let cur = start;
  let clock = startMin;
  let totalDist = 0;

  while (remaining.length) {
    // 점수 = 거리(작을수록 좋음) - 우선순위/중요도 보너스(거리 환산 km 차감)
    let best = null, bestScore = Infinity;
    for (const s of remaining) {
      const d = haversine(cur, s.point) ?? Infinity;
      const bonus = (prioRank[s.priority] || 0) * 3 + (impRank[s.중요도] || 0) * 1.5; // km 환산 가중
      const score = d - bonus;
      if (score < bestScore) { bestScore = score; best = s; }
    }
    const legDist = haversine(cur, best.point) ?? 0;
    let travel = (legDist / speed) * 60;
    let arrive = clock + travel;
    // 점심시간 겹치면 통과(도착이 점심구간이면 점심 끝으로 미룸)
    if (arrive >= lunchA && arrive < lunchB) arrive = lunchB;

    const opHours = parseRange(best.운영시간);
    const offHours = opHours && (arrive < opHours[0] || arrive > opHours[1]);
    const over = arrive + (best.dwell || 30) > endMin;

    totalDist += legDist;
    order.push({
      ...best,
      legDist: round1(legDist),
      travelMin: Math.round(travel),
      arrive: fmt(arrive),
      leave: fmt(arrive + (best.dwell || 30)),
      offHours, over,
      cumDist: round1(totalDist),
    });
    clock = arrive + (best.dwell || 30);
    cur = best.point;
    remaining.splice(remaining.indexOf(best), 1);
  }

  const totalTravel = order.reduce((s, o) => s + o.travelMin, 0);
  const totalDwell = order.reduce((s, o) => s + (o.dwell || 30), 0);
  const overflow = order.filter((o) => o.over).length;

  return {
    order, excluded,
    summary: {
      count: order.length,
      totalDist: round1(totalDist),
      totalTravel, totalDwell,
      endClock: fmt(clock),
      withinTime: clock <= endMin,
      overflow,
    },
  };
}

function parseRange(s) {
  const m = String(s || "").match(/(\d{1,2}:\d{2})\s*[~\-]\s*(\d{1,2}:\d{2})/);
  if (!m) return null;
  return [parseHM(m[1]), parseHM(m[2])];
}
function round1(n) { return Math.round(n * 10) / 10; }

/* 순서대로 구글지도 길찾기 URL (API키 불필요) */
export function googleMapsDirUrl(start, order) {
  const pts = [start, ...order.map((o) => o.point)].filter(Boolean).map((p) => `${p.lat},${p.lon}`);
  return "https://www.google.com/maps/dir/" + pts.join("/");
}
/* 카카오맵 길찾기(좌표 기반) — 단순 to 링크는 출발-도착만 지원하므로 첫/끝 사용 */
export function kakaoMapUrl(name, point) {
  if (!point) return null;
  return `https://map.kakao.com/link/to/${encodeURIComponent(name)},${point.lat},${point.lon}`;
}

export { fmt as fmtMin, parseHM };
