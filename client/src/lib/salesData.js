/* salesData.js — 영업 인텔리전스 데이터 레이어(클라이언트).
   1) /api/sales 시드 로드(서버, 인증)
   2) 사용자가 업로드한 CSV 오버라이드(localStorage)를 데이터셋별로 덮어쓰기
   3) 공통 파생값(입점상태·미확인 경과일 등) 헬퍼 제공
   ⚠ 추측 금지: 빈 값은 그대로 비워 두고 화면에서 "확인 필요"로 노출한다. */
import { apiFetch } from "./api.js";
import { csvToObjects } from "./csv.js";

export const DATASETS = ["accounts", "deliveries", "pairings", "regions"];
const LS_PREFIX = "on_sales_override_";   // + dataset → CSV text

let _cache = null;

/* localStorage 의 업로드 오버라이드를 객체배열로 */
function readOverride(name) {
  try {
    const raw = localStorage.getItem(LS_PREFIX + name);
    if (!raw) return null;
    const { objects } = csvToObjects(raw);
    return objects.map((o) => ({ ...o, _sample: false, _source: "업로드" }));
  } catch { return null; }
}

export function saveOverride(name, csvText) {
  localStorage.setItem(LS_PREFIX + name, csvText);
  _cache = null;   // 다음 로드시 재구성
}
export function clearOverride(name) {
  localStorage.removeItem(LS_PREFIX + name);
  _cache = null;
}
export function overrideInfo() {
  const info = {};
  DATASETS.forEach((n) => { info[n] = Boolean(localStorage.getItem(LS_PREFIX + n)); });
  return info;
}

export async function loadSales(force = false) {
  if (_cache && !force) return _cache;
  let seed = { accounts: [], deliveries: [], pairings: [], regions: [], productMaster: { products: [] }, _meta: {} };
  try {
    const r = await apiFetch("/api/sales");
    if (r.ok) seed = await r.json();
  } catch { /* 네트워크 실패 → 빈 시드 + 오버라이드만 */ }

  const out = { ...seed };
  for (const name of DATASETS) {
    const ov = readOverride(name);
    if (ov) out[name] = ov;          // 업로드가 있으면 샘플 대체
  }
  out._overrides = overrideInfo();
  _cache = out;
  return out;
}

/* ---------- 파생값 헬퍼 ---------- */
export function daysBetween(dateStr, base = new Date()) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d)) return null;
  return Math.floor((base - d) / 86400000);
}

/* 마지막 출고일 기준 입점상태 (PRD 정의) */
export function deliveryStatus(lastDateStr, base = new Date()) {
  const days = daysBetween(lastDateStr, base);
  if (days == null) return { label: "이력 없음", tone: "muted", days: null };
  if (days <= 90) return { label: "현재 납품중", tone: "ok", days };
  if (days <= 180) return { label: "최근 3~6개월", tone: "warn", days };
  return { label: "6개월+ 미출고", tone: "bad", days };
}

/* 페어링 확인일 경과 경고 (30/60/90일) */
export function freshnessWarn(checkedDateStr, base = new Date()) {
  const days = daysBetween(checkedDateStr, base);
  if (days == null) return { label: "확인일 없음", tone: "muted", days: null };
  if (days >= 90) return { label: `${days}일 경과·재확인 시급`, tone: "bad", days };
  if (days >= 60) return { label: `${days}일 경과·재확인 필요`, tone: "warn", days };
  if (days >= 30) return { label: `${days}일 경과`, tone: "warn", days };
  return { label: `${days}일 전 확인`, tone: "ok", days };
}

export const won = (n) => (n == null || n === "" || isNaN(Number(n)) ? "—" : Number(n).toLocaleString("en-US"));

/* ---------- 방문 결과/메모 (localStorage, 거래처 단위) ---------- */
const VISIT_KEY = "on_visit_state";
export const VISIT_RESULTS = ["미방문", "방문완료", "담당자부재", "견적요청", "샘플요청", "재방문필요", "발주가능성높음"];
export function getVisitState() {
  try { return JSON.parse(localStorage.getItem(VISIT_KEY) || "{}"); } catch { return {}; }
}
export function setVisit(accountId, patch) {
  const all = getVisitState();
  all[accountId] = { ...(all[accountId] || {}), ...patch, updatedAt: new Date().toISOString() };
  localStorage.setItem(VISIT_KEY, JSON.stringify(all));
  return all[accountId];
}
