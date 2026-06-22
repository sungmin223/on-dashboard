/* =========================================================
   import-data.mjs — 신동와인 재고표 엑셀 → data/inventory.json
   사용: npm run import-data            (data/source/ 최신 파일 또는 기본 경로)
         npm run import-data -- "<경로>" (특정 엑셀 지정)
   엑셀 교체 후 재실행만으로 데이터가 갱신됩니다.
   ⚠ 원본 엑셀/생성 JSON 은 .gitignore (내부 단가 보호).
   ========================================================= */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import XLSXpkg from "xlsx";
const XLSX = XLSXpkg.readFile ? XLSXpkg : (XLSXpkg.default || XLSXpkg);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SRC_DIR = path.join(ROOT, "data", "source");
const OUT = path.join(ROOT, "data", "inventory.json");
const DEFAULT_DESKTOP = "C:\\Users\\sungm\\OneDrive\\바탕 화면\\6월 22일 신동와인 재고표.XLS";
const SHEET = "재고";

/* 원본 22개 컬럼 헤더 → 구조화 키 매핑 */
const COLMAP = {
  "국가": "country", "지역": "region", "공급사": "supplier",
  "품목코드": "code", "상품명": "name", "한글명": "nameKo",
  "W/R구분": "type", "빈티지": "vintage", "용량": "volume",
  "본입수": "perCase", "현재고": "stockTotal", "신동재고": "stockSindong",
  "이천재고": "stockIcheon", "예정수량": "incoming",
  "공급가": "priceSupply", "도매가": "priceWholesale",
  "W.S": "ws", "R.P": "rp", "B.H": "bh", "D.C": "dc", "J.S": "js",
  "Barcode": "barcode",
};
const NUMERIC = new Set([
  "perCase", "stockTotal", "stockSindong", "stockIcheon", "incoming",
  "priceSupply", "priceWholesale", "ws", "rp", "bh", "dc", "js",
]);

function pickSource() {
  const arg = process.argv[2];
  if (arg) {
    if (!fs.existsSync(arg)) { console.error("[import-data] 지정한 파일이 없습니다:", arg); process.exit(1); }
    return arg;
  }
  // data/source/ 에서 최신 .xls/.xlsx 선택
  if (fs.existsSync(SRC_DIR)) {
    const cands = fs.readdirSync(SRC_DIR)
      .filter((f) => /\.xlsx?$/i.test(f))
      .map((f) => ({ f, t: fs.statSync(path.join(SRC_DIR, f)).mtimeMs }))
      .sort((a, b) => b.t - a.t);
    if (cands.length) return path.join(SRC_DIR, cands[0].f);
  }
  if (fs.existsSync(DEFAULT_DESKTOP)) return DEFAULT_DESKTOP;
  console.error("[import-data] 소스 엑셀을 찾지 못했습니다.\n  - data/source/ 에 재고표(.xls/.xlsx)를 넣거나\n  - npm run import-data -- \"<경로>\" 로 지정하세요.");
  process.exit(1);
}

const toNum = (v) => {
  if (v == null || v === "") return null;
  if (typeof v === "number") return Math.round(v);
  const n = Number(String(v).replace(/[, ]/g, ""));
  return Number.isFinite(n) ? Math.round(n) : null;
};
const toStr = (v) => (v == null ? "" : String(v).trim());

function main() {
  const src = pickSource();
  console.log("[import-data] 소스:", src);
  const wb = XLSX.readFile(src, { cellDates: false });
  if (!wb.SheetNames.includes(SHEET)) {
    console.error(`[import-data] '${SHEET}' 시트를 찾을 수 없습니다. 시트 목록:`, wb.SheetNames);
    process.exit(1);
  }
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[SHEET], { header: 1, blankrows: false, defval: "" });
  if (!rows.length) { console.error("[import-data] 빈 시트입니다."); process.exit(1); }

  const header = rows[0].map((h) => toStr(h));
  const idx = {};
  header.forEach((h, i) => { if (COLMAP[h]) idx[COLMAP[h]] = i; });
  if (idx.code == null || idx.name == null) {
    console.error("[import-data] 헤더 매핑 실패. 읽은 헤더:", header);
    process.exit(1);
  }

  const items = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const get = (k) => (idx[k] != null ? row[idx[k]] : "");
    const code = toStr(get("code"));
    const name = toStr(get("name"));
    const nameKo = toStr(get("nameKo"));
    if (!code && !name && !nameKo) continue;           // 완전 빈 행 skip
    const item = { id: items.length + 1 };
    for (const key of Object.values(COLMAP)) {
      item[key] = NUMERIC.has(key) ? toNum(get(key)) : toStr(get(key));
    }
    items.push(item);
  }

  const out = {
    meta: {
      count: items.length,
      sheet: SHEET,
      source: path.basename(src),
      generatedAt: new Date().toISOString(),
    },
    items,
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out), "utf8");
  const withStock = items.filter((i) => (i.stockTotal || 0) > 0).length;
  console.log(`[import-data] 완료 → data/inventory.json (${items.length}개 SKU, 재고보유 ${withStock}개)`);
}

main();
