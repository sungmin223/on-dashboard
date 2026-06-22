/* =========================================================
   server/demoAnswer.js — 규칙 기반 더미 AI (API 키 없이 동작)
   실제 ANTHROPIC_API_KEY 가 없을 때 /api/chat 가 사용하는 폴백 엔진.
   - 실재고(inventory.json)만을 근거로 답변 → 추정·창작 없음
   - 의도(코드조회/빈티지/Top N/가격필터)별 규칙 응답
   - 견적/제안가가 도매가 미만이면 "⚠ 내부 승인 필요" 표시
   - 한국어 존댓말. 데이터에 없으면 "데이터에 없음" 명시
   ========================================================= */

const won = (n) => (n == null || n === "" ? null : Number(n).toLocaleString("ko-KR") + "원");
const bottles = (n) => (n == null ? "0병" : Number(n).toLocaleString("ko-KR") + "병");
const norm = (s) => String(s || "").toLowerCase().replace(/['"’`()]/g, "").replace(/\s+/g, " ").trim();

/* "10만원" / "10만" / "100000원" → 100000 */
function parseWon(q) {
  let m = q.match(/(\d+(?:\.\d+)?)\s*만/);
  if (m) return Math.round(parseFloat(m[1]) * 10000);
  m = q.match(/(\d{4,})\s*원?/);
  if (m) return parseInt(m[1], 10);
  return null;
}

/* 한국어/영어 타입 키워드 → 데이터 type 값 */
function detectType(q) {
  const n = norm(q);
  if (/레드|red/.test(n)) return { key: "Red", label: "레드" };
  if (/화이트|white/.test(n)) return { key: "White", label: "화이트" };
  if (/로제|rose|rosé/.test(n)) return { key: "rose", label: "로제" };
  return null;
}

function detectWarehouse(q) {
  const n = norm(q);
  if (/신동/.test(n)) return { field: "stockSindong", label: "신동창고" };
  if (/이천/.test(n)) return { field: "stockIcheon", label: "이천창고" };
  return { field: "stockTotal", label: "전체" };
}

function topN(q, def = 5) {
  const m = q.match(/top\s*(\d+)|상위\s*(\d+)|(\d+)\s*개|(\d+)\s*종/i);
  if (m) return parseInt(m[1] || m[2] || m[3] || m[4], 10);
  return def;
}

const label = (it) => `${it.nameKo || it.name || "(이름없음)"} (${it.code})`;

/* 한 품목 상세 카드 */
function itemDetail(it) {
  const lines = [];
  lines.push(`📦 ${label(it)}`);
  if (it.name && it.nameKo) lines.push(`· 영문명: ${it.name}`);
  const meta = [it.country, it.region, it.type, it.vintage, it.volume].filter(Boolean).join(" · ");
  if (meta) lines.push(`· ${meta}`);
  lines.push(`· 재고: 총 ${bottles(it.stockTotal)} (신동 ${bottles(it.stockSindong)} / 이천 ${bottles(it.stockIcheon)})` +
    (it.incoming ? ` · 입고예정 ${bottles(it.incoming)}` : ""));
  const sup = won(it.priceSupply), whole = won(it.priceWholesale), rp = won(it.rp);
  lines.push(`· 공급가: ${sup || "데이터에 없음"}` +
    `  |  도매가: ${whole || "미정 — 단가 확인 필요"}` +
    (rp ? `  |  소비자가(R.P): ${rp}` : ""));
  return lines.join("\n");
}

/* 목록 표(코드·이름·재고·공급가) */
function listTable(items, stockField = "stockTotal") {
  return items.map((it, i) =>
    `${i + 1}. ${label(it)} — 재고 ${bottles(it[stockField])} · 공급가 ${won(it.priceSupply) || "미정"}`
  ).join("\n");
}

/* 견적 톤 안내(도매가 미만 승인 필요) — 질의에 '견적/제안/할인' 의도가 있을 때 */
function quoteNote(items, q) {
  if (!/견적|제안|할인|단가|얼마에/.test(norm(q))) return "";
  const noWhole = items.filter((it) => it.priceWholesale == null);
  if (noWhole.length) {
    return `\n\n⚠ ${noWhole.map((it) => label(it)).slice(0, 5).join(", ")} 은(는) 도매가가 데이터에 없습니다(도매가 미정 — 단가 확인 필요). 제안가 산정 전 단가 확인이 필요합니다.`;
  }
  return `\n\n※ 제안가가 도매가(priceWholesale) 미만일 경우 반드시 "⚠ 내부 승인 필요" 처리하셔야 합니다.`;
}

const FOOTER = "\n\n— (데모) 규칙 기반 응답입니다. 실제 AI 분석을 사용하려면 서버에 ANTHROPIC_API_KEY 를 설정하세요.";

/* code(영문+숫자) 또는 barcode(8자리+ 숫자) 토큰 추출 */
function extractCodes(q) {
  const codes = (q.match(/\b[A-Za-z]{2,}\d{2,}\b/g) || []).map((s) => s.toUpperCase());
  const bars = q.match(/\b\d{8,}\b/g) || [];
  return { codes, bars };
}

export function demoAnswer(query, db) {
  // 집계/소계 행(코드 없음, '합 계' 등)은 품목이 아니므로 분석에서 제외
  const items = (db.items || []).filter((it) => String(it.code || "").trim() && !/합\s*계|소\s*계|총\s*계/.test(String(it.name || "")));
  const q = String(query || "");
  const nq = norm(q);
  if (!items.length) return { answer: "재고 데이터가 비어 있습니다. `npm run import-data` 를 먼저 실행하세요." + FOOTER, used: 0 };

  // 1) 코드/바코드 직접 조회
  const { codes, bars } = extractCodes(q);
  if (codes.length || bars.length) {
    const hits = items.filter((it) =>
      codes.includes(String(it.code || "").toUpperCase()) || bars.includes(String(it.barcode || "")));
    if (hits.length) {
      return { answer: hits.slice(0, 5).map(itemDetail).join("\n\n") + quoteNote(hits, q) + FOOTER, used: hits.length };
    }
    return { answer: `요청하신 코드(${[...codes, ...bars].join(", ")})에 해당하는 품목은 데이터에 없음. 코드/바코드를 확인해 주세요.` + FOOTER, used: 0 };
  }

  const type = detectType(q);
  const wh = detectWarehouse(q);
  const threshold = parseWon(q);
  const priceField = /도매/.test(nq) ? "priceWholesale" : "priceSupply";
  const priceLabel = priceField === "priceWholesale" ? "도매가" : "공급가";

  // 2) 가격 조건 추천 ("10만원 이하 공급가 화이트와인 추천")
  if (threshold != null && /이하|미만|under|이내|아래/.test(nq)) {
    let pool = items.filter((it) => it[priceField] != null && it[priceField] <= threshold && it.stockTotal > 0);
    if (type) pool = pool.filter((it) => it.type === type.key);
    pool.sort((a, b) => (b.stockTotal || 0) - (a.stockTotal || 0));
    const n = topN(q, 8);
    if (!pool.length) return { answer: `${type ? type.label + "와인 중 " : ""}${priceLabel} ${won(threshold)} 이하이면서 재고가 있는 품목은 데이터에 없음.` + FOOTER, used: 0 };
    return {
      answer: `${type ? type.label + "와인 " : ""}${priceLabel} ${won(threshold)} 이하 · 재고 보유 품목 (재고순 ${Math.min(n, pool.length)}종):\n` +
        listTable(pool.slice(0, n)) + quoteNote(pool.slice(0, n), q) + FOOTER,
      used: pool.length,
    };
  }

  // 3) Top N 재고 랭킹 ("신동창고에 재고 많은 레드와인 top 5")
  if (/많은|top|상위|랭킹|순위|베스트/.test(nq)) {
    let pool = items.slice();
    if (type) pool = pool.filter((it) => it.type === type.key);
    pool = pool.filter((it) => (it[wh.field] || 0) > 0).sort((a, b) => (b[wh.field] || 0) - (a[wh.field] || 0));
    const n = topN(q, 5);
    if (!pool.length) return { answer: `${wh.label}에 재고가 있는 ${type ? type.label + "와인" : "품목"}은 데이터에 없음.` + FOOTER, used: 0 };
    return {
      answer: `${wh.label} 재고 많은 ${type ? type.label + "와인 " : ""}Top ${Math.min(n, pool.length)}:\n` +
        listTable(pool.slice(0, n), wh.field) + FOOTER,
      used: pool.length,
    };
  }

  // 4) 이름/키워드 검색 (빈티지별 포함) — 토큰 매칭
  const tokens = [...new Set(nq.match(/[a-z0-9]+|[가-힣]{2,}/g) || [])].filter((t) => t.length >= 2 &&
    !["빈티지", "재고", "가격", "알려줘", "추천", "와인", "얼마", "있어", "정보"].includes(t));
  if (tokens.length) {
    const matched = items.filter((it) => {
      const hay = norm([it.name, it.nameKo, it.region, it.country, it.supplier].join(" "));
      return tokens.some((t) => hay.includes(t));
    });
    if (matched.length) {
      // 빈티지별 정리 요청이면 vintage 그룹화
      if (/빈티지|vintage|연도/.test(nq)) {
        const byV = {};
        matched.forEach((it) => { const v = it.vintage || "NV/미상"; (byV[v] ||= []).push(it); });
        const rows = Object.keys(byV).sort().map((v) =>
          `· ${v}: ${byV[v].map((it) => `${label(it)} 재고 ${bottles(it.stockTotal)}`).join(", ")}`);
        return { answer: `'${q.trim()}' 관련 빈티지별 재고 (${matched.length}건):\n` + rows.join("\n") + quoteNote(matched, q) + FOOTER, used: matched.length };
      }
      const top = matched.sort((a, b) => (b.stockTotal || 0) - (a.stockTotal || 0)).slice(0, 8);
      return { answer: `'${q.trim()}' 검색 결과 ${matched.length}건 중 재고순 ${top.length}종:\n` + listTable(top) + quoteNote(top, q) + FOOTER, used: matched.length };
    }
  }

  // 5) 폴백
  return {
    answer: "해당 질문에 맞는 품목을 데이터에서 찾지 못했습니다(데이터에 없음). " +
      "품목코드(예: FRBX470), 와인명, 또는 '신동창고 재고 많은 레드와인 top 5', '10만원 이하 공급가 화이트와인 추천' 처럼 물어봐 주세요." + FOOTER,
    used: 0,
  };
}
