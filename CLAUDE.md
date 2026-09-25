# signal-ml-portfolio

ML 엔지니어 포트폴리오 사이트. 사이트 브랜드는 **SIGNAL**.

Awwwards / FWA 수준의 인터랙티브 디자인을 가진 **취업·이직용 개발자 포트폴리오**. 목표 포지션은 **ML 엔지니어**.

## 현재 상태 (2026-09-24, 맥북에서 작업 후 정리)

**구현은 끝났고, 공개 전 준비만 남았다.** 계획 1·2·3·4-1·4-2가 모두 main에 병합되어 운영 사이트에 배포돼 있다.

- 운영: https://signal-ml-portfolio.vercel.app (아직 `noindex` — 공개 전환 전)
- GitHub: https://github.com/hyde0395/signal-ml-portfolio (공개), main = 운영, PR = Vercel 미리보기
- CI(GitHub Actions): 타입 검사 → 단위 테스트 → 빌드 → 용량 검사 → e2e(desktop·mobile, axe)

| 계획 | 내용 | 계획서 | 상태 |
|---|---|---|---|
| 1 기반 | 텍스트 사이트, 3개 언어, 테스트, CI, 배포 | `docs/superpowers/plans/2026-09-23-plan-1-foundation.md` | ✅ |
| 3 3D 지형 | 점 지형, 지도 장면, 예약 곡선, 대체 이미지 | `2026-09-23-plan-3-terrain.md` | ✅ |
| 2 데모 | 미리 계산한 예측 데모, 3-5 예측 구간 띠 | `2026-09-24-plan-2-demo.md` | ✅ PR #1 |
| 4-1 성능·공유 | 초기 JS 분리, 용량 검사, OG 이미지, Web Analytics, 첫 화면 CLS 0 | `2026-09-24-plan-4-1-performance.md` | ✅ PR #2·#3 |
| 4-2 연출·성능 | 3D 판정 대기(LCP), 로딩 화면, 플립 글자판, 제목 리빌, Lenis | `2026-09-24-plan-4-2-motion.md` | ✅ PR #4 |

**운영 측정 (4-2 병합 뒤, Lighthouse 모바일)**: 성능 ko 87 · en 92 · ja 84~89, LCP 1.5 / 1.3 / 2.2~2.4s, CLS 0, TBT 350~500ms, 접근성 100. 초기 JS gzip 139.3KB/150KB, 3D 청크 240.8KB/250KB. 배포 직후 첫 측정은 CDN이 차가워 크게 낮게 나온다(ja 53) — 한 번 더 잰다. 로컬 `npm run lighthouse`는 캐시 없는 서버·소프트웨어 3D라 늘 낮게 나오므로 전후 비교에만 쓴다.

## 다음 세션에서 할 일 (순서대로)

0. **★ 계획 5-1 실행 (2026-09-25 맥북에서 설계·계획 완료, 맥미니에서 실행 예정)**
   - 페이지 구성을 `① PROJECT → ② DATA(플립 보드) → ③ FEATURES → ④ CHARTS`로 바꾸는 개편. 설계 `docs/superpowers/specs/2026-09-25-page-restructure-design.md`, 시안 `docs/superpowers/mockups/2026-09-25/`
   - 브랜치 `feat/page-restructure`(설계·계획·시안 커밋만 있음, 코드는 아직). 받기: `git fetch && git switch feat/page-restructure`
   - 실행: `docs/superpowers/plans/2026-09-25-plan-5-1-structure.md`를 **superpowers:subagent-driven-development**로(사용자 선택). 이미 정한 결정은 다시 묻지 않는다
   - Task 1(`npm run facts`)만 항공권 저장소가 필요하다 — 맥미니의 항공권 `.venv`나 `~/.venvs/airfare-py311`, 실행 전 iCloud 워밍
   - 5-1이 끝나면 계획 5-2(배경 점 → 피처 덩어리·차트 4개), 5-3(점 마우스 반응·덩어리 펼치기·차트 만지기)를 writing-plans로 쓴다. 설계 §4·§4.1·§5가 범위
