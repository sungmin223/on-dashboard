/* csv.js — 브라우저용 최소 CSV 파서/직렬화 (업로드/다운로드 공용).
   따옴표·쉼표·줄바꿈 처리. 헤더 첫 줄 기준 객체 배열로 변환. */
export function parseCSV(text) {
  const rows = [];
  let row = [], field = "", q = false;
  text = String(text).replace(/^﻿/, "");
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

export function csvToObjects(text) {
  const rows = parseCSV(text);
  if (!rows.length) return { head: [], objects: [] };
  const head = rows[0].map((h) => h.trim());
  const objects = rows.slice(1).map((r) => {
    const o = {};
    head.forEach((h, i) => { o[h] = (r[i] ?? "").trim(); });
    return o;
  });
  return { head, objects };
}

export function objectsToCSV(objects, head) {
  if (!objects?.length && !head?.length) return "";
  const cols = head || Object.keys(objects[0] || {});
  const esc = (v) => {
    const s = v == null ? "" : String(v);
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const lines = [cols.join(",")];
  for (const o of objects) lines.push(cols.map((c) => esc(o[c])).join(","));
  return lines.join("\r\n");
}

/* 브라우저 다운로드 트리거 (UTF-8 BOM 포함 → 엑셀 한글 안전) */
export function downloadCSV(filename, csvText) {
  const blob = new Blob(["﻿" + csvText], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}
