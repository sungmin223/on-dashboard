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

---

# 영업ON본부 Sales Intelligence (Stage 5 확장)

기존 대시보드 위에 **외근 영업 실무 4모듈**을 얹은 확장입니다. 재고 932 SKU(실데이터)를
**제품마스터**로 재사용하고, 거래처·납품·페어링·지역선호는 **샘플 CSV**로 시작해 실제 CSV 업로드로 교체합니다.

## 목적 / 사용 대상
- **목적**: 외근 전 "어디부터 갈지"(동선), 외근 중 "무슨 와인을 제안할지"(페어링·입점·지역선호), 외근 후 "결과·다음 액션"(방문결과 메모)을 한 화면에서.
- **대상**: 영업ON본부 직원(도매/소매/업소 담당), 신규 개척·기존 관리 담당, 팀장/본부장 보고.

## 주요 기능 (상단 탭)
| 탭 | 기능 | 데이터 |
|---|---|---|
| 🏠 홈 | 집중관리·재확인 페어링·좌표없음·지역추천 요약 | 전체 |
| 🗺 외근동선 | Haversine 최근접+우선순위 가중 순서, 지도링크, 방문결과 기록 | 거래처 |
| 🍷 페어링가격 | 5G/7G 비교표, 신동/경쟁 구분, 대체추천, 자동 제안메모 | 페어링+제품 |
| 📍 지역선호 | 지역×업장 선호, 신뢰도 A~D, 신동 포트폴리오 매칭 | 지역선호+제품 |
| 🔎 입점검색 | 브랜드/제품 검색→입점 거래처·입점상태·실적 | 제품+납품 |
| 📦 재고분석 | (기존) 932 SKU 분석 | 재고 |
| ✅ 데이터검증 | 누락·중복·매칭오류·좌표없음·오래된정보 점검 | 전체 |

## 필요한 데이터 파일 (CSV)
`data/samples/` 에 **샘플 4종 + 컬럼 규격서(README_데이터컬럼.md)** 가 있습니다. 컬럼 구조는 그 문서 참조.
- `거래처마스터` (account_id·주소·위도·경도·중요도…)
- `납품이력` (account_id·**product_id=재고 품목코드**·출고일·수량·공급가…)
- `페어링리스트` (account_id·glass_type·와인명·신동와인제품여부·확인일·신뢰도…)
- `지역선호도` (대권역·세부지역·업장타입·선호국가/지역/스타일·신뢰도 A~D·데이터출처…)
- **제품마스터** = 기존 `data/inventory.json`(별도 CSV 불필요)

## 업로드 / 다운로드
각 모듈 상단 **데이터 툴바**에서:
- **⬆ CSV 업로드** → 브라우저 localStorage 오버라이드로 즉시 교체(샘플 대체). **새로고침 후 적용.**
- **⬇ 현재 데이터 내보내기** → UTF-8 BOM CSV(엑셀 한글 안전).
- **↺ 샘플로 복귀** → 업로드본 제거.
> 서버 시드를 갱신하려면: CSV를 `data/samples/`에 `*.csv`(샘플은 `*.sample.csv`)로 두고 `npm run build:sales` → `data/sales-seed.json` 재생성.

## 검색 방법 (입점검색)
- 정확/부분/초성(예: `ㄱㅇ`→가야)/영한 혼합. 카테고리·채널·입점상태 필터, 4종 정렬(최근출고/매출/수량/중요도).
- 제품 클릭 → 그 제품의 입점 거래처만. **납품이력 없으면 "납품 이력 없음"** 으로 정직 표기.

## 동선 최적화 기준
1순위 **거리 최소화**(Haversine 최근접 이웃) → **필수(+3)·중요도 A(+1.5km 환산)** 가중으로 핵심 거래처 우선.
점심 12:00~13:00 자동 회피, 평균 18km/h 가정, 운영시간 밖 도착·종료시간 초과 경고.
**좌표 없는 거래처는 자동 제외**(사유 표기). 직선거리이므로 실주행과 차이 가능.

## 페어링 리스트 관리
거래처별 5G/7G 구성·가격, **신동제품여부**(데이터 우선) + 미표기 와인은 **매칭 후보(%·확인 필요)** 제시(자동 확정 안 함).
**대체추천**: 카테고리(부르고뉴/샴페인/토스카나…)+**스타일(레드/화이트/스파클링)** 일치 신동 보유 제품을 재고 우선·전용라벨 후순위로 제안.
확인일 **30/60/90일** 경과 경고.

## 지역선호 분석 기준 — 신뢰도 등급 필수
**A**(실매출/납품) · **B**(거래처 와인리스트) · **C**(담당자 코멘트) · **D**(추정/샘플).
모든 카드에 신뢰도·데이터출처 배지 노출. 현재 대부분 C/D(샘플) → **확정적 시장 단정 금지**.

## 검증 기준 (데이터검증 탭)
주소·좌표 없음 / 거래처명 중복 / 납품이력↔마스터 매칭 오류(고아 account·product) / 비정상 공급가 / 출고일 형식 / 90일+ 미확인 페어링 / 신동 매칭 필요 — 로드된 데이터 기준 **실시간 점검**.

## 정확성 원칙 (전 화면 공통)
- 샘플/업로드 배지 · 신뢰도 A~D · **추천 근거(reason)** 항상 노출.
- 빈 값은 추측 없이 **"확인 필요"**. 데이터 부족 시 **"추천 불가/데이터 부족"**.
- 카테고리는 region/country **자동 추정값**임을 표기.

## 오류 발생 시 체크리스트
1. 화면이 비어 있음 → `npm run build:sales` 실행했는지(시드 생성), 게이트 로그인했는지.
2. 입점검색에 거래처 0 → 납품이력이 샘플/빈 상태. 실제 `납품이력.csv` 업로드.
3. 동선에서 특정 거래처 빠짐 → 위도/경도 비어 있음(검증 탭에서 확인).
4. 업로드해도 안 바뀜 → **새로고침** 필요(localStorage 적용). 헤더가 깨졌으면 컬럼명 일치 확인.
5. 제품 매칭이 이상 → 제품마스터(브랜드/품종) 보강 업로드 권장.

## 향후 확장
- OCR(메뉴판 이미지→페어링 자동입력), 지도 API 실주행거리, 서버 영속화(현재 업로드/방문메모는 브라우저 저장),
  제품마스터 브랜드/품종 컬럼 보강, 권한별 거래처 연락처 노출, 매출 추세/채권 연동.

## Sales 확장 파일 맵
```
data/samples/*.sample.csv + README_데이터컬럼.md   # 샘플 데이터 + 규격서
scripts/build-sales-seed.mjs                       # CSV+재고 → data/sales-seed.json
server/sales.js, /api/sales                        # 시드 로더·라우트(인증)
client/src/lib/  salesData.js csv.js productMaster.js recommend.js geo.js
client/src/components/sales/  Home Portfolio Pairing Region RoutePlan Validate ui DataToolbar
client/src/theme/sales.css
```