1. **공개 전 준비 (사용자 작업 위주, 스펙 §14)**
   - 이력서 PDF 3개: `public/resume/{ko,en,ja}.pdf` (내려받을 때 `CHOI_HALIM_resume_<언어>.pdf`). 파일이 생기면 헤더·연락처의 "준비 중"이 자동으로 링크가 된다
   - 문구 검토: 한국어는 사용자, 영어는 사용자, 일본어는 사용자가 섭외한 검수자(학과 일본어명 포함). 데모 문구(`content/*.json`의 `demo`)도 포함
   - LinkedIn 주소: `data/facts.json`의 `contact.linkedin` (비어 있으면 버튼 숨김)
   - 공개용 항공권 저장소: 만들면 `facts.json`의 `codeLinks.baseUrl`만 바꾼다(그 전까지 "코드 보기" 404는 의도된 상태). 그 저장소도 커밋 이메일 noreply
   - Vercel 대시보드 → 프로젝트 → Analytics에서 Web Analytics 켜기
2. **공개 전환**: 위가 끝나면 `src/lib/site.ts`의 `LAUNCHED = true` (noindex·`robots.txt` Disallow 해제). 사용자가 정한다
3. **남은 개선 (급하지 않음)**
   - 성능 ko·ja 90: 남은 몫은 TBT(3D·연출 코드의 메인 스레드 점유)와 ja의 렌더 지연. `experimental.inlineCss`는 시험 후 되돌림(HTML이 커져 ko·ja 악화, 스펙 §8.2). 다음 후보: 3D 시작을 더 늦추기(첫 입력·스크롤 뒤), 지형 점 구름 만들기를 Web Worker로
   - 휴대폰 3-5 예측 구간 띠: 지형 출발일과 맞는 날만 세우고 점을 키웠지만 세로 화면에서 흩어진 흰 점으로 보인다. 사용자가 2026-09-24 "이대로" 승인 — 다시 손볼지는 사용자에게 묻는다
   - 계획 4-2 최종 검토의 작은 지적(`flip.ts`는 글자를 코드 포인트 단위로 나눔, 리빌은 제목 안쪽 마크업을 지움 — 지금 제목은 모두 글자만이라 문제없음)
4. 재학습으로 수치가 바뀌면: `npm run facts` → `npm run terrain` → `npm run demo` → `npm run build` → `npm run fallbacks` → `npm run og` → 커밋(README 참고)

**작업 방식**: 새 기능은 `superpowers:brainstorming`(필요하면) → `superpowers:writing-plans` → 사용자가 고른 실행 방식(지금까지는 subagent-driven-development). 브랜치 → PR → CI 통과 → 사용자 확인 → main에 fast-forward 병합 → 운영 확인. 이미 정해진 결정은 다시 묻지 않는다.

## 다른 컴퓨터(맥미니·맥북)에서 이어서 하기

1. 받기: 처음이면 `git clone git@github.com:hyde0395/signal-ml-portfolio.git ~/dev/signal-ml-portfolio`, 이미 있으면 `git switch main && git pull --ff-only`
2. **커밋 이메일을 이 저장소에 설정** (clone으로 안 따라온다): `git config user.email "55799748+hyde0395@users.noreply.github.com"` · `git config user.name hyde0395`
3. **push는 SSH 원격으로** 한다(`git remote -v`가 `git@github.com:…`인지 확인, 아니면 `git remote set-url origin git@github.com:hyde0395/signal-ml-portfolio.git`). HTTPS(gh 토큰)는 `workflow` 권한이 없어 `.github/workflows/`를 바꾸는 push가 거절된다(`gh auth refresh -s workflow`로 권한을 더하는 방법도 있다)
4. Node 24(`.nvmrc`) → `npm ci` → `npx playwright install chromium` → `npm test` · `npm run build` · `npm run size` · `npm run e2e`
5. 데이터 스크립트(`npm run facts|terrain|map|demo|pytest`)만 항공권 저장소가 필요하다. 사이트 빌드·테스트에는 필요 없다(JSON은 커밋되어 있음)
   - 항공권 저장소 `~/Documents/airfare-forecasting-ml`는 iCloud로 동기화되지만 `.venv`는 기기마다 깨진다. **그 `.venv`를 지우거나 다시 만들지 않는다**(삭제가 다른 기기로 동기화된다)
   - 대신 기기마다 iCloud 밖에 `~/.venvs/airfare-py311`을 만든다: `brew install python@3.11` → `"$(brew --prefix python@3.11)/bin/python3.11" -m venv ~/.venvs/airfare-py311` → `~/.venvs/airfare-py311/bin/pip install -r ~/Documents/airfare-forecasting-ml/requirements.txt pytest`. `scripts/py.sh`가 AIRFARE_PYTHON → `~/.venvs/airfare-py311` → 항공권 저장소 `.venv` 순서로 고른다(맥북에는 2026-09-24에 만들어 둠)
   - 모델을 돌리기 전에 그쪽 CLAUDE.md의 iCloud 워밍 절차를 따른다
