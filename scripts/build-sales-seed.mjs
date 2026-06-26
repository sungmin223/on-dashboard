/* build-sales-seed.mjs — data/samples/*.csv + inventory.json 을
   하나의 시드(data/sales-seed.json)로 합친다.
   - 거래처/납품/페어링/지역선호 CSV 파싱
   - inventory.json(932 SKU)을 "제품마스터"로 래핑(포트폴리오 카테고리·키워드 부여)
   사용: npm run build:sales
   주의: 샘플 데이터는 _sample=true 로 표시되어 화면에서 '샘플' 배지로 노출된다. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const REAL = path.join(ROOT, "data", "real");        // 운영 실데이터(최우선)
const SAMPLES = path.join(ROOT, "data", "samples");  // 샘플(폴백)
const INV = path.join(ROOT, "data", "inventory.json");
const OUT = path.join(ROOT, "data", "sales-seed.json");

/* --- 최소 CSV 파서(따옴표/쉼표 처리) --- */
function parseCSV(text) {
  const rows = [];
  let row = [], field = "", q = false;
  text = text.replace(/^﻿/, "");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') q = false;
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c === "\r") { /* skip */ }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => String(c).trim() !== ""));
}
function toObjects(rows) {
  if (!rows.length) return [];
  const head = rows[0].map((h) => h.trim());
  return rows.slice(1).map((r) => {
    const o = {};
    head.forEach((h, i) => { o[h] = (r[i] ?? "").trim(); });
    return o;
  });
}
/* 우선순위: data/real/<name>.csv(운영) → data/samples/<name>.csv(업로드) → *.sample.csv(샘플).
   헤더만 있고 데이터 행이 0개면 건너뛰고 다음 후보로 폴백(빈 운영파일이 샘플을 가리지 않게). */
function readCSV(name) {
  const candidates = [
    { f: path.join(REAL, name + ".csv"), source: "운영", sample: false },
    { f: path.join(SAMPLES, name + ".csv"), source: "업로드", sample: false },
    { f: path.join(SAMPLES, name + ".sample.csv"), source: "샘플", sample: true },
  ];
  for (const c of candidates) {
    if (!fs.existsSync(c.f)) continue;
    const objs = toObjects(parseCSV(fs.readFileSync(c.f, "utf8")));
    if (!objs.length) continue;
    return { rows: objs.map((o) => ({ ...o, _sample: c.sample, _source: c.source })), source: c.source };
  }
  return { rows: [], source: "없음" };
}

/* --- 제품마스터: inventory → 포트폴리오 카테고리/키워드 --- */
const CAT_RULES = [
  [/CHAMPAGNE/i, "샴페인"],
  [/CHABLIS|BOURGOGNE|BURGUNDY|MEURSAULT|GEVREY|POMMARD|COTE\s?D'?OR|NUITS/i, "부르고뉴"],
  [/ST\.?-?\s?ESTEPHE|PAUILLAC|MARGAUX|MEDOC|ST\.?-?\s?JULIEN|POMEROL|ST\.?-?\s?EMILION|LISTRAC|BORDEAUX/i, "보르도"],
  [/PIEMONTE|BAROLO|BARBARESCO/i, "피에몬테"],
  [/TOSCANA|CHIANTI|BRUNELLO|BOLGHERI/i, "토스카나"],
  [/NAPA|SONOMA|CALIFORNIA/i, "캘리포니아"],
  [/MENDOZA/i, "멘도사(아르헨티나)"],
  [/MARLBOROUGH|HAWKE/i, "뉴질랜드"],
  [/RHONE|RHÔNE/i, "론"],
  [/DOURO|PORTO/i, "포르투갈"],
  [/TOKAJI/i, "토카이"],
];
function deriveCategory(it) {
  const hay = `${it.region || ""} ${it.country || ""} ${it.name || ""}`;
  for (const [re, cat] of CAT_RULES) if (re.test(hay)) return cat;
  return it.country ? cap(it.country) : "기타";
}
function cap(s) { s = String(s).toLowerCase(); return s.charAt(0).toUpperCase() + s.slice(1); }
function keywords(it, cat) {
  const toks = `${it.nameKo || ""} ${it.name || ""} ${it.region || ""} ${it.country || ""} ${it.type || ""} ${cat}`
    .toLowerCase().match(/[a-z0-9]+|[가-힣]{2,}/g) || [];
  return [...new Set(toks)].filter((t) => t.length >= 2);
}

function buildProductMaster() {
  const inv = JSON.parse(fs.readFileSync(INV, "utf8"));
  const items = inv.items || [];
  const products = items.map((it) => {
    const cat = deriveCategory(it);
    return {
      product_id: it.code || `INV${it.id}`,
      브랜드명: it.supplier || "",          // supplier는 그룹/수입계열 → 브랜드 보강은 업로드 권장
      생산자명: "",
      와인명: it.nameKo || it.name,
      와인명영문: it.name,
      국가: it.country || "",
      지역: it.region || "",
      타입: it.type || "",
      품종: "",
      빈티지: it.vintage || "",
      용량: it.volume || "",
      공급가: it.priceSupply ?? null,
      도매가: it.priceWholesale ?? null,
      재고수량: it.stockTotal ?? 0,
      포트폴리오카테고리: cat,
      _카테고리추정: true,                   // 카테고리는 region/country 기반 자동 추정값
      키워드: keywords(it, cat),
    };
  });
  return { meta: inv.meta || {}, products };
}

function main() {
  const a = readCSV("거래처마스터");
  const d = readCSV("납품이력");
  const p = readCSV("페어링리스트");
  const r = readCSV("지역선호도");
  const productMaster = buildProductMaster();

  const sources = { accounts: a.source, deliveries: d.source, pairings: p.source, regions: r.source };
  const anySample = Object.values(sources).some((s) => s === "샘플");
  const allReal = Object.values(sources).every((s) => s === "운영" || s === "업로드");

  const seed = {
    _meta: {
      generatedAt: new Date().toISOString(),
      sources,                                   // 데이터셋별 출처(운영/업로드/샘플/없음)
      anySample, allReal,
      note: anySample
        ? "일부/전체가 샘플 데이터입니다. data/real/<파일>.csv 로 교체 후 npm run build:sales 하세요."
        : "운영 데이터(실파일) 기반 시드입니다. 제품마스터는 inventory.json(실재고).",
      counts: {
        accounts: a.rows.length, deliveries: d.rows.length,
        pairings: p.rows.length, regions: r.rows.length,
        products: productMaster.products.length,
      },
    },
    accounts: a.rows, deliveries: d.rows, pairings: p.rows, regions: r.rows,
    productMaster,
  };
  fs.writeFileSync(OUT, JSON.stringify(seed));
  console.log("[build:sales] →", OUT);
  console.log("   출처:", JSON.stringify(sources));
  console.log("   건수:", JSON.stringify(seed._meta.counts));
}
main();
