import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3001;

// 프론트(개발 서버)는 /api 호출을 백엔드 프록시로 전달한다.
// 프론트는 절대 api.anthropic.com 을 직접 호출하지 않는다.
export default defineConfig({
  root: __dirname,
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": { target: `http://localhost:${PORT}`, changeOrigin: true },
    },
  },
  build: {
    outDir: resolve(__dirname, "dist"),
    emptyOutDir: true,
  },
});