6. `.superpowers/`(비주얼 컴패니언 시안, 작업 기록)와 `.lighthouse/`는 git에 없다. Claude 메모리(`~/.claude/projects/…`)도 기기마다 따로다 — 필요한 규칙은 모두 이 파일에 있다
7. 맥북에서는 이 저장소가 `~/dev/untitled folder/signal-ml-portfolio`에 clone되어 있다(맥미니는 `~/dev/signal-ml-portfolio`). 경로만 다르고 내용은 같다

**CI에서 가끔 보는 일시 오류**: 빌드 중 `Can't resolve '@vercel/turbopack-next/internal/font/google/font'` — Google Fonts를 못 받아서다. 코드 문제가 아니므로 실패한 작업만 다시 돌린다(`gh run rerun <id> --failed`).

## 확정된 결정

- **용도**: 취업·이직용. 채용 담당자가 30초~1분 안에 "누구, 무엇을 잘함, 대표 프로젝트"를 파악할 수 있어야 한다. 연출은 정보를 가리지 않는 선에서.
- **콘셉트**: **B. 가격 지형(Price Landscape)** + **A. 플립 글자판(split-flap)** 포인트
  - 실제 수집 데이터로 3D 지형을 만든다. 축은 x=출발까지 남은 일수, z=출발일, 높이=가격.
  - U자 예약 곡선은 골짜기, 공휴일 가격 급등은 봉우리로 보인다.
  - 플립 글자판은 수치와 섹션 제목(`GATE 01 — PROBLEM` 등)에만 쓴다.
- **기술 스택**: Next.js (App Router) + React Three Fiber + GSAP ScrollTrigger + Lenis. 정적 export를 Vercel에 배포.
- **데모**: 모델이 아직 배포 전이므로, 미리 계산한 예측 결과를 JSON으로 넣어 서버 없이 동작하게 한다. "미리 계산된 예측 · 2026-09-22 기준"을 표기하고, 나중에 실제 API로 교체할 수 있게 만든다.
- **이름**: 저장소 `signal-ml-portfolio`(대표 프로젝트 `airfare-forecasting-ml`과 같은 형식), 사이트 브랜드 `SIGNAL`. "잡음을 걷어내고 신호를 찾는다"는 메시지이며, 첫 화면에 `SIGNAL / NOISE` 플립 연출을 쓸 수 있다.
- **수치 관리**: 재학습하면 수치가 바뀌므로 콘텐츠와 수치는 데이터 파일 한 곳에 모은다.

### 페이지 구성 (한 페이지 스크롤, 승인됨)

0. 로딩 화면: `LOADING 242,874 ROWS` 플립 카운터
1. 첫 화면: 점들이 모여 가격 지형이 되고 마우스에 반응. 이름, `ML ENGINEER`, 한 줄 소개
2. 소개: 2~3줄과 핵심 역량
3. 케이스 스터디 "한·일 항공권, 언제 사야 할까?": 스크롤하면 카메라가 지형 위를 비행
   - 3-1 문제와 데이터
   - 3-2 핵심 인사이트: U자 곡선, 공휴일 봉우리
   - 3-3 R² 거품 빼기: 잘못 매칭된 9,387개 점이 떨어져 나가는 연출
   - 3-4 검증 설계: 평가 방식 3종 비교
   - 3-5 예측 구간 보정: q10~q90 띠 연출
   - 3-6 한계와 다음 단계
