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
  - "tests/unit/client-imports.test.ts"
  - "tests/unit/size-budget.test.ts"
---

# 성능 규칙

- **예산**: 초기 JS gzip ≤150KB(CI `npm run size`가 지킴, 지금 143.8KB), 3D 묶음 ≤280KB(지금 249.4KB), LCP ≤2.5s(중급 폰 4G), CLS <0.1, 60/30fps, Lighthouse 모바일 ≥90
- 무거운 라이브러리(three, zod, gsap, lenis)는 `import()`로만 불러온다. `tests/unit/client-imports.test.ts`가 초기 청크 경계를 검사
- 로딩 순서: 첫 화면 텍스트는 HTML에 포함 → 로딩 화면 최대 1.2초 고정 연출(재방문 시 생략) → 3D·`terrain.json` 지연 로딩 → `demo.json`은 데모 섹션 근처에서
- 글꼴은 `next/font`. 배포는 `output: 'export'` → Vercel

## 최적화 계획 (맨 마지막, effort high 이상, 별도 계획서)
- 연출·화질·점 개수·접근성 100·CLS 0은 그대로 두고 수치만. 배포 미리보기에서 Lighthouse 모바일 3회 중앙값으로 전후 비교. 로컬 `npm run lighthouse`는 전후 비교에만
- 목표: 성능 ko·en·ja ≥90, TBT ≤200ms, LCP ≤2.0s
- 후보: 3D 시작 더 늦추기·점 구름 만들기 Web Worker·`scheduler.yield()`, `@next/bundle-analyzer` 뒤 첫 화면 밖 코드 `import()`, 3D 청크 zod 제거·three 이름 가져오기, `terrain.json` 이진화, ja 글꼴, 대체 이미지 AVIF, DPR·저프레임 문턱(줄이기 전에 사용자와). 되돌린 것: `experimental.inlineCss`

## 운영 측정 기록 (4-2 뒤, Lighthouse 모바일)
- 성능 ko 87 · en 92 · ja 84~89, LCP 1.5 / 1.3 / 2.2~2.4s, CLS 0, TBT 350~500ms, 접근성 100
- 배포 직후 첫 측정은 CDN이 차가워 낮게 나온다 — 한 번 더 잰다
