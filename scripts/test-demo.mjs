/* 데모(규칙 기반) AI 응답 검증 — UTF-8 보장된 fetch 로 /api/chat 호출 */
const Q = [
  "FRBX470 재고와 가격 알려줘",
  "신동창고에 재고 많은 레드와인 top 5",
  "10만원 이하 공급가 화이트와인 추천",
  "샤또 빈티지별 재고",
  "8809970782440 재고 알려줘",
  "존재하지않는와인XYZ 재고",
];

for (const q of Q) {
  const r = await fetch("http://localhost:3001/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-access-token": process.env.TEST_TOKEN || "" },
    body: JSON.stringify({ messages: [{ role: "user", content: q }] }),
  });
  const j = await r.json();
  console.log("\n========================================");
  console.log("Q:", q);
  console.log(`[model:${j.model} demo:${j.demo} used:${j.used}]`);
  console.log(j.answer);
}