4. 인터랙티브 데모: 노선과 출발일 선택 → 가격 구간과 구매/대기 추천
5. 기술 스택: 파이프라인 도식
6. 연락처: 탑승권 카드 (이메일, GitHub, LinkedIn, 이력서 PDF)

- 항상 보이는 **이력서 다운로드** 버튼과 언어 전환 (30초 요약은 2026-09-23 사용자 요청으로 제거, 휴대폰 메뉴 버튼도 없음)
- `prefers-reduced-motion`이나 저사양 모바일에서는 3D 대신 정적 이미지로 대체하고, 콘텐츠는 모두 읽을 수 있게 유지

### 비주얼 시스템 (승인됨)

- **배경과 색 (A. Midnight Signal)**: `#070B16`(배경), `#13203A`(배경 그라데이션), `#8FB8FF`(데이터 점), `#EEF3FF`(텍스트)
- **포인트 색**: 호박색 `#FFB547` (공휴일 봉우리, 플립 글자판, 강조 수치)
- **글꼴 (B)**: 제목 Space Grotesk Bold 대문자(자간 -0.03em), 본문 Pretendard, 수치와 글자판 IBM Plex Mono
- **모션 규칙**
  - 플립 글자판: 글자당 약 40ms, 전체 0.8초 이내
  - 텍스트 리빌: 단어 단위로 아래에서 떠오름, 0.9초, 단어당 60ms 지연
  - 이징은 `cubic-bezier(.16,1,.3,1)`(expo.out) 하나로 통일, bounce 금지
- 시안 파일: `.superpowers/brainstorm/*/content/visual-style.html`, `visual-style-v2.html` (git에 없음, 처음 작업한 맥미니에만 있다)

### 3D 지형과 데이터 파이프라인 (승인됨)

- **데이터 추출 스크립트** (`scripts/`): `scripts/py.sh`가 고른 파이썬(AIRFARE_PYTHON → `~/.venvs/airfare-py311` → 항공권 저장소 `.venv` 순서)으로 실행하고 결과를 `public/data/`에 저장. 사이트는 JSON만 읽으므로 빌드·배포에 항공권 저장소가 필요 없다.
  - `export_terrain.py`: 원본 CSV + 항공권 저장소의 필터 함수(`src/processing/features.py`를 import해 재사용) → `terrain.json`
  - `export_demo.py`: `v2_predictor.pkl` + `recommend_action()` → `demo.json`
  - `export_facts.py`: 사이트에 나오는 모든 수치를 한 곳에 → `facts.json` (항공권 저장소 CLAUDE.md 기준)
- **지형 (2026-09-23 실제 데이터로 수정, 스펙 §5.2·5.2.1)**
  - 높이 = **노선·등급 평균 대비 %** (같은 편 기준은 공휴일 봉우리를 지워서 바꿈)
  - **신호 + 잡음 두 겹**: 칸 평균 약 2,070개(밝은 점) + 칸×노선×등급 약 24,500개(흐린 점). 데이터는 대각선 띠 모양
  - 3-1 챕터: 점들이 **한·일 해안선 + 노선 궤적**을 이루다가 3-2에서 지형으로 접힘 (Natural Earth 50m)
  - 공휴일 ±3일 호박색, 빈 칸 보간 없음, 9,387행은 별도 레이어(3-3에서 떨어져 나감), gzip ≤300KB
