# 영업ON본부 통합 대시보드 — Stage 4 (로컬 실행)

기존 정적 대시보드(v1)를 **Vite + React 프론트 + 경량 백엔드 프록시** 구조로 발전시킨 버전입니다.
**기존 대시보드 콘텐츠(7개 섹션·수치·텍스트)는 100% 보존**하고, 그 위에 **실재고 데이터 분석**과
**AI 어시스턴트(RAG)**를 추가했습니다.

> ⚠ **공개 배포 금지.** 내부 단가·재고·매출 정보를 포함하므로 **로컬에서만** 실행하세요.
> Claude API 키는 **서버 `.env`에만** 두며, 클라이언트 번들·git에 절대 포함되지 않습니다.

---

## 구성
```
client/                 # Vite + React (UI)
  src/
    App.jsx             # 앱바 + 뷰 전환(대시보드/재고) + AI 패널
    components/
      Gate.jsx          # 비밀번호 게이트(v1 SHA-256 동작 보존)
      LegacyDashboard.jsx  # v1 7개 섹션 그대로 렌더(콘텐츠 보존)
      inventory/Inventory.jsx  # 재고 검색·필터·차트·표
      assistant/Assistant.jsx  # AI 채팅 패널 (/api/chat 만 호출)
    legacy/dashboardLegacy.js  # v1 dashboard.html에서 자동 추출(데이터+섹션)
    theme/apple.css, stage4.css
server/
  index.js              # /api/health, /api/inventory, /api/chat, (prod)정적 서빙
  rag.js                # 재고 검색(코드/바코드/이름/빈티지) → 컨텍스트
  prompt.js             # AI 규칙(존댓말·데이터근거·도매가 플로어)
scripts/
  import-data.mjs       # 엑셀 → data/inventory.json
  gen-legacy.mjs        # v1 dashboard.html → legacy 모듈 재생성
data/
  source/               # (gitignore) 재고표 엑셀 투입 위치
  inventory.json        # (gitignore) 변환 결과
dashboard.html, build.js, dist/  # v1 정적 버전(참고용, main 브랜치)
```

## 로컬 실행
사전: Node.js 18+ 설치.

```bash
# 1) 의존성
npm install

# 2) 환경변수 — 키 입력
cp .env.example .env
#   .env 의 ANTHROPIC_API_KEY 에 Claude API 키 입력 (서버 전용, git 제외)

# 3) 재고 데이터 생성 (엑셀 → JSON)
#   data/source/ 에 재고표(.xls/.xlsx)를 넣거나 경로를 직접 지정
npm run import-data
#   또는: npm run import-data -- "C:\경로\재고표.XLS"

# 4) 개발 모드 (프론트 5173 + 백엔드 3001, /api 프록시)
npm run dev
#   → http://localhost:5173

# 또는 통합 실행 (빌드 후 서버가 UI+API 모두 서빙)
npm run build && npm run start
#   → http://localhost:3001
```

## 데이터 갱신
재고표 엑셀이 바뀌면 새 파일을 `data/source/`에 넣고(또는 경로 지정) **`npm run import-data`** 만 다시 실행하면
`data/inventory.json`이 갱신됩니다. 서버 재시작 시 자동 반영됩니다.

## AI 어시스턴트 규칙 (RAG)
- 질문과 관련된 **실제 재고 행을 먼저 검색**해 그 데이터만 근거로 답합니다.
- 가격·재고를 **추정/창작하지 않으며**, 데이터에 없으면 **“데이터에 없음”**이라고 답합니다.
- 견적 초안에서 **제안가가 도매가보다 낮으면 “⚠ 내부 승인 필요”**를 표시합니다(도매가 미정 시 안내).
- 모든 답변은 **한국어 존댓말**.
- 모델 기본값 `claude-sonnet-4-6` (`.env`의 `ANTHROPIC_MODEL`로 변경: `claude-opus-4-8` 등).

## 보안
- `.env`, 원본 엑셀, `inventory.json`, `client/dist/`는 `.gitignore` 처리.
- 프론트엔드는 `api.anthropic.com`을 **직접 호출하지 않고** 반드시 `/api/chat` 백엔드 프록시를 거칩니다.
- 빌드 산출물에 API 키·SDK가 포함되지 않음을 확인했습니다.

## 브랜치
- 본 작업은 **`feat/stage4-ai`** 브랜치. v1 정적 버전은 `main` / `backup/static-v1` / 태그 `static-v1`에 보존.

> v1(정적 단일 HTML) 안내는 `README.v1.md` 참고.
