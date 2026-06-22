import fs from "node:fs";
const h = fs.readFileSync("dashboard.html", "utf8");
const s = h.indexOf("<script>");
const e = h.indexOf("</script>", s);
const script = h.slice(s + "<script>".length, e);

const partA = script.slice(0, script.indexOf("/* 렌더 */"));
const dStart = script.indexOf("const CH_DRILL = {};");
const dEnd = script.indexOf("let drillCh = null;");
if (dStart < 0 || dEnd < 0) { console.error("anchor not found"); process.exit(1); }
const drillFns = script.slice(dStart, dEnd);

const hashMatch = script.match(/var HASH = "([0-9a-f]+)"/);
const GATE_HASH = hashMatch ? hashMatch[1] : "";

const header = `/* =========================================================
   dashboardLegacy.js — v1(dashboard.html)에서 자동 추출한 데이터 + 섹션 렌더 코드.
   ⚠ 콘텐츠 100% 보존: 수치·텍스트·구조를 변경하지 않고 그대로 사용한다.
   (재생성: node _gen_legacy.mjs)  생성: ${new Date().toISOString()}
   ========================================================= */
`;

const footer = `
/* ===== React 래퍼용 export (v1 동작 보존) ===== */
export function renderDashboardHTML() {
  return [
    Header(), KpiSection(), ComparisonSection(), MonthlySection(),
    TargetSection(), ReceivableSection(), ImporterSection(), SummarySection(), Footnote(),
  ].join("");
}
export function attachDashboardHandlers(root) {
  let drillCh = null;
  const onClick = (ev) => {
    const tab = ev.target.closest(".tab");
    if (tab) {
      const g = tab.parentElement;
      g.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      return;
    }
    const r = ev.target.closest(".ch-row");
    if (!r) return;
    const ch = r.getAttribute("data-ch");
    const box = root.querySelector("#drill");
    root.querySelectorAll(".ch-row .ch-caret").forEach((c) => (c.textContent = "▸"));
    if (drillCh === ch) { drillCh = null; if (box) box.innerHTML = ""; return; }
    drillCh = ch;
    if (box) box.innerHTML = chDrillBlock(ch, "");
    const caret = r.querySelector(".ch-caret");
    if (caret) caret.textContent = "▾";
    const inp = root.querySelector("#drillSearch");
    if (inp) inp.focus();
  };
  const onInput = (ev) => {
    if (ev.target.id !== "drillSearch" || !drillCh) return;
    const body = root.querySelector("#drillBody");
    if (body) body.innerHTML = chDrillRows(drillCh, ev.target.value);
  };
  root.addEventListener("click", onClick);
  root.addEventListener("input", onInput);
  return () => { root.removeEventListener("click", onClick); root.removeEventListener("input", onInput); };
}
export const GATE_HASH = "${GATE_HASH}";
`;

const out = header + partA + "\n" + drillFns + "\n" + footer;
fs.mkdirSync("client/src/legacy", { recursive: true });
fs.writeFileSync("client/src/legacy/dashboardLegacy.js", out, "utf8");
console.log("legacy module bytes:", out.length, "| GATE_HASH:", GATE_HASH.slice(0, 12) + "…");
