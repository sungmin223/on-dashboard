// build.js — 정적 빌드: 소스(dashboard.html)를 dist/index.html 로 복사
// 외부 의존성/번들 불필요. 단일 자기완결형 HTML을 dist 진입파일로 내보낸다.
const fs = require("fs");
const path = require("path");

const root = __dirname;
const src = path.join(root, "dashboard.html");
const distDir = path.join(root, "dist");
const out = path.join(distDir, "index.html");

if (!fs.existsSync(src)) {
  console.error("[build] 소스 파일이 없습니다:", src);
  process.exit(1);
}
fs.mkdirSync(distDir, { recursive: true });
fs.copyFileSync(src, out);

const bytes = fs.statSync(out).size;
console.log(`[build] 완료 → dist/index.html (${bytes.toLocaleString()} bytes)`);
console.log("[build] 정적 배포 준비 완료 · 외부 의존성 없음(오프라인 동작)");