- **데모 데이터**
  - 기준일 2026-09-22, 6개 노선 × 등급(LCC/FSC) × 출발일 D+3~90 (모델 `MAX_DTD = 90`)
  - 조합마다 예측가, q10~q90 구간, 추천(BUY_NOW / DROP_EXPECTED / WAIT)과 이유
  - 대표 편은 최근 3주 관측 50건 이상인 편 중에서 고른다 (항공권 저장소 시뮬레이션 기준과 동일)
  - 용량 목표 약 500KB 이하, 넘으면 출발일을 주 단위로 줄인다
  - 모델 실행 시 항공권 저장소 CLAUDE.md의 iCloud 워밍 절차와 NP 로그 억제(`redirect_stdout`)를 참고한다
- **사이트 3D 구조**
  - 화면 뒤에 고정된 캔버스 하나, 스크롤 위치에 따라 카메라가 챕터별 지점으로 이동
  - 점은 `Points` 하나로 그리고, 흩어지기·모이기·떨어져 나가기는 셰이더에서 계산
  - 3D는 첫 화면 텍스트가 뜬 뒤 지연 로딩

### 데모·배포·성능·접근성 (설계 4/4, 승인됨)

- **데모 화면 (B1)**: 문장형 선택 "〔노선〕 가는 〔LCC/FSC〕를 〔출발일〕에 타려면, 지금 살까요?" + 바로 아래 **출발일 막대**(D+3~90, 높이=기준일에 사면 예측가, 공휴일 주변 호박색)가 날짜 선택기 역할. 누르기·끌기·←/→(Home/End). 결과: 플립 가격 → q10~q90 띠 → 추천 배지 + 이유, 확신도는 WAIT/DROP일 때만. "미리 계산된 예측 · 2026-09-22 기준" 항상 표기. 초기 선택값은 DROP_EXPECTED가 나오는 조합(`facts.json`에서 지정). 시안: `.superpowers/brainstorm/14017-*/content/demo-layout-v2.html`
- **데이터 접근 계층**: `ForecastSource` 인터페이스(`getStrip`, `getForecast`, `meta`). 지금은 `StaticForecastSource`(`demo.json`)만, 나중에 `ApiForecastSource`로 교체. 불러오기 실패 → 안내 + 다시 시도, 예측 없는 날짜 → 회색 점선·선택 불가
- **배포**: `output: 'export'` → Vercel, GitHub 연결(main=운영, PR=미리보기). JSON·이력서 PDF는 커밋. JSON은 파일명에 버전(예: `demo.2026-09-22.json`). 글꼴은 `next/font`. **도메인: 우선 무료 `*.vercel.app`**, 나중에 연결
- **성능**: 첫 화면 텍스트는 HTML에 포함 → 로딩 화면은 최대 1.2초 고정 연출(재방문 시 생략) → 3D·`terrain.json` 지연 로딩 → `demo.json`은 데모 섹션 근처에서 로딩. 목표: LCP ≤2.5s(중급 폰 4G), 초기 JS ≤150KB gzip, 3D 묶음 ≈250KB, CLS <0.1, 60/30fps, Lighthouse 모바일 ≥90. 모바일 점 절반·DPR ≤1.5, 30fps 미만 2초 지속 시 단계적 하향 → 정적 이미지. 화면 밖이면 렌더 중지. 빌드 후 용량 검사 스크립트
- **접근성**: reduced-motion·WebGL 불가·저사양(메모리 ≤2GB)·지속 저프레임 → 챕터별 정적 WebP(실제 3D 장면 캡처 스크립트로 생성), 플립·리빌·Lenis 끔. 건너뛰기 링크, 호박색 포커스 링. 캔버스 `aria-hidden`, 플립은 완성값 낭독, 막대는 슬라이더 역할 + 날짜·가격·공휴일 낭독, 결과 변경은 조작 멈춘 뒤 한 번 알림. WCAG AA 대비, 색만으로 의미 전달 금지(공휴일 표식·이름표). axe 자동 검사 + 키보드·VoiceOver 수동 점검
- **추가 항목**
  1. 링크 미리보기(OG 이미지: 지형 + 이름 + `ML ENGINEER`), 제목·설명·파비콘
  2. 케이스 스터디 챕터별 "코드 보기" 링크 — 아래 주의 참고
  3. 모바일 전용 챕터별 카메라 위치·화각, 텍스트는 하단 카드
  4. 문구는 Claude가 항공권 저장소 문서 기반 초안 → 사용자 검토. 문구에 숫자 직접 기입 금지, `facts.json` 참조를 테스트로 강제
  5. CI(GitHub Actions): 타입 검사·단위 테스트·용량 검사·axe
  6. Vercel Web Analytics(방문 수, 이력서 다운로드 수)
  - 다른 프로젝트 목록은 넣지 않는다
