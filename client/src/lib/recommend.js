/* recommend.js — 신동 포트폴리오 추천 로직(근거 동반).
   ⚠ 모든 추천은 '근거(reason)'를 함께 반환한다. 확정이 아니라 '제안'이며,
      데이터가 부족하면 빈 결과 + 사유를 돌려준다(임의 추천 금지). */

/* 한/영 지역·스타일 텍스트 → 제품마스터 포트폴리오 카테고리 추정 */
const CAT_KO = [
  [/샴페인|샹파뉴|champagne/i, "샴페인"],
  [/부르고뉴|샤블리|뫼르소|주브레|본\b|꼬뜨\s?도르|bourgogne|burgundy|chablis|meursault/i, "부르고뉴"],
  [/보르도|메독|뽀이약|마고|생테스테프|생줄리앙|bordeaux|medoc|pauillac|margaux/i, "보르도"],
  [/피에몬테|바롤로|바르바레스코|네비올로|piemonte|barolo|barbaresco/i, "피에몬테"],
  [/토스카나|끼안티|키안티|브루넬로|toscana|chianti|brunello/i, "토스카나"],
  [/나파|소노마|캘리포니아|napa|sonoma|california/i, "캘리포니아"],
  [/멘도사|말벡|mendoza|malbec/i, "멘도사(아르헨티나)"],
  [/말보로|뉴질랜드|소비뇽\s?블랑.*뉴|marlborough/i, "뉴질랜드"],
  [/\b론\b|꼬뜨\s?뒤\s?론|rhone|rhône/i, "론"],
  [/도루|포트|포르투|douro|porto/i, "포르투갈"],
  [/토카이|tokaji/i, "토카이"],
];
const COUNTRY_KO = [
  [/프랑스|france/i, "FRANCE"], [/이탈리아|italy/i, "ITALY"], [/미국|usa|미\b/i, "USA"],
  [/스페인|spain/i, "SPAIN"], [/칠레|chile/i, "CHILE"], [/아르헨티나|argentina/i, "ARGENTINA"],
  [/호주|australia/i, "AUSTRALIA"], [/뉴질랜드|new\s?zealand/i, "NEW ZEALAND"], [/포르투갈|portugal/i, "PORTUGAL"],
];

/* 텍스트에서 가장 먼저 등장하는 키워드의 카테고리를 택한다
   (예: "부르고뉴·샴페인" → 부르고뉴). 규칙 나열 순서에 휘둘리지 않게. */
export function categorize(text) {
  const s = String(text || "");
  let best = null, bestPos = Infinity;
  for (const [re, cat] of CAT_KO) {
    const m = s.match(re);
    if (m && m.index < bestPos) { bestPos = m.index; best = cat; }
  }
  return best;
}

/* 와인 텍스트 → 스타일(레드/화이트/스파클링/로제) 추정 */
export function inferStyle(text) {
  const s = String(text || "").toLowerCase();
  if (/샴페인|샹파뉴|스파클링|sparkl|champagne|cremant|cava|prosecco|pet\s?nat|펫낫/i.test(s)) return "sparkling";
  if (/로제|rose|rosé/i.test(s)) return "rose";
  if (/화이트|샤르도네|소비뇽|리슬링|샤블리|뫼르소|white|chardonnay|sauvignon|riesling/i.test(s)) return "White";
  if (/레드|피노|카베르네|메를로|메를롯|네비올로|시라|말벡|산지오베제|red|pinot|cabernet|merlot|nebbiolo|syrah|malbec/i.test(s)) return "Red";
  return null;
}
const styleMatch = (prodType, style) => {
  if (!style || !prodType) return false;
  const t = String(prodType).toLowerCase();
  if (style === "sparkling") return /spark|champ|cava|brut|뀌|꾸베/i.test(t);
  if (style === "rose") return /rose|rosé|로제/i.test(t);
  if (style === "White") return /white/i.test(t);
  if (style === "Red") return /red/i.test(t);
  return false;
};
export function countryOf(text) {
  const s = String(text || "");
  for (const [re, c] of COUNTRY_KO) if (re.test(s)) return c;
  return null;
}

/* 신동 보유 제품 중 같은 카테고리(없으면 같은 국가) 대체 후보.
   재고 보유 우선, 가격(공급가) 근접 정렬. */
