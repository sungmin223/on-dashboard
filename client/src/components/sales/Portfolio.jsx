/* Portfolio.jsx — 신동와인 브랜드/포트폴리오 입점 거래처 검색.
   제품마스터(932 SKU)에서 제품을 찾고, 납품이력으로 입점 거래처를 역추적한다.
   ⚠ 입점 여부/실적은 납품이력 데이터에만 근거한다. 데이터 없으면 "납품 이력 없음"으로 정직 표기. */
import React, { useMemo, useState } from "react";
import { useSales, SourceBadge, EmptyState, Card, V, ReasonNote } from "./ui.jsx";
import DataToolbar from "./DataToolbar.jsx";
import { searchProducts } from "../../lib/productMaster.js";
import { deliveryStatus, won } from "../../lib/salesData.js";

export default function Portfolio() {
  const { data, err } = useSales();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [channel, setChannel] = useState("");
  const [status, setStatus] = useState("");      // 입점상태 필터
  const [sort, setSort] = useState("recent");    // recent | sales | qty | importance
  const [selected, setSelected] = useState(null);

  const products = data?.productMaster?.products || [];
  const accounts = data?.accounts || [];
  const deliveries = data?.deliveries || [];
  const accById = Object.fromEntries(accounts.map((a) => [a.account_id, a]));

  const cats = [...new Set(products.map((p) => p.포트폴리오카테고리).filter(Boolean))].sort();
  const channels = [...new Set(accounts.map((a) => a.채널).filter(Boolean))].sort();

  // 제품 검색 결과
  const found = useMemo(() => {
    let list = q.trim() ? searchProducts(products, q, 80) : products.slice(0, 0);
    if (cat) list = list.filter((p) => p.포트폴리오카테고리 === cat);
    return list;
  }, [q, cat, products]);

  // 선택 제품(없으면 검색 결과 전체)에 대한 입점 거래처 집계
  const targetProductIds = selected ? [selected.product_id] : found.map((p) => p.product_id);
  const placements = useMemo(() => {
    if (!targetProductIds.length) return [];
    const idset = new Set(targetProductIds);
    // account+product 단위 집계
    const map = new Map();
    for (const d of deliveries) {
      if (!idset.has(d.product_id)) continue;
      const key = d.account_id + "|" + d.product_id;
      const qty = Number(d.수량) || 0;
      const rev = Number(d.매출액) || 0;
      const cur = map.get(key) || {
        account_id: d.account_id, 거래처명: d.거래처명, product_id: d.product_id,
        와인명: d.와인명, 빈티지: d.빈티지, lastDate: "", totalQty: 0, totalRev: 0,
        lastQty: 0, supplySum: 0, supplyCnt: 0, 담당자: d.담당자, _sample: d._sample,
      };
      cur.totalQty += qty; cur.totalRev += rev;
      if (Number(d.공급가)) { cur.supplySum += Number(d.공급가); cur.supplyCnt++; }
      if (!cur.lastDate || d.출고일 > cur.lastDate) { cur.lastDate = d.출고일; cur.lastQty = qty; }
      map.set(key, cur);
    }
    let rows = [...map.values()].map((r) => {
      const acc = accById[r.account_id] || {};
      return {
        ...r,
        채널: acc.채널, 업장타입: acc.업장타입, 지역: [acc.지역1, acc.지역2].filter(Boolean).join(" "),
        중요도: acc.중요도, avgSupply: r.supplyCnt ? Math.round(r.supplySum / r.supplyCnt) : null,
        st: deliveryStatus(r.lastDate),
      };
    });
    if (channel) rows = rows.filter((r) => r.채널 === channel);
    if (status) rows = rows.filter((r) => r.st.label === status);
    const impRank = { A: 3, B: 2, C: 1, D: 0 };
    rows.sort((a, b) => {
      if (sort === "recent") return (b.lastDate || "").localeCompare(a.lastDate || "");
      if (sort === "sales") return b.totalRev - a.totalRev;
      if (sort === "qty") return b.totalQty - a.totalQty;
      if (sort === "importance") return (impRank[b.중요도] || 0) - (impRank[a.중요도] || 0);
      return 0;
    });
    return rows;
  }, [targetProductIds.join(","), deliveries, channel, status, sort]);

  const statuses = ["현재 납품중", "최근 3~6개월", "6개월+ 미출고"];

  if (err) return <div className="s-wrap"><Card>{err}</Card></div>;
  if (!data) return <div className="s-wrap"><Card>영업 데이터 불러오는 중…</Card></div>;

  return (
    <div className="s-wrap">
      <div className="s-head">
        <h2>입점 거래처 검색</h2>
        <span className="s-sub">제품마스터 {won(products.length)} SKU · 납품이력 {deliveries.length}건(샘플)</span>
      </div>

      <DataToolbar dataset="deliveries" rows={deliveries} onReload={() => location.reload()} />
      <ReasonNote>
        검색은 제품마스터(재고 932 SKU·실데이터)에서 이뤄지며, <b>입점/실적은 납품이력</b>으로만 판단합니다.
        납품이력은 현재 <b>샘플</b>이므로 실제 거래처는 “납품이력.csv 업로드” 후 정확해집니다.
      </ReasonNote>

      {/* 검색/필터 */}
      <Card>
        <input
          className="s-search"
          placeholder="🔎 브랜드·와인명·국가·지역·품목코드 검색 (초성 가능: 예) ㄱㅇ → 가야)"
          value={q} onChange={(e) => { setQ(e.target.value); setSelected(null); }}
          autoComplete="off"
        />
        <div className="s-filters">
          <label>카테고리
            <select value={cat} onChange={(e) => setCat(e.target.value)}>
              <option value="">전체</option>
              {cats.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label>채널
            <select value={channel} onChange={(e) => setChannel(e.target.value)}>
              <option value="">전체</option>
              {channels.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label>입점상태
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">전체</option>
              {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label>정렬
            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="recent">최근 출고일순</option>
              <option value="sales">매출액순</option>
              <option value="qty">수량순</option>
              <option value="importance">거래처 중요도순</option>
            </select>
          </label>
          <button className="clear" onClick={() => { setQ(""); setCat(""); setChannel(""); setStatus(""); setSelected(null); }}>초기화</button>
        </div>
      </Card>

      {!q.trim() && !cat && (
        <EmptyState title="브랜드 또는 제품을 검색하세요" hint="예) 볼렝저, 가야, 샤블리, 오퍼스, 부르고뉴, 칠레 / 또는 카테고리 선택" />
      )}

      {/* 제품 후보 */}
      {(q.trim() || cat) && (
        <Card title={`제품 후보 ${found.length}건`} right={selected && <button className="linklike" onClick={() => setSelected(null)}>전체 보기</button>}>
          {!found.length ? (
            <EmptyState title="일치하는 제품이 없습니다" hint="철자/초성을 바꾸거나 카테고리로 탐색해 보세요." />
          ) : (
            <div className="chip-row">
              {found.slice(0, 30).map((p) => (
                <button
                  key={p.product_id}
                  className={"prod-chip" + (selected?.product_id === p.product_id ? " on" : "")}
                  onClick={() => setSelected(selected?.product_id === p.product_id ? null : p)}
                  title={`${p.와인명영문 || ""} · ${p.국가} ${p.지역}`}
                >
                  <b>{p.와인명}</b>
                  <small>{p.포트폴리오카테고리}{p.빈티지 ? " · " + p.빈티지 : ""} · 재고 {won(p.재고수량)}</small>
                </button>
              ))}
              {found.length > 30 && <span className="muted">…외 {found.length - 30}건(검색어를 더 좁혀주세요)</span>}
            </div>
          )}
        </Card>
      )}

      {/* 입점 거래처 결과 */}
      {(q.trim() || cat) && found.length > 0 && (
        <Card
          title={selected ? `‘${selected.와인명}’ 입점 거래처` : "검색 제품들의 입점 거래처"}
          right={<span className="muted">{placements.length}건</span>}
        >
          {!placements.length ? (
            <EmptyState
              title="납품 이력이 없습니다"
              hint="이 제품(들)은 샘플 납품이력에 출고 기록이 없습니다. 실제 납품이력.csv 업로드 시 입점 거래처가 표시됩니다."
            />
          ) : (
            <div className="scroll">
              <table className="s-tbl">
                <thead>
                  <tr>
                    <th>거래처</th><th>지역</th><th>업장</th><th>담당</th>
                    <th>제품</th><th>입점상태</th><th className="num">최근출고</th>
                    <th className="num">최근수량</th><th className="num">누적수량</th>
                    <th className="num">누적매출</th><th className="num">평균공급가</th>
                  </tr>
                </thead>
                <tbody>
                  {placements.map((r) => (
                    <tr key={r.account_id + r.product_id}>
                      <td className="name">{r.거래처명} <SourceBadge row={r} /></td>
                      <td><V>{r.지역}</V></td>
                      <td>{r.업장타입 || "—"}{r.중요도 ? <span className="imp">{r.중요도}</span> : null}</td>
                      <td>{r.담당자 || "—"}</td>
                      <td>{r.와인명}{r.빈티지 ? <small className="muted"> {r.빈티지}</small> : null}</td>
                      <td><span className={"st st-" + r.st.tone}>{r.st.label}</span></td>
                      <td className="num">{r.lastDate || "—"}</td>
                      <td className="num">{won(r.lastQty)}</td>
                      <td className="num">{won(r.totalQty)}</td>
                      <td className="num">{won(r.totalRev)}</td>
                      <td className="num">{r.avgSupply ? won(r.avgSupply) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <ReasonNote>
            입점상태 기준: 최근 출고일로부터 <b>90일 이내=현재 납품중</b>, 91~180일=최근 3~6개월, 180일 초과=6개월+ 미출고.
            누적/평균은 표시된 납품이력 합계입니다.
          </ReasonNote>
        </Card>
      )}
    </div>
  );
}
