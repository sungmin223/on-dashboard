/* productMaster.js — 제품마스터(932 SKU) 검색·매칭 유틸.
   - 정규화 / 초성 검색 / 부분일치 / 유사도(토큰 자카드)
   - 페어링 와인명 → 신동 제품 "매칭 후보" 산출(자동 확정 금지) */

export const norm = (s) =>
  String(s || "").toLowerCase().replace(/['"’`().]/g, "").replace(/\s+/g, " ").trim();

const CHO = ["ㄱ","ㄲ","ㄴ","ㄷ","ㄸ","ㄹ","ㅁ","ㅂ","ㅃ","ㅅ","ㅆ","ㅇ","ㅈ","ㅉ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ"];
/* 한글 문자열 → 초성 추출 (예: "샤또" → "ㅅㄸ") */
export function chosung(str) {
  let out = "";
  for (const ch of String(str)) {
    const code = ch.charCodeAt(0) - 0xac00;
    if (code >= 0 && code <= 11171) out += CHO[Math.floor(code / 588)];
    else out += ch;
  }
  return out;
}
const isChosungQuery = (q) => /^[ㄱ-ㅎ]+$/.test(q.replace(/\s/g, ""));

export function tokens(s) {
  return (norm(s).match(/[a-z0-9]+|[가-힣]{2,}/g) || []).filter((t) => t.length >= 2);
}

/* 한 제품이 질의에 맞는지 점수화 (0이면 제외) */
export function scoreProduct(p, q) {
  const raw = norm(q);
  if (!raw) return 0;
  const name = norm(p.와인명), en = norm(p.와인명영문);
  const hay = norm([p.와인명, p.와인명영문, p.브랜드명, p.국가, p.지역, p.포트폴리오카테고리, (p.키워드 || []).join(" "), p.product_id, p.빈티지].join(" "));
  let s = 0;
  if (norm(p.product_id) === raw) s += 60;
  if (name === raw || en === raw) s += 50;
  if (hay.includes(raw)) s += 12;
  for (const t of tokens(q)) if (hay.includes(t)) s += 5;
  // 초성 검색
  if (isChosungQuery(q)) {
    const cs = chosung(p.와인명 + " " + p.브랜드명);
    if (cs.replace(/\s/g, "").includes(q.replace(/\s/g, ""))) s += 8;
  }
  return s;
}

export function searchProducts(products, q, limit = 50) {
  if (!q || !q.trim()) return [];
  return products
    .map((p) => ({ p, s: scoreProduct(p, q) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => x.p);
}

/* 토큰 자카드 유사도 (0~1) */
function jaccard(a, b) {
  const A = new Set(tokens(a)), B = new Set(tokens(b));
  if (!A.size || !B.size) return 0;
  let inter = 0; A.forEach((t) => { if (B.has(t)) inter++; });
  return inter / (A.size + B.size - inter);
}

/* 페어링의 와인명/생산자 → 신동 제품 매칭 후보 (자동 확정하지 않음).
   반환: [{product, score}] 상위 N. score>=0.5 면 'strong', 그 외 'weak'. */
export function matchCandidates(wineName, producer, products, top = 3) {
  const query = `${wineName || ""} ${producer || ""}`;
  if (!norm(query)) return [];
  return products
    .map((p) => {
      const target = `${p.와인명} ${p.와인명영문} ${p.브랜드명}`;
      const j = jaccard(query, target);
      // 정확/부분 포함 보너스
      const inc = norm(target).includes(norm(wineName)) && norm(wineName).length >= 2 ? 0.3 : 0;
      return { product: p, score: Math.min(1, j + inc) };
    })
    .filter((x) => x.score > 0.15)
    .sort((a, b) => b.score - a.score)
    .slice(0, top);
}