- **데이터 공개 원칙**: 지형은 %로만, 원본 CSV는 공개하지 않는다
- **언어: 한국어 + 영어 + 일본어 3개 언어로 처음부터** (일본계 회사 지원 고려). 일본어는 사용자가 검수를 받을 수 있다. (승인됨)
  - 주소 `/`(ko 기본)·`/en`·`/ja`, 상단 `KO · EN · JA` 전환, 선택 언어 기억. 브라우저 언어가 다르면 안내만 띄우고 자동 이동은 하지 않는다. 언어별 `lang`·`hreflang`·OG 이미지
  - 문장은 `content/{ko,en,ja}.json`, 수치는 `facts.json`만. 테스트: 숫자 직접 기입 금지(3개 언어) + 세 파일 키 일치
  - 작업 순서: Claude 한국어 초안 → 사용자 검토 → Claude 영·일 초안 → 영어는 사용자, 일본어는 사용자가 섭외한 검수자
  - 데모 문장 틀은 언어별로 따로. `demo.json`에는 추천 이유를 문장 대신 **코드+값**으로 저장하고 사이트가 언어별로 조립한다(형식은 스펙 §6.2 "구현 결과" 참고). 공휴일 이름표도 3개 언어
  - 일본어 페이지만 Noto Sans JP(`next/font` 조각 로딩), ko/en에서는 로딩 안 함. `GATE 01 — PROBLEM` 같은 영어 연출 글자는 공통

> ⚠️ **"코드 보기" 링크는 당분간 404가 뜨는 게 의도된 상태다.** 지금 `github.com/hyde0395/airfare-forecasting-ml`은 비공개(PRIVATE)라서 링크를 눌러도 404가 나온다. 사용자가 나중에 **공개용 저장소를 새로 만들 예정**이다. 그때 바꾸기 쉽도록 저장소 기본 주소와 챕터별 파일 경로는 데이터 파일(`facts.json`) 한 곳에만 둔다. 공개 저장소가 생기면 그 주소만 바꾼다. 그 전까지 404를 "버그"로 고치려 하지 않는다.

### 콘텐츠 (수집 중)

- **이름**: 최하림 / CHOI HALIM / 崔夏林(チェ・ハリム). 첫 화면 큰 제목은 세 언어 공통 `CHOI HALIM`, 아래 작은 글자로 언어별 표기(ko 최하림, en 없음, ja 崔夏林 + 후리가나 チェ・ハリム)
- **한 줄 소개**: 문장 대신 키워드 나열 `ML ENGINEER · 시계열 예측 · 모델 검증 · 데이터 파이프라인` (영·일은 같은 구성으로 번역)
- **학력**: 수원대학교 컴퓨터소프트웨어학과 · 2028년 2월 졸업 예정 / B.S. in Computer Software, The University of Suwon · Expected Feb 2028 / 水原大学 コンピュータソフトウェア学科 · 2028年2月卒業見込み (학과 일본어명은 검수 때 확인). 신입 지원자
- **일정 목표**: 일본 新卒(2028년 4월 입사) 채용이 2027년 봄~여름에 몰리므로 **사이트는 2027년 초까지 완성**
- **핵심 역량**: 항공권 프로젝트에서 증명된 것만 (수집 자동화, 시계열 모델링, 검증 설계, 예측 구간 보정). 다른 경험은 넣지 않는다
- **연락처**: 이메일은 `data/facts.json`의 `contact.emailReversed`(뒤집어 저장, 화면에는 표시, HTML 소스에는 바로 드러나지 않게), GitHub `github.com/hyde0395`(공개용 항공권 저장소도 이 계정에 만들 것을 권함), LinkedIn은 **나중에**(없으면 버튼 숨김)
- **이력서 PDF**: 언어별 3개(ko·en·ja, ja는 履歴書/職務経歴書 형식). `public/resume/`에 두고, 파일이 없는 언어는 버튼을 "준비 중"으로 흐리게 표시
- **문구 톤 (사용자 피드백)**: 슬로건·광고 같은 문장은 "오글거린다"고 싫어한다. 꾸밈 없이 사실만, 담백하게 쓴다

