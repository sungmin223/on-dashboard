# 배포 가이드 — 영업ON본부 통합 대시보드 (Stage 4)

이 앱은 **정적 프론트(Vite/React) + 백엔드 API(Express)** 가 결합된 풀스택입니다.
`/api/inventory`, `/api/chat`, `/api/health` 가 백엔드에서 제공되므로 **정적 호스트(Netlify/Vercel static)만으로는 동작하지 않습니다.** Node 런타임이 있는 호스트가 필요합니다.

---

## 1. 프로덕션 실행 방식 (권장: 단일 Express 서버)

빌드하면 `dist/` 가 생성되고, Express 서버가 이 정적 파일과 `/api` 를 **한 프로세스에서 함께** 서빙합니다.

```bash
npm ci                 # 의존성 설치
npm run import-data    # 원본 엑셀 → data/inventory.json 생성 (최초 1회/데이터 갱신 시)
npm run build          # client/dist 빌드
npm start              # node server/index.js  (기본 포트 3001)
```

접속: `http://<호스트>:3001/`

- `Procfile`(`web: npm start`) 포함 — Render/Railway/Heroku 계열에서 그대로 인식.
- 빌드+실행을 한 번에: `npm run preview`.

## 2. 환경변수 (`.env`)

| 변수 | 필수 | 설명 |
|---|---|---|
| `ANTHROPIC_API_KEY` | 선택 | **없으면 규칙 기반 데모 AI로 자동 폴백**(실재고 근거 응답). 넣으면 실제 Claude 로 전환 |
| `ANTHROPIC_MODEL` | 선택 | 기본 `claude-sonnet-4-6` |
| `PORT` | 선택 | 기본 3001 (호스트가 주입하는 `PORT` 사용) |

`.env` 는 절대 커밋하지 마세요(gitignore 처리됨). 키는 호스트의 환경변수 설정에 등록하세요.

## 3. ⚠ 데이터 의존성 (중요)

`data/inventory.json` 은 **내부 단가 보호를 위해 gitignore** 되어 있습니다. 따라서 git 기반 클라우드 배포 시 **리포지토리에 데이터가 포함되지 않습니다.** 배포 호스트에서 다음 중 하나가 필요합니다.

- 호스트에서 `npm run import-data` 실행 (원본 엑셀 `data/source/*` 필요 — 이 역시 gitignore), 또는
- 빌드 파이프라인에서 `data/inventory.json` 을 별도(비공개) 경로로 주입.

데이터가 없으면 서버는 `SKU=0` 으로 뜨고 재고/데모 AI 가 빈 응답을 냅니다.

## 4. 🔒 보안 자세 (배포 전 필독)

- 프론트의 비밀번호 게이트는 **클라이언트 측 SHA-256 해시 대조**입니다. 비밀번호는 서버로 전송되지 않습니다.
- **`/api/*` 엔드포인트에는 서버측 인증이 없습니다.** 즉 `/api/inventory` 를 직접 호출하면 **누구나 내부 공급가·도매가를 조회**할 수 있습니다.
- 따라서 **현재 상태로는 공개 인터넷 배포에 적합하지 않습니다.** 다음 중 하나를 권장합니다.
  - 사내망/VPN 등 **접근이 제한된 내부 호스팅**, 또는
  - 호스트 레벨 접근 제어(IP 허용목록 / Basic Auth / 인증 프록시), 또는
  - **서버측 비밀번호 인증 추가**(미들웨어로 `/api` 보호) — 공개 배포가 필요하면 이 작업을 먼저 진행하세요.

## 5. 정적 호스트 설정 파일에 대하여

리포의 `vercel.json` / `netlify.toml` 은 **정적 프론트 전용**(v1 호환) 설정이라, 그대로 쓰면 `/api` 가 없어 AI·재고가 동작하지 않습니다. 풀스택 배포에는 위 **1번 단일 Express 서버 방식**을 사용하세요.
