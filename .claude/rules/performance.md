---
paths:
  - "next.config.ts"
  - "scripts/check-size.mjs"
  - "scripts/size-budget.mjs"
  - "scripts/lighthouse.mjs"
  - "src/components/HomePage.tsx"
  - "src/components/RootDocument.tsx"
  - "src/lib/boot.ts"
  - "src/styles/fonts.ts"
  - "src/styles/font-*.ts"
  - "scripts/build-fonts.mjs"
  - "scripts/font-chars.mjs"
  - "tests/unit/client-imports.test.ts"
  - "tests/unit/size-budget.test.ts"
---

# 성능 규칙

- **예산**: 초기 JS gzip ≤150KB(CI `npm run size`가 지킴, 지금 145.5KB), 3D 묶음 ≤280KB(지금 251.8KB), LCP ≤2.5s(중급 폰 4G), CLS <0.1, 60/30fps, Lighthouse 모바일 ≥90
- 무거운 라이브러리(three, zod, gsap, lenis)는 `import()`로만 불러온다. 클라이언트 데이터 검사는 `zod/mini`(지연 청크 17.5KB), 서버(빌드)에서만 도는 `src/lib/facts.ts`는 `zod`. `tests/unit/client-imports.test.ts`가 초기 청크 경계를 검사
- 로딩 순서: 첫 화면 텍스트는 HTML에 포함 → 로딩 화면 최대 1.2초 고정 연출(재방문 시 생략) → 3D·`terrain.json` 지연 로딩 → `demo.json`은 데모 섹션 근처에서
- 글꼴은 `next/font`. 배포는 `output: 'export'` → Vercel
- **본문·일본어 글꼴은 사이트 글자만 남긴 로컬 서브셋**(2026-10-08): `npm run fonts`(`scripts/build-fonts.mjs`)가 `src/styles/font-files/`에 pretendard-ko(약 80KB)·pretendard-latin(약 31KB)·noto-sans-jp(약 210KB)를 만든다(커밋). 문구에 새 글자가 생기면 `tests/unit/font-subset.test.ts`가 실패 → 다시 돌려 함께 커밋. 로케일별 정의 `src/styles/font-{ko,en,jp}.ts`, **preload는 끈다** — 루트 레이아웃이 로케일마다 따로라 Next가 미리 받기 글꼴을 모든 페이지에 넣는다(켜면 ko가 ja·en 글꼴까지 받음). 예전 Pretendard 동적 서브셋(92조각)은 페이지 전체 글자 때문에 첫 화면 전 25~40조각(650~850KB)을 받았다
- **CLS 0**: 첫 화면 아래 여백(`html.hero-runway`)은 부트 스크립트가 첫 그리기 전에 붙인다(`src/lib/boot.ts`) — 3D가 켜진 뒤 붙이면 휴대폰에서 머리말이 밀린다(0.067이었다). e2e `airport.spec.ts` 휴대폰 CLS 검사
- Lighthouse가 LCP 전 요청을 셀 때 로컬 `serve`는 파일을 몇 ms에 주어 글꼴이 늘 포함된다 — 글꼴 효과는 운영 측정이 정확하다. Vercel 미리보기는 로그인 보호라 Lighthouse를 못 돌린다

## 최적화 (2026-10-08, 계획 `docs/superpowers/plans/2026-10-08-performance.md` — 끝에 결과)
- 원칙: 연출·화질·점 개수·접근성 100·CLS 0은 그대로 두고 수치만. 측정은 `npm run lighthouse -- --runs=3`(로컬 `out/`) / `-- --runs=3 --base=https://signal-ml.vercel.app`(운영), 3회 중앙값
- 목표: 성능 ko·en·ja ≥90, TBT ≤200ms, LCP ≤2.0s
- 한 것: CLS(부트 여백), 글꼴 서브셋, `formatValue` Intl 재사용, 3D 판정을 한가한 때로, `compileAsync`(다음 작업), 점 구름·공항 불빛 별도 작업, `zod/mini`
- 남은 후보(운영 목표 ≥90은 넘어 급하지 않다): 3D 데이터 처리 Web Worker·`scheduler.yield()`(남은 긴 작업: three 청크 실행 약 160ms·하이드레이션 약 100ms·3D 마운트 약 85ms, CPU 4배), `terrain.json` 이진화, 제거 레이어(`removed` 1,606점)·`uRemoved`·`uDrop` 정리, 대체 이미지 AVIF, DPR·저프레임 문턱(줄이기 전에 사용자와). 되돌린 것: `experimental.inlineCss`

## 운영 측정 기록 (Lighthouse 13 모바일, `npm run lighthouse -- --runs=3 --base=https://signal-ml.vercel.app`)
- **2026-10-08 최적화 뒤(PR #35)**: 성능 ko 93 · en 97 · ja 95, LCP 2.41 / 1.96 / 2.05s, TBT 242 / 164 / 202ms, CLS 0, 접근성 100
- 2026-10-08 최적화 전: 성능 ko 86 · en 86 · ja 76, LCP 2.96 / 3.01 / 3.47s, TBT 376 / 296 / 398ms, CLS 0.067
- (4-2 뒤: 성능 ko 87 · en 92 · ja 84~89, LCP 1.5 / 1.3 / 2.2~2.4s, CLS 0, TBT 350~500ms)
- 배포 직후 첫 측정은 CDN이 차가워 낮게 나온다(각 언어 1회째) — 3회 중앙값으로 본다
