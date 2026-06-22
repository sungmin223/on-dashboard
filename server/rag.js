/* rag.js — 질의에 관련된 재고 행을 검색해 컨텍스트로 구성 (서버 측) */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.resolve(__dirname, "..", "data", "inventory.json");

let DB = { meta: {}, items: [] };
export function loadInventory() {
  if (fs.existsSync(DATA)) {
    DB = JSON.parse(fs.readFileSync(DATA, "utf8"));
  } else {
    DB = { meta: { count: 0 }, items: [] };
  }
  return DB;
}
export function getInventory() { return DB; }
loadInventory();

const norm = (s) => String(s || "").toLowerCase().replace(/['"’`()]/g, "").replace(/\s+/g, " ").trim();

/* 질의에서 토큰 추출 (영/한/숫자) */
function tokenize(q) {
  const n = norm(q);
  const tokens = n.match(/[a-z0-9]+|[가-힣]{2,}/g) || [];
  return [...new Set(tokens)].filter((t) => t.length >= 2);
}

/* 한 행이 질의에 얼마나 맞는지 점수화 */
function scoreItem(item, tokens, rawQ) {
  const code = norm(item.code);
  const barcode = norm(item.barcode);
  const hay = norm([item.code, item.name, item.nameKo, item.region, item.supplier, item.country, item.type, item.vintage].join(" "));
  let score = 0;
  // 코드/바코드 정확·부분 일치 강한 가중
  if (code && rawQ.includes(code)) score += 50;
  if (barcode && rawQ.includes(barcode)) score += 60;
  for (const t of tokens) {
    if (!t) continue;
    if (code === t) score += 40;
    else if (code.includes(t)) score += 10;
    if (barcode.includes(t)) score += 12;
    if (hay.includes(t)) score += 4;
    // 빈티지 숫자 매칭
    if (/^\d{4}$/.test(t) && String(item.vintage) === t) score += 8;
  }
  return score;
}

export function retrieve(query, limit = 25) {
  const items = DB.items || [];
  const rawQ = norm(query);
  const tokens = tokenize(query);
  if (!tokens.length && !rawQ) return [];
  const scored = items
    .map((it) => ({ it, s: scoreItem(it, tokens, rawQ) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => compact(x.it));
  return scored;
}

/* 컨텍스트로 보낼 때 필드 정리(노이즈 축소) */
function compact(it) {
  return {
    code: it.code, barcode: it.barcode, name: it.name, nameKo: it.nameKo,
    country: it.country, region: it.region, supplier: it.supplier,
    type: it.type, vintage: it.vintage, volume: it.volume, perCase: it.perCase,
    stockTotal: it.stockTotal, stockSindong: it.stockSindong, stockIcheon: it.stockIcheon,
    incoming: it.incoming,
    priceSupply: it.priceSupply, priceWholesale: it.priceWholesale, rp: it.rp,
  };
}