export function altProducts(catText, countryText, products, { priceHint = null, top = 3, styleHint = null } = {}) {
  const cat = categorize(catText) || categorize(countryText);
  const country = countryOf(countryText) || countryOf(catText);
  const style = styleHint || inferStyle(catText);
  let pool = [];
  let basis = "";
  if (cat) { pool = products.filter((p) => p.포트폴리오카테고리 === cat); basis = `카테고리 '${cat}'`; }
  if (!pool.length && country) { pool = products.filter((p) => (p.국가 || "").toUpperCase() === country); basis = `국가 '${country}'`; }
  if (!pool.length) return { items: [], basis: "", reason: "카테고리·국가 추정 불가 → 수동 확인 필요" };

  // 스타일(레드/화이트 등) 일치 우선 좁히기 — 일치 제품이 있을 때만 적용
  if (style) {
    const styled = pool.filter((p) => styleMatch(p.타입, style));
    if (styled.length) { pool = styled; basis += ` · ${style}`; }
  }
  // '전용/한정' 라벨(타본부 전용 등)은 후순위
  const exclusive = (p) => /전용|한정|코스트코/i.test(p.와인명 || "");

  const ranked = [...pool].sort((a, b) => {
    const ex = (exclusive(a) ? 1 : 0) - (exclusive(b) ? 1 : 0);
    if (ex) return ex;
    const stock = (b.재고수량 > 0) - (a.재고수량 > 0);
    if (stock) return stock;
    if (priceHint) return Math.abs((a.공급가 || 0) - priceHint) - Math.abs((b.공급가 || 0) - priceHint);
    return (b.재고수량 || 0) - (a.재고수량 || 0);
  }).slice(0, top);

  return {
    items: ranked, basis,
    reason: `${basis} 일치 신동 보유 제품(재고 우선${style ? "·스타일 반영" : ""})`,
  };
}

/* 거래처 페어링 묶음 → 분포/신동비중/자동 영업 제안 메모 */
export function pairingInsights(rows, products) {
  const total = rows.length;
  const sindong = rows.filter((r) => String(r.신동와인제품여부).toUpperCase() === "Y");
  const comp = rows.filter((r) => String(r.신동와인제품여부).toUpperCase() !== "Y" && r.와인명);

  const byCountry = countMap(rows.map((r) => r.국가).filter(Boolean));
  const byCat = countMap(rows.map((r) => categorize(`${r.지역} ${r.국가} ${r.와인명}`)).filter(Boolean));

  // 경쟁 와인별 신동 대체 제안
  const swaps = comp.map((r) => {
    const style = inferStyle(`${r.와인명} ${r.품종} ${r.지역}`);
    const alt = altProducts(`${r.지역} ${r.와인명}`, r.국가, products, { top: 2, styleHint: style });
    return { wine: r.와인명, importer: r.수입사, region: r.지역, alt };
  }).filter((x) => x.alt.items.length);

  // 자동 메모
  const pct = total ? Math.round((sindong.length / total) * 100) : 0;
  const topCat = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0];
  let memo = `구성 ${total}종 중 신동 ${sindong.length}종 포함(${pct}%).`;
  if (comp.length) memo += ` 경쟁 수입사 ${comp.length}종.`;
  if (topCat) memo += ` 최다 카테고리: ${topCat[0]}(${topCat[1]}종).`;
  if (swaps.length) {
    const ex = swaps[0];
    const exItem = ex.alt.items[0];
    memo += ` 예) '${ex.wine}'(${ex.region}) → 신동 '${exItem.와인명}'로 대체 제안 가능.`;
  }
  if (!swaps.length && comp.length) memo += " 경쟁 제품 대체 후보 없음 → 포트폴리오 보강 검토.";

  return { total, sindong: sindong.length, comp: comp.length, pct, byCountry, byCat, swaps, memo };
}

function countMap(arr) {
  const m = {};
  arr.forEach((v) => { m[v] = (m[v] || 0) + 1; });
  return m;
}

/* 지역선호 1행 → 신동 추천 포트폴리오 매칭 */
export function regionMatch(row, products, top = 4) {
  const hint = `${row.추천포트폴리오} ${row.선호지역} ${row.선호국가} ${row.선호스타일}`;
  const style = inferStyle(`${row.선호스타일} ${row.선호품종}`);
  return altProducts(hint, row.선호국가, products, { top, styleHint: style });
}
