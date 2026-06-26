import React, { Suspense, lazy, useState } from "react";
import Gate from "./components/Gate.jsx";
import LegacyDashboard from "./components/LegacyDashboard.jsx";
import Assistant from "./components/assistant/Assistant.jsx";

// 무거운 모듈(차트/데이터)은 필요할 때만 로드 → 초기 번들 경량화
const Inventory = lazy(() => import("./components/inventory/Inventory.jsx"));
const Home = lazy(() => import("./components/sales/Home.jsx"));
const Portfolio = lazy(() => import("./components/sales/Portfolio.jsx"));
const Pairing = lazy(() => import("./components/sales/Pairing.jsx"));
const Region = lazy(() => import("./components/sales/Region.jsx"));
const RoutePlan = lazy(() => import("./components/sales/RoutePlan.jsx"));
const Validate = lazy(() => import("./components/sales/Validate.jsx"));

const TABS = [
  { key: "home", label: "🏠 홈" },
  { key: "route", label: "🗺 외근동선" },
  { key: "pairing", label: "🍷 페어링가격" },
  { key: "region", label: "📍 지역선호" },
  { key: "portfolio", label: "🔎 입점검색" },
  { key: "inventory", label: "📦 재고분석" },
  { key: "validate", label: "✅ 데이터검증" },
];

export default function App() {
  const [unlocked, setUnlocked] = useState(
    () => sessionStorage.getItem("on_unlocked") === "1"
  );
  const [view, setView] = useState("home");
  const [aiOpen, setAiOpen] = useState(
    () => window.matchMedia("(min-width: 1100px)").matches
  );

  if (!unlocked) {
    return <Gate onUnlock={() => { sessionStorage.setItem("on_unlocked", "1"); setUnlocked(true); }} />;
  }

  const fallback = <div className="lazy-fallback">데이터를 불러오는 중…</div>;

  return (
    <>
      <header className="appbar">
        <div className="appbar-inner">
          <div className="ab-brand">
            <div className="ab-mark">ON</div>
            <div className="ab-title">영업ON본부 Sales Intelligence
              <small>외근 동선 · 페어링가격 · 지역선호 · 입점검색</small>
            </div>
          </div>
          <div className="ab-spacer" />
          <div className="seg-scroll">
            <div className="seg" role="tablist">
              {TABS.map((t) => (
                <button key={t.key} className={view === t.key ? "on" : ""} onClick={() => setView(t.key)}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <button className={"ai-toggle" + (aiOpen ? " on" : "")} onClick={() => setAiOpen((v) => !v)}>
            🤖 AI
          </button>
        </div>
      </header>

      <div className="layout">
        <main className="main-col">
          <Suspense fallback={fallback}>
            {view === "home" && <Home onGo={setView} />}
            {view === "route" && <RoutePlan />}
            {view === "pairing" && <Pairing />}
            {view === "region" && <Region />}
            {view === "portfolio" && <Portfolio />}
            {view === "inventory" && <Inventory />}
            {view === "validate" && <Validate />}
          </Suspense>
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
