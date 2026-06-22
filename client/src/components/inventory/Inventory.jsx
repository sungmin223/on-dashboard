import React, { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { won, num, PRICE_BUCKETS, priceBucket } from "../../lib/format.js";
import { apiFetch } from "../../lib/api.js";

const PAGE = 50;
const PIE_COLORS = ["#0071e3", "#34c759", "#ff9500", "#b1304a", "#5e5ce6", "#86868b", "#ff3b30"];

export default function Inventory() {
  const [items, setItems] = useState(null);
  const [meta, setMeta] = useState(null);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [vintage, setVintage] = useState("");
  const [warehouse, setWarehouse] = useState("");   // "" | "sindong" | "icheon"
  const [bucket, setBucket] = useState("");
  const [stockOnly, setStockOnly] = useState(false);
  const [sort, setSort] = useState({ key: "stockTotal", dir: "desc" });
  const [page, setPage] = useState(0);

  useEffect(() => {
    apiFetch("/api/inventory")
      .then((r) => r.json())
      .then((d) => { setItems(d.items || []); setMeta(d.meta || {}); })
      .catch(() => setErr("재고 데이터를 불러오지 못했습니다. `npm run import-data` 후 서버를 확인하세요."));
  }, []);

  const types = useMemo(() => uniq(items, "type"), [items]);
  const vintages = useMemo(() => uniq(items, "vintage").sort().reverse(), [items]);

  const filtered = useMemo(() => {
    if (!items) return [];
    const needle = q.trim().toLowerCase();
    let list = items.filter((it) => {
      if (needle) {
        const hay = `${it.code} ${it.barcode} ${it.name} ${it.nameKo}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      if (type && it.type !== type) return false;
      if (vintage && String(it.vintage) !== vintage) return false;
      if (warehouse === "sindong" && !(it.stockSindong > 0)) return false;
      if (warehouse === "icheon" && !(it.stockIcheon > 0)) return false;
      if (stockOnly && !(it.stockTotal > 0)) return false;
      if (bucket && priceBucket(it.priceSupply) !== bucket) return false;
      return true;
    });
    const { key, dir } = sort;
    list = [...list].sort((a, b) => {
      const av = a[key], bv = b[key];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "number" && typeof bv === "number") return dir === "asc" ? av - bv : bv - av;
      return dir === "asc" ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
    return list;
  }, [items, q, type, vintage, warehouse, bucket, stockOnly, sort]);

  useEffect(() => { setPage(0); }, [q, type, vintage, warehouse, bucket, stockOnly]);

  const kpi = useMemo(() => {
    const base = filtered;
    return {
      sku: base.length,
      withStock: base.filter((i) => i.stockTotal > 0).length,
      sindong: base.reduce((s, i) => s + (i.stockSindong || 0), 0),
      icheon: base.reduce((s, i) => s + (i.stockIcheon || 0), 0),
    };
  }, [filtered]);

  const warehouseData = useMemo(() => ([
    { name: "신동창고", 재고: kpi.sindong },
    { name: "이천창고", 재고: kpi.icheon },
  ]), [kpi]);

  const typeData = useMemo(() => {
    const m = {};
    filtered.forEach((i) => { const t = i.type || "기타"; m[t] = (m[t] || 0) + 1; });
    return Object.entries(m).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filtered]);

  const bucketData = useMemo(() => {
    const m = Object.fromEntries(PRICE_BUCKETS.map((b) => [b.key, 0]));
    filtered.forEach((i) => { const k = priceBucket(i.priceSupply); if (k) m[k]++; });
    return PRICE_BUCKETS.map((b) => ({ name: b.key, 품목수: m[b.key] }));
  }, [filtered]);

  if (err) return <div className="inv"><div className="chart-card">{err}</div></div>;
  if (!items) return <div className="inv"><div className="chart-card">재고 데이터 불러오는 중…</div></div>;

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const pageItems = filtered.slice(page * PAGE, page * PAGE + PAGE);
  const sortable = (key, label, cls = "") => (
    <th className={cls} onClick={() => setSort((s) => ({ key, dir: s.key === key && s.dir === "desc" ? "asc" : "desc" }))}>
      {label}{sort.key === key ? (sort.dir === "desc" ? " ▾" : " ▴") : ""}
    </th>
  );

  return (
    <div className="inv">
      <div className="inv-head">
        <h2>재고 분석</h2>
        <span className="meta">{meta?.source} · 총 {num(items.length)} SKU{meta?.generatedAt ? ` · 갱신 ${meta.generatedAt.slice(0, 10)}` : ""}</span>
      </div>

      <div className="inv-kpis">
        <Kpi label="조회 SKU" val={num(kpi.sku)} sub={`전체 ${num(items.length)}개 중`} />
        <Kpi label="재고 보유 SKU" val={num(kpi.withStock)} sub="현재고 1병 이상" />
        <Kpi label="신동창고 재고" val={num(kpi.sindong)} sub="병" />
        <Kpi label="이천창고 재고" val={num(kpi.icheon)} sub="병" />
      </div>

      <div className="inv-charts">
        <div className="chart-card">
          <h4>창고별 재고 합계 (병)</h4>
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={warehouseData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#6e6e73" }} />
              <YAxis tick={{ fontSize: 11, fill: "#86868b" }} width={48} />
              <Tooltip formatter={(v) => num(v) + " 병"} />
              <Bar dataKey="재고" fill="#0071e3" radius={[6, 6, 0, 0]} maxBarSize={70} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="chart-card">
          <h4>타입 비중 (품목수)</h4>
          <ResponsiveContainer width="100%" height={210}>
            <PieChart>
              <Pie data={typeData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={72} innerRadius={40}>
                {typeData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v) => num(v) + " 품목"} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="chart-card">
          <h4>공급가 가격대 분포</h4>
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={bucketData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#6e6e73" }} interval={0} />
              <YAxis tick={{ fontSize: 11, fill: "#86868b" }} width={36} />
              <Tooltip formatter={(v) => num(v) + " 품목"} />
              <Bar dataKey="품목수" fill="#34c759" radius={[6, 6, 0, 0]} maxBarSize={48} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="inv-toolbar">
        <input
          className="inv-search" placeholder="🔍 품목명(영/한)·품목코드·바코드 검색…"
          value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off"
        />
        <div className="inv-filters">
          <label>타입
            <select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">전체</option>
              {types.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label>빈티지
            <select value={vintage} onChange={(e) => setVintage(e.target.value)}>
              <option value="">전체</option>
              {vintages.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </label>
          <label>창고
            <select value={warehouse} onChange={(e) => setWarehouse(e.target.value)}>
              <option value="">전체</option>
              <option value="sindong">신동 재고 보유</option>
              <option value="icheon">이천 재고 보유</option>
            </select>
          </label>
          <label>가격대
            <select value={bucket} onChange={(e) => setBucket(e.target.value)}>
              <option value="">전체</option>
              {PRICE_BUCKETS.map((b) => <option key={b.key} value={b.key}>{b.key}</option>)}
            </select>
          </label>
          <label className="chk"><input type="checkbox" checked={stockOnly} onChange={(e) => setStockOnly(e.target.checked)} /> 재고 보유만</label>
          <button className="clear" onClick={() => { setQ(""); setType(""); setVintage(""); setWarehouse(""); setBucket(""); setStockOnly(false); }}>초기화</button>
        </div>
      </div>

      <div className="inv-tablewrap">
        <div className="scroll">
          <table className="inv-tbl">
            <thead>
              <tr>
                <th>품목코드</th><th>상품명</th><th>타입</th>{sortable("vintage", "빈티지")}
                <th>용량</th>
                {sortable("stockTotal", "현재고", "num")}{sortable("stockSindong", "신동", "num")}{sortable("stockIcheon", "이천", "num")}
                {sortable("priceSupply", "공급가", "num")}{sortable("priceWholesale", "도매가", "num")}
                <th>바코드</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((it) => (
                <tr key={it.id}>
                  <td>{it.code || "—"}</td>
                  <td className="name">{it.nameKo || it.name}{it.nameKo && it.name ? <div style={{ color: "var(--text-3)", fontWeight: 400, fontSize: 11 }}>{it.name}</div> : null}</td>
                  <td>{tag(it.type)}</td>
                  <td>{it.vintage || "—"}</td>
                  <td>{it.volume || "—"}</td>
                  <td className="num">{it.stockTotal > 0 ? num(it.stockTotal) : <span className="tag zero">0</span>}</td>
                  <td className="num">{num(it.stockSindong)}</td>
                  <td className="num">{num(it.stockIcheon)}</td>
                  <td className="num">{won(it.priceSupply)}</td>
                  <td className="num">{won(it.priceWholesale)}</td>
                  <td style={{ color: "var(--text-3)" }}>{it.barcode || "—"}</td>
                </tr>
              ))}
              {!pageItems.length && <tr><td colSpan={11} style={{ textAlign: "center", padding: 30, color: "var(--text-3)" }}>조건에 맞는 품목이 없습니다.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="inv-pager">
          <button disabled={page <= 0} onClick={() => setPage((p) => p - 1)}>← 이전</button>
          <span>{filtered.length ? page * PAGE + 1 : 0}–{Math.min((page + 1) * PAGE, filtered.length)} / {num(filtered.length)}</span>
          <button disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)}>다음 →</button>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, val, sub }) {
  return (
    <div className="inv-kpi">
      <div className="k-label">{label}</div>
      <div className="k-val">{val}</div>
      <div className="k-sub">{sub}</div>
    </div>
  );
}
function tag(t) {
  if (!t) return "—";
  const low = t.toLowerCase();
  const cls = low.includes("red") ? "red" : low.includes("white") ? "white" : "";
  return <span className={"tag " + cls}>{t}</span>;
}
function uniq(items, key) {
  if (!items) return [];
  return [...new Set(items.map((i) => i[key]).filter((v) => v != null && v !== ""))].map(String);
}
