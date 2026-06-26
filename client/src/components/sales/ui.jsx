/* ui.jsx — 영업 모듈 공용 UI 조각 + 데이터 훅.
   배지(샘플/출처/신뢰도)는 화면 어디서나 "데이터 출처·신뢰도"를 노출하기 위한 공통 규약. */
import React, { useEffect, useState } from "react";
import { loadSales } from "../../lib/salesData.js";

/* 시드 1회 로드 훅 */
export function useSales() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    let alive = true;
    loadSales()
      .then((d) => { if (alive) setData(d); })
      .catch(() => { if (alive) setErr("영업 데이터를 불러오지 못했습니다."); });
    return () => { alive = false; };
  }, []);
  return { data, err };
}

/* 샘플/업로드 표시 */
export function SourceBadge({ row }) {
  if (!row) return null;
  const sample = row._sample !== false && (row._sample === true || row._source === "샘플");
  return (
    <span className={"badge " + (sample ? "b-sample" : "b-real")}>
      {sample ? "샘플" : "업로드"}
    </span>
  );
}

/* 신뢰도 A~D */
const CONF = {
  A: { t: "A·실매출/납품", cls: "c-a" },
  B: { t: "B·와인리스트", cls: "c-b" },
  C: { t: "C·담당자코멘트", cls: "c-c" },
  D: { t: "D·추정/샘플", cls: "c-d" },
};
export function ConfBadge({ grade }) {
  const g = CONF[String(grade || "").toUpperCase()] || { t: grade || "확인 필요", cls: "c-x" };
  return <span className={"badge conf " + g.cls}>{g.t}</span>;
}

/* "확인 필요" 표기 — 빈 값은 추측하지 않는다 */
export function V({ children }) {
  const empty = children == null || children === "" || children === "확인필요";
  return empty ? <span className="need-check">확인 필요</span> : <>{children}</>;
}

export function EmptyState({ title, hint }) {
  return (
    <div className="empty-state">
      <div className="es-title">{title}</div>
      {hint && <div className="es-hint">{hint}</div>}
    </div>
  );
}

export function Card({ title, right, children, className = "" }) {
  return (
    <section className={"s-card " + className}>
      {(title || right) && (
        <div className="s-card-head">
          <h3>{title}</h3>
          <div className="s-card-right">{right}</div>
        </div>
      )}
      {children}
    </section>
  );
}

/* 데이터 부족 등 '추천 불가'를 정직하게 표기 */
export function ReasonNote({ children }) {
  return <div className="reason-note">ℹ️ {children}</div>;
}

/* 다음 단계 구현 예정 모듈용 정직한 안내 */
export function ComingSoon({ title, points = [], data }) {
  return (
    <div className="s-wrap">
      <Card title={title} right={<span className="badge b-soon">구현 예정</span>}>
        <p style={{ color: "var(--text-2)", margin: "4px 0 10px" }}>
          이 모듈은 데이터 레이어가 준비되어 있으며 다음 단계에서 화면이 구현됩니다.
          현재 보유 데이터:
        </p>
        <ul className="bullet">
          {points.map((p, i) => <li key={i}>{p}</li>)}
        </ul>
        {data && (
          <ReasonNote>
            거래처 {data.accounts?.length || 0} · 납품 {data.deliveries?.length || 0} ·
            페어링 {data.pairings?.length || 0} · 지역선호 {data.regions?.length || 0} · 제품 {data.productMaster?.products?.length || 0}
          </ReasonNote>
        )}
      </Card>
    </div>
  );
}
