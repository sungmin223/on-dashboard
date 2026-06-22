/* Vercel 서버리스 진입점 — Express 앱을 그대로 핸들러로 노출.
   /api/* 요청이 rewrites 로 이 함수에 도달하면, app 의 /api/health·/api/inventory·/api/chat 라우트가 처리한다.
   재고 데이터(data/inventory.json)는 vercel.json 의 functions.includeFiles 로 번들에 포함된다. */
import app from "../server/index.js";
export default app;
