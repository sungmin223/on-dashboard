# 영업ON본부 AI 업무혁신 통합 대시보드 — 정적 웹 배포

대표님 및 타 부서 인원이 **별도 설치 없이 웹 브라우저로** 확인할 수 있는 정적 대시보드입니다.
CSS·JS가 모두 단일 HTML에 인라인되어 있어 **외부 의존성이 전혀 없습니다**(오프라인 동작, CDN/서버 불필요).

---

## 폴더 구조
```
yeongup-on-dashboard/
├── dashboard.html      # 소스(원본). 데이터·화면 수정은 여기서
├── build.js            # 빌드: dashboard.html → dist/index.html 복사
├── dist/
│   └── index.html      # ★ 배포 대상 (이 폴더만 올리면 됨)
├── package.json        # build / serve / deploy 스크립트
├── netlify.toml        # Netlify 설정
├── vercel.json         # Vercel 설정
└── README.md           # (이 문서)
```
- **진입 파일**: `dist/index.html`
- **파일명 영문화 완료**, 로컬 절대경로(`C:\...`, `file://`)·외부참조 **0건**.
- `dist/` 폴더만 다른 PC·웹서버·정적 호스팅에 올려도 그대로 동작합니다.

---

## 1) 로컬 테스트 (배포 전 확인)
사전 준비: Node.js 설치([nodejs.org](https://nodejs.org)).

```bash
# 프로젝트 폴더에서
npm run build        # dist/index.html 생성
npx serve dist       # http://localhost:3000 으로 미리보기 (Ctrl+C 종료)
```
- `dist/index.html`을 그냥 **더블클릭**해도 동일하게 열립니다(파일 단독 동작).

---

## 2) 공유 URL 만들기 — 배포 명령어

### A. Vercel (권장, 무료)
```bash
npm i -g vercel          # 최초 1회 (또는 npx vercel 사용)
vercel login             # 이메일/깃 로그인
vercel --prod            # 배포 → 공유 URL 출력 (예: https://yeongup-on-dashboard.vercel.app)
```
> `vercel.json`이 빌드(`npm run build`) 후 `dist`를 게시하도록 설정되어 있습니다.
> 또는 `dist`만 바로 배포: `cd dist && vercel --prod`

### B. Netlify (무료)
```bash
npm i -g netlify-cli     # 최초 1회 (또는 npx netlify-cli 사용)
netlify login
npm run build
netlify deploy --dir=dist --prod   # 배포 → 공유 URL 출력
```
> 또는 GUI: [app.netlify.com](https://app.netlify.com) → "Add new site" → 폴더 드래그앤드롭으로 `dist` 업로드.

### C. 가장 간단 — 드래그앤드롭 (CLI 불필요)
1. [app.netlify.com/drop](https://app.netlify.com/drop) 접속
2. **`dist` 폴더를 통째로 드래그**해서 놓기
3. 즉시 `https://...netlify.app` 공유 URL 생성 → 대표님·타 부서에 링크 전달

### D. 사내 정적 호스팅
- `dist/` 폴더를 사내 웹서버(IIS/Nginx/Apache)의 공개 디렉터리에 복사하면 끝.

---

## 3) 갱신(데이터 업데이트) 절차
```bash
# 1) dashboard.html 에서 수정
# 2) 빌드
npm run build
# 3) 재배포
vercel --prod            # 또는 netlify deploy --dir=dist --prod
```

---

## ⚠ 보안 안내 (중요)
본 대시보드에는 **실제 거래처명·매출·채권 등 내부 정보**가 포함되어 있습니다.
- Vercel/Netlify 기본 배포 URL은 **링크를 아는 사람은 누구나 접근**할 수 있습니다.
- **외부 공개가 부담되면** 아래를 권장합니다.
  - Vercel/Netlify의 **비밀번호 보호 / 접근 제한**(팀·유료 플랜) 기능 사용, 또는
  - **사내 인트라넷(내부망) 호스팅**만 사용, 또는
  - URL을 추측 불가하게 두고 **내부에만 공유**.
- 회사 보안 정책을 우선 확인하시고 배포 대상을 결정하세요.
