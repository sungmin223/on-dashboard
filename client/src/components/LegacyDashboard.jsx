import React, { useEffect, useRef } from "react";
import { renderDashboardHTML, attachDashboardHandlers } from "../legacy/dashboardLegacy.js";

/* v1 대시보드(7개 섹션) 콘텐츠를 그대로 렌더 — 수치·텍스트·구조 100% 보존.
   v1의 렌더 함수가 만든 HTML을 주입하고, 탭/드릴다운/검색 핸들러를 부착한다. */
export default function LegacyDashboard() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.innerHTML = renderDashboardHTML();
    const detach = attachDashboardHandlers(el);
    return () => { detach && detach(); };
  }, []);
  return <div className="app" ref={ref} />;
}
