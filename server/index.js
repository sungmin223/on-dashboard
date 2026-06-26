/* =========================================================
   server/index.js — 경량 백엔드 프록시
   - GET  /api/health      상태/데이터 메타
   - GET  /api/inventory   재고 데이터(프론트 검색·필터·차트용; 사내 전용)
   - POST /api/chat        AI 어시스턴트 (RAG → Claude). API 키는 서버 전용.
   - (prod) client/dist 정적 서빙
   ⚠ ANTHROPIC_API_KEY 는 .env(서버)에서만 로드. 클라이언트/번들/응답에 절대 노출 금지.
   ========================================================= */
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import { retrieve, getInventory, loadInventory } from "./rag.js";
import { buildSystemPrompt } from "./prompt.js";
import { demoAnswer } from "./demoAnswer.js";
import { getSales, loadSales } from "./sales.js";

dotenv.config();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PORT = process.env.PORT || 3001;
const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
const API_KEY = process.env.ANTHROPIC_API_KEY || "";
// 내부 단가/재고 API 보호용 접근 해시. 기본값은 프론트 게이트와 동일(GATE_HASH)이라
// 별도 설정 없이도 보호되며, .env 의 ACCESS_HASH 로 덮어쓸 수 있다.
const ACCESS_HASH = (process.env.ACCESS_HASH || "0fde51116efab90707b7f2952cb1d08112ad3bc4d45ee7afeb58a3d1b5739346").trim().toLowerCase();

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

/* 사내 인증 — x-access-token(비밀번호 원문)의 SHA-256 이 ACCESS_HASH 와 일치해야 통과.
   ACCESS_HASH 가 비어 있으면(명시적 비활성) 인증을 건너뛴다. */
function requireAccess(req, res, next) {
  if (!ACCESS_HASH) return next();
  const token = String(req.get("x-access-token") || "");
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  if (token && hash === ACCESS_HASH) return next();
  return res.status(401).json({ error: "접근 권한이 없습니다. 대시보드 비밀번호로 로그인 후 이용하세요." });
}

loadInventory();
const inv = getInventory();
if (!inv.items?.length) {
  console.warn("[server] data/inventory.json 이 없거나 비어 있습니다. `npm run import-data` 를 먼저 실행하세요.");
}

app.get("/api/health", (_req, res) => {
  const m = getInventory().meta || {};
  res.json({ ok: true, model: MODEL, hasApiKey: Boolean(API_KEY), inventory: m });
});

/* 재고 데이터 — 사내 전용(프론트 검색/필터/차트). 가격 포함 → 인증 필수. */
app.get("/api/inventory", requireAccess, (_req, res) => {
  res.json(getInventory());
});

/* 영업 인텔리전스 시드(거래처/납품/페어링/지역선호 + 제품마스터). 단가 포함 → 인증 필수. */
app.get("/api/sales", requireAccess, (_req, res) => {
  res.json(getSales());
});

/* AI 어시스턴트 — 인증 필수 */
app.post("/api/chat", requireAccess, async (req, res) => {
  try {
    const messages = Array.isArray(req.body?.messages) ? req.body.messages : null;
    if (!messages || !messages.length) {
      return res.status(400).json({ error: "messages 가 필요합니다." });
    }
    // 마지막 사용자 발화로 재고 검색(RAG)
    const lastUser = [...messages].reverse().find((m) => m.role === "user");

    // API 키가 없으면 → 규칙 기반 더미 AI(데모)로 폴백. 실재고만 근거로 응답.
    if (!API_KEY) {
      const { answer, used } = demoAnswer(lastUser?.content || "", getInventory());
      return res.json({ answer, used, model: "demo-rule-based", demo: true });
    }

    const context = lastUser ? retrieve(lastUser.content, 25) : [];
    const system = buildSystemPrompt(context);

    const anthropic = new Anthropic({ apiKey: API_KEY });
    const resp = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1200,
      system,
      messages: messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({ role: m.role, content: String(m.content || "") })),
    });
    const text = resp.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");
    res.json({ answer: text, used: context.length, model: MODEL });
  } catch (err) {
    console.error("[/api/chat]", err?.message || err);
    res.status(500).json({ error: "AI 응답 생성 중 오류가 발생했습니다." });
  }
});

/* prod: 빌드된 프론트 서빙 (dev 에서는 vite 가 UI 담당) */
const DIST = path.join(ROOT, "client", "dist");
if (fs.existsSync(path.join(DIST, "index.html"))) {
  app.use(express.static(DIST));
  app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(path.join(DIST, "index.html")));
}

/* 로컬/Node 호스트로 직접 실행할 때만 리슨한다.
   Vercel 등 서버리스에서는 api/index.js 가 이 app 을 핸들러로 import 하므로 listen 하지 않는다. */
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  app.listen(PORT, () => {
    console.log(`[server] http://localhost:${PORT}  · model=${MODEL} · apiKey=${API_KEY ? "set" : "MISSING(데모)"} · auth=${ACCESS_HASH ? "on" : "OFF"} · SKU=${getInventory().meta?.count || 0}`);
  });
}

export default app;
