/* DataToolbar.jsx — 데이터셋 CSV 업로드/다운로드 + 샘플 복귀.
   업로드는 localStorage 오버라이드로 즉시 반영(샘플 대체). 새로고침 후 적용. */
import React, { useRef, useState } from "react";
import { saveOverride, clearOverride, overrideInfo } from "../../lib/salesData.js";
import { objectsToCSV, downloadCSV } from "../../lib/csv.js";

const LABELS = {
  accounts: "거래처마스터", deliveries: "납품이력", pairings: "페어링리스트", regions: "지역선호도",
};

export default function DataToolbar({ dataset, rows = [], onReload }) {
  const ref = useRef();
  const [msg, setMsg] = useState("");
  const has = overrideInfo()[dataset];

  function onFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        saveOverride(dataset, String(reader.result));
        setMsg("업로드 완료 — 적용하려면 새로고침하세요.");
        onReload?.();
      } catch { setMsg("CSV 파싱 실패 — 형식을 확인하세요."); }
    };
    reader.readAsText(f, "utf-8");
    e.target.value = "";
  }
  function download() {
    const head = rows.length ? Object.keys(rows[0]).filter((k) => !k.startsWith("_")) : [];
    downloadCSV(`${LABELS[dataset]}.csv`, objectsToCSV(rows.map((r) => {
      const o = {}; head.forEach((k) => (o[k] = r[k])); return o;
    }), head));
  }
  function reset() {
    clearOverride(dataset);
    setMsg("샘플 데이터로 되돌림 — 새로고침하세요.");
    onReload?.();
  }

  return (
    <div className="data-toolbar">
      <span className={"badge " + (has ? "b-real" : "b-sample")}>{has ? "업로드본 사용중" : "샘플 사용중"}</span>
      <button className="clear" onClick={() => ref.current?.click()}>⬆ {LABELS[dataset]} CSV 업로드</button>
      <button className="clear" onClick={download} disabled={!rows.length}>⬇ 현재 데이터 내보내기</button>
      {has && <button className="clear" onClick={reset}>↺ 샘플로 복귀</button>}
      <input ref={ref} type="file" accept=".csv,text/csv" hidden onChange={onFile} />
      {msg && <span className="muted" style={{ marginLeft: 6 }}>{msg}</span>}
    </div>
  );
}
