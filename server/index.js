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
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import { retrieve, getInventory, loadInventory } from "./rag.js";
import { buildSystemPrompt } from "./prompt.js";
import { demoAnswer } from "./demoAnswer.js";

dotenv.config();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PORT = process.env.PORT || 3001;
const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
const API_KEY = process.env.ANTHROPIC_API_KEY || "";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

loadInventory();
const inv = getInventory();
if (!inv.items?.length) {
  console.warn("[server] data/inventory.json 이 없거나 비어 있습니다. `npm run import-data` 를 먼저 실행하세요.");
}

app.get("/api/health", (_req, res) => {
  const m = getInventory().meta || {};
  res.json({ ok: true, model: MODEL, hasApiKey: Boolean(API_KEY), inventory: m });
});

/* 재고 데이터 — 사내 전용(프론트 검색/필터/차트). 가격 포함. */
app.get("/api/inventory", (_req, res) => {
  res.json(getInventory());
});

/* AI 어시스턴트 */
app.post("/api/chat", async (req, res) => {
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

app.listen(PORT, () => {
  console.log(`[server] http://localhost:${PORT}  · model=${MODEL} · apiKey=${API_KEY ? "set" : "MISSING"} · SKU=${getInventory().meta?.count || 0}`);
});
