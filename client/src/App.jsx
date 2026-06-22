import React, { useState } from "react";
import Gate from "./components/Gate.jsx";
import LegacyDashboard from "./components/LegacyDashboard.jsx";
import Inventory from "./components/inventory/Inventory.jsx";
import Assistant from "./components/assistant/Assistant.jsx";

export default function App() {
  const [unlocked, setUnlocked] = useState(
    () => sessionStorage.getItem("on_unlocked") === "1"
  );
  const [view, setView] = useState("dashboard");           // dashboard | inventory
  const [aiOpen, setAiOpen] = useState(
    () => window.matchMedia("(min-width: 1100px)").matches
  );

  if (!unlocked) {
    return <Gate onUnlock={() => { sessionStorage.setItem("on_unlocked", "1"); setUnlocked(true); }} />;
  }

  return (
    <>
      <header className="appbar">
        <div className="appbar-inner">
          <div className="ab-brand">
            <div className="ab-mark">ON</div>
            <div className="ab-title">영업ON본부 통합 대시보드
              <small>AI 업무혁신 · 데이터 기준일 2026-06-22</small>
            </div>
          </div>
          <div className="ab-spacer" />
          <div className="seg" role="tablist">
            <button className={view === "dashboard" ? "on" : ""} onClick={() => setView("dashboard")}>대시보드</button>
            <button className={view === "inventory" ? "on" : ""} onClick={() => setView("inventory")}>재고 분석</button>
          </div>
          <button className={"ai-toggle" + (aiOpen ? " on" : "")} onClick={() => setAiOpen((v) => !v)}>
            🤖 AI 어시스턴트
          </button>
        </div>
      </header>

      <div className="layout">
        <main className="main-col">
          {view === "dashboard" ? <LegacyDashboard /> : <Inventory />}
        </main>
        {aiOpen && (
          <aside className="ai-col">
            <Assistant onClose={() => setAiOpen(false)} />
          </aside>
        )}
      </div>
    </>
  );
}
