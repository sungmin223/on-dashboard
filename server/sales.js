/* sales.js — 영업 인텔리전스 시드 로더(서버).
   data/sales-seed.json(거래처/납품/페어링/지역선호 + 제품마스터)을 읽어 제공한다.
   파일이 없으면 빈 구조 반환 → 화면에서 "데이터 업로드 필요"로 처리. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEED = path.resolve(__dirname, "..", "data", "sales-seed.json");

const EMPTY = {
  _meta: { generatedAt: null, note: "시드 없음 — npm run build:sales 후 사용", counts: {} },
  accounts: [], deliveries: [], pairings: [], regions: [],
  productMaster: { meta: {}, products: [] },
};

let DB = EMPTY;
export function loadSales() {
  try {
    if (fs.existsSync(SEED)) DB = JSON.parse(fs.readFileSync(SEED, "utf8"));
    else DB = EMPTY;
  } catch (e) {
    console.warn("[sales] 시드 파싱 실패:", e.message);
    DB = EMPTY;
  }
  return DB;
}
export function getSales() { return DB; }
loadSales();