## 대표 프로젝트: 한·일 항공권 가격 예측 (`airfare-forecasting-ml`)

- **저장소 위치**: `/Users/hyde/Documents/airfare-forecasting-ml` (Python 3.11 `.venv`, 모델 `src/models/weights/v2_predictor.pkl`, 원본 `data/raw/flight_prices.csv` 약 30MB)
- 수치의 원본은 그 저장소의 `CLAUDE.md`(가장 자세함)와 `README.md`다. 아래는 요약이며, 사이트 문구를 쓸 때는 원본으로 다시 확인한다.
- ⚠️ 표의 GroupKFold 0.649 / 49,067원은 **lookup 없이(NO lookup)** 측정한 값이다. lookup을 넣으면(서비스 구성) 0.457 / 64,876원. 사이트에 쓸 때 이 구분을 명시한다.
- 실측 예약 곡선 구간별 값: D-1~3 +11.1% / D-4~7 +4.4% / D-8~14 +0.9% / D-15~21 −2.4% / D-22~30 −3.7% / D-31~45 −5.0% / D-46~60 −4.3% / D-61~90 +2.1%
- 출발일 범위 2026-05-15 ~ 2027-02-14 (고유 출발일 180개), 출발까지 일수 최대 147. 수집이 2단계(가까운 출발일은 매일, 먼 출발일은 주 1회)라 먼 구간 데이터는 성기다.
- 포트폴리오 메시지(원본): "미리 사되, 두 달 이상 남았으면 한 달 전후까지는 지켜볼 만하다."

- **노선**: 인천 ↔ 나리타(NRT), 간사이(KIX), 하네다(HND) 6개 노선
- **데이터**: 원본 258,829행 → 필터 후 242,874행. 수집 기간 2026-04-23 ~ 09-22(5개월)
- **수집**: Python, SerpApi(Google Flights 검색 결과), requests, tenacity. GitHub Actions cron이 매일(먼 출발일은 주 1회) 수집해 CSV를 자동 커밋
- **외부 데이터**: yfinance(원/엔 환율), workalendar(한·일 공휴일), 유가
- **모델**: NeuralProphet 하이브리드, Optuna 튜닝(100 trials), 분위수 회귀(q10/q90) + 분포 이동 외삽 보정, SHAP(TreeSHAP)과 XGBoost
- **서비스**: Streamlit 대시보드, Plotly
- **품질**: pytest 테스트 파일 7개
- **결과 (대표값: TimeSeriesSplit)**

  | 평가 방식 | R² | MAE | MAPE |
  |---|---|---|---|
  | TimeSeriesSplit (운영 기준) ★ | 0.637 | 48,235원 | 21.4% |
  | GroupKFold (처음 보는 출발일) | 0.649 | 49,067원 | 20.4% |
  | K-Fold (참고 상한) | 0.668 | 44,196원 | 18.9% |

  - 예측 구간 80% 목표 대비 커버리지 80.2%
- **추천 분포**: 지금 구매 92.1%, 가격 하락 예상 5.9%, 대기 2.0%. 대기 추천은 D-61~90에 몰려 있다.
- **실측 예약 곡선**: 출발이 지난 16,469편 기준 U자 형태이고 폭은 약 16%p. SHAP 일수 효과(D-1~7 +11.6%, D-31~60 −5.9%)와 거의 일치한다.

### 스토리 포인트

1. **"높은 R²는 좋은 모델이 아니다"를 두 번 실증했다.** 초기 R² 0.93은 HND_ICN에 잘못 매칭된 125만 원대 고가 행이 부풀린 전체 값이었고, 무결성 필터로 걸러내자 0.71로 정정됐다(MAE 약 3만 원 그대로). 직항 타당성 필터로 잘못 매칭된 경유 여정 9,387행을 걸러내자 MAE는 그대로인데 R²만 0.84 → 0.64로 떨어졌다.
2. **평가 방식 3종 비교로 누수를 찾았다.** GroupKFold로 train/serve 불일치(새 출발일에서는 lookup 통계가 폴백값으로 떨어짐)를 발견하고, lookup 구성 4개를 각각 재튜닝해 비교했다.
3. **예측 구간을 보정했다.** 고정 80% 구간이 최근 구간에서 69%까지 과소 포함되는 것을 발견하고, 분포 이동 외삽으로 80.2%까지 맞췄다.
4. **추천 편향을 실측으로 판정했다.** 추천이 98% "지금 구매"로 치우친 원인이 모델인지 시장인지 실제 가격 추적으로 가려냈다.
5. **핵심 인사이트**: "언제 사느냐"보다 "언제 떠나느냐"(공휴일·주말)가 가격을 더 크게 흔든다.

### 사이트에 쓸 때 주의점

- R² 0.637은 예전 수치(0.839, 0.93)와 필터 조건이 달라 분모가 다르다. 비교할 때는 "MAE는 유지하고 R² 거품을 뺐다"는 맥락으로만 쓴다.
- 단순 기준선 MAE 48,688원과 모델 MAE 48,235원의 차이가 거의 없다. 숨기지 말고 "한계와 다음 단계" 섹션에서 먼저 밝힌다.
- 모든 수치는 재학습하면 바뀔 수 있다.

## 작업 규칙

- 사용자와는 **한국어**로 대화한다. 설명은 쉬운 말로 하고, 전문 용어는 풀어서 쓴다.
- 질문은 한 번에 하나씩, 가능하면 선택지를 준다.
- 시각적인 결정은 비주얼 컴패니언으로 보여준다. 서버는 `--project-dir ~/dev/signal-ml-portfolio`로 시작한다(폴더 이동으로 포트가 바뀔 수 있으니 새 URL을 사용자에게 알려준다).
- 이 프로젝트는 iCloud 밖(`~/dev/…`)에 둔다. 항공권 저장소(`~/Documents/airfare-forecasting-ml`)는 iCloud 안이라, 추출 스크립트를 돌리기 전에 그쪽 CLAUDE.md의 워밍 절차를 확인한다. `.superpowers/`는 `.gitignore`에 있다.
- **코드 주석 (사용자 요청 2026-09-23)**: 코드에 한국어 주석을 단다. 파일마다 맨 위에 무엇을 하는 파일인지 한두 줄, 그리고 이유가 드러나지 않는 로직에는 "왜 이렇게 했는지"를 적는다. 코드를 한 줄씩 그대로 옮겨 적는 주석은 달지 않는다. 계획서 코드와 구현 에이전트 지시에도 이 규칙을 넣는다.
- **커밋 이메일**: 이 저장소는 GitHub noreply(`55799748+hyde0395@users.noreply.github.com`)로 커밋한다. 개인 이메일이 git 기록에 남으면 사이트의 이메일 숨김이 무의미해진다. 새 기기에서 clone하면 다시 설정한다. 나중에 만들 공개용 항공권 저장소에도 똑같이 적용한다.
- **검색 노출**: 공개 전환 전까지 `noindex`(스위치: `src/lib/site.ts`의 `LAUNCHED`). 공개는 사용자가 정한다.
- **병합**: main에 직접 커밋하지 않는다(문서 한 줄 고침 정도는 예외). 브랜치 → PR → CI → 사용자 확인 → fast-forward 병합. main에 올리면 곧바로 운영 배포된다.
- **성능 예산**: 초기 JS gzip ≤150KB는 CI(`npm run size`)가 지킨다. 무거운 라이브러리(three, zod, gsap, lenis)는 `import()`로만 불러오고, `tests/unit/client-imports.test.ts`가 초기 청크 경계를 검사한다.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
