# 성능 최적화 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 연출·화질·점 개수·접근성은 그대로 두고 Lighthouse 모바일 성능 ko·en·ja ≥90(목표 LCP ≤2.0s, TBT ≤200ms, CLS 0)으로 올린다.

**Architecture:** (1) 3D가 켜질 기기면 부트 스크립트가 첫 그리기 전에 첫 화면 아래 여백 클래스를 붙여 CLS를 없앤다. (2) Pretendard 동적 서브셋(92조각, 페이지당 25~40개·650~850KB)을 사이트에 실제로 나오는 글자만 남긴 언어별 woff2 한 개로 바꾸고(빌드 전 생성·커밋, 테스트가 빠진 글자를 잡는다), 일본어 Noto Sans JP도 같은 방식으로. (3) 3D 첫 프레임에서 셰이더 컴파일을 `compileAsync`로 떼어 낸다. (4) 클라이언트 데이터 검사를 `zod` → `zod/mini`로 바꿔 지연 청크를 줄인다.

**Tech Stack:** Next.js 16(정적 export, `next/font/local`), React Three Fiber 9 / three r186, zod 4(`zod/mini`), `subset-font`·`harfbuzzjs`(글꼴 서브셋, 개발 때만), Vitest, Playwright, Lighthouse 13.

---

## 기준 측정 (2026-10-08, 운영 https://signal-ml.vercel.app, Lighthouse 13 모바일 3회 중앙값)

| | 성능 | LCP | TBT | FCP | CLS |
|---|---|---|---|---|---|
| ko | 86 | 2.96s | 376ms | 1.82s | 0.067 |
| en | 86 | 3.01s | 296ms | 2.11s | 0.067 |
| ja | 76 | 3.47s | 398ms | 2.27s | 0.067 |

분석(근거):
- **LCP**: LCP 요소는 첫 화면 `SIGNAL` h1(Space Grotesk, 미리 받음). 실제 그려지는 시각은 0.2~0.3s인데, Lighthouse 시뮬레이션은 LCP 전에 시작한 요청을 모두 LCP 경로에 넣는다. 첫 배치 때 페이지 전체 글자 때문에 Pretendard 조각 25개(ko 약 650KB)·Noto Sans JP 조각 40개(ja 약 830KB)가 VeryHigh로 요청돼 1.6Mbps 가정에서 2~4초를 더한다
- **CLS 0.067**: 3D가 켜진 뒤 `Backdrop.setMode`가 `html.hero-runway`(첫 화면 아래 60vh 여백 + 머리말 230svh)를 붙인다. 첫 화면이 88vh라 휴대폰에서 머리말 윗부분 12vh가 이미 보이고, 그게 60vh 밀린다(`section#intro`)
- **TBT**: 첫 배치(문서 전체 레이아웃 ~170~290ms·글꼴 조각마다 다시 배치), 스크립트 평가(three 청크·react-dom), 3D 첫 프레임(셰이더 컴파일 + 버퍼 올리기가 한 작업)이 긴 작업. 소프트웨어 WebGL의 프레임마다 합성 비용은 Lighthouse TBT에 크게 잡히지 않아 DPR·점 개수는 건드리지 않는다
- 시험 서브셋 크기: Pretendard ko 78.7KB(굵기 400~700) · en/ja 라틴 약 44KB · Noto Sans JP ja 161.8KB(400~600)

**측정 방법**: Vercel 미리보기는 로그인 보호가 걸려 Lighthouse가 못 연다 → 전후 비교는 같은 기기에서 `npm run lighthouse -- --runs=3`(로컬 `out/`)로, 병합 뒤 운영에서 `npm run lighthouse -- --runs=3 --base=https://signal-ml.vercel.app`로 확인한다.

## 파일 구조

| 파일 | 할 일 |
|---|---|
| `scripts/lighthouse.mjs` | 수정: `--runs=N`(기본 3)·`--base=URL`, 회차별·중앙값 출력 |
| `src/lib/boot.ts` | 수정: 3D가 켜질 기기면 `hero-runway`를 첫 그리기 전에 |
| `src/components/Backdrop.tsx` | 주석만: 클래스는 보통 부트가 붙이고, 여기서는 부트가 못 붙인 경우만 |
| `src/styles/globals.css` | 수정: `--font-text` 변수, `.hero-stage` 주석 |
| `tests/unit/boot.test.ts` | 테스트 추가 |
| `tests/e2e/airport.spec.ts` | 여백 클래스 기대 바꿈 + 휴대폰 CLS 0 검사 |
| `scripts/font-chars.mjs` | 새로: 글자 모으기·주석 빼기·파일별 요청 글자(순수 함수) |
| `scripts/build-fonts.mjs` | 새로: `npm run fonts` — 서브셋 woff2 3개 + `subset.json` + 라이선스 |
| `src/styles/font-files/*` | 새로(생성물, 커밋): `pretendard-ko.woff2`·`pretendard-latin.woff2`·`noto-sans-jp.woff2`·`subset.json`·`OFL-*.txt` |
| `src/styles/fonts.ts` | 수정: 동적 서브셋 CSS 대신 `next/font/local` 셋 |
| `src/styles/font-jp.ts` | 수정: Google 대신 로컬 서브셋 |
| `app/(ko|en|ja)/layout.tsx`, `app/global-not-found.tsx` | 수정: 언어별 글꼴 변수 |
| `tests/unit/font-subset.test.ts` | 새로: 페이지 글자 ⊆ 글꼴 요청 글자, 주석 빼기 |
| `tests/e2e/fonts.spec.ts` | 새로: 페이지별 woff2 요청 수·용량 상한, 옛 조각 없음 |
| `src/three/TerrainScene.tsx` | 수정: `Precompile` + 컴파일 끝난 뒤 프레임 시작 |
| `src/three/data.ts`, `src/charts/data.ts`, `src/demo/source.ts` | 수정: `zod/mini` |
| `.claude/rules/performance.md`, `CLAUDE.md`, `.claude/rules/content-i18n.md` | 결과·규칙 기록 |

---

### Task 0: 측정 도구 + 로컬 기준값

**Files:**
- Modify: `scripts/lighthouse.mjs`

- [ ] **Step 1: `scripts/lighthouse.mjs`를 회차·주소 인자를 받게 바꾼다**

```js
// npm run lighthouse [-- --runs=3 --base=https://…]: 세 언어 첫 화면을 Lighthouse(모바일 기본 설정)로 N번 재고
// 회차별 값과 중앙값을 출력한다. --base가 없으면 빌드 산출물(out/)을 띄워 잰다(실행 전 npm run build). CI에서는 돌리지 않는다.
// 성능 규칙: 전후 비교는 3회 중앙값(.claude/rules/performance.md). 브라우저는 Playwright가 설치한 Chromium을 쓴다.
import { execFileSync, spawn } from 'node:child_process';
import { mkdir, readFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=') ?? d;
const RUNS = Number(arg('runs', '3'));
const PORT = 4177;
const BASE = arg('base', `http://localhost:${PORT}`).replace(/\/$/, '');
const local = !process.argv.some((a) => a.startsWith('--base='));
const server = local ? spawn('npx', ['serve', 'out', '-l', String(PORT), '--no-clipboard'], { stdio: 'ignore' }) : null;

// 고정 대기(2.5초) 대신 실제로 응답할 때까지 기다린다 — capture-og.mjs와 같은 패턴(느린 기기에서 2.5초로는 서버가 안 뜰 수 있음)
async function waitForServer(url, timeoutMs = 15_000) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    try { if ((await fetch(url)).status === 200) return; } catch { /* 아직 안 떴음 */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`${url}이(가) 응답하지 않았다`);
}

const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

try {
  // 서버 기동 대기·폴더 준비도 try 안에서 해야 여기서 실패해도 finally가 서버를 꼭 죽인다
  await waitForServer(`${BASE}/`);
  // 배포 직후 CDN이 차가우면 첫 회가 낮게 나온다 — 세 주소를 한 번씩 미리 받는다
  for (const p of ['/', '/en/', '/ja/']) await fetch(`${BASE}${p}`);
  await mkdir('.lighthouse', { recursive: true });
  for (const [locale, path] of [['ko', '/'], ['en', '/en/'], ['ja', '/ja/']]) {
    const rows = [];
    for (let i = 1; i <= RUNS; i++) {
      const out = `.lighthouse/${locale}-${i}.json`;
      execFileSync('npx', ['-y', 'lighthouse@13', `${BASE}${path}`, '--quiet', '--output=json', `--output-path=${out}`,
        `--chrome-path=${chromium.executablePath()}`, '--chrome-flags=--headless=new', '--only-categories=performance,accessibility,best-practices,seo'], { stdio: 'inherit' });
      const r = JSON.parse(await readFile(out, 'utf8'));
      const a = r.audits;
      const row = {
        perf: Math.round(r.categories.performance.score * 100), a11y: Math.round(r.categories.accessibility.score * 100),
        lcp: a['largest-contentful-paint'].numericValue, tbt: a['total-blocking-time'].numericValue,
        fcp: a['first-contentful-paint'].numericValue, cls: a['cumulative-layout-shift'].numericValue,
      };
      rows.push(row);
      console.log(`${locale}#${i}: 성능 ${row.perf} · 접근성 ${row.a11y} | LCP ${(row.lcp / 1000).toFixed(2)}s · TBT ${Math.round(row.tbt)}ms · FCP ${(row.fcp / 1000).toFixed(2)}s · CLS ${row.cls.toFixed(3)}`);
    }
    const m = (k) => median(rows.map((r) => r[k]));
    console.log(`== ${locale} 중앙값(${RUNS}회): 성능 ${m('perf')} · 접근성 ${m('a11y')} | LCP ${(m('lcp') / 1000).toFixed(2)}s · TBT ${Math.round(m('tbt'))}ms · FCP ${(m('fcp') / 1000).toFixed(2)}s · CLS ${m('cls').toFixed(3)}`);
  }
} finally {
  server?.kill();
}
```

- [ ] **Step 2: 로컬 기준값을 잰다(main과 같은 코드)**

Run: `npm run build && npm run lighthouse -- --runs=3`
Expected: 세 언어 `== xx 중앙값` 줄. 이 값을 이 계획서 끝 "결과" 표의 "로컬 전" 줄에 적는다(CLS 0.067 근처, 성능 80~90대).

- [ ] **Step 3: 커밋**

```bash
git add scripts/lighthouse.mjs docs/superpowers/plans/2026-10-08-performance.md
git commit -m "perf: Lighthouse 측정을 N회 중앙값·주소 지정으로 + 최적화 계획서"
```

---

### Task 1: CLS — 3D가 켜질 기기면 여백을 첫 그리기 전에

**Files:**
- Modify: `src/lib/boot.ts`
- Modify: `src/components/Backdrop.tsx`(주석)
- Modify: `src/styles/globals.css:132-137`(주석)
- Test: `tests/unit/boot.test.ts`, `tests/e2e/airport.spec.ts`

- [ ] **Step 1: 실패하는 단위 테스트를 쓴다** — `tests/unit/boot.test.ts`의 `fakeWindow`에 `webgl`·`deviceMemory`를 받게 하고 테스트 넷을 더한다

```ts
function fakeWindow({ reduced = false, search = '', visited = false, storageThrows = false, webgl = true, deviceMemory = undefined as number | undefined } = {}) {
  // … 기존 그대로 …
  const win: Record<string, unknown> = {
    // … 기존 그대로 …
    navigator: { deviceMemory },
    ...(webgl ? { WebGLRenderingContext: function WebGLRenderingContext() {} } : {}),
  };
  // … 기존 그대로 …
}

// describe('BOOT_SCRIPT') 안에 추가
it('3D가 켜질 기기면 첫 그리기 전에 hero-runway(첫 화면 아래 여백)를 붙인다 — 3D가 켜진 뒤 붙이면 휴대폰에서 보이던 머리말이 밀린다(CLS)', () => {
  expect(fakeWindow().classes.has('hero-runway')).toBe(true);
});
it('WebGL이 없으면 여백을 붙이지 않는다(3D가 안 켜진다)', () => {
  expect(fakeWindow({ webgl: false }).classes.has('hero-runway')).toBe(false);
});
it('메모리 2GB 이하면 여백을 붙이지 않는다(canRender3D와 같은 기준)', () => {
  expect(fakeWindow({ deviceMemory: 2 }).classes.has('hero-runway')).toBe(false);
  expect(fakeWindow({ deviceMemory: 4 }).classes.has('hero-runway')).toBe(true);
});
it('움직임 줄이기면 여백을 붙이지 않는다', () => {
  expect(fakeWindow({ reduced: true }).classes.has('hero-runway')).toBe(false);
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/unit/boot.test.ts`
Expected: 새 테스트 중 "붙인다" 두 개 FAIL(`hero-runway`가 없음)

- [ ] **Step 3: `BOOT_SCRIPT` 고치기** — `src/lib/boot.ts`의 `if (!reduced) { … }` 안에, 위 머리 주석에 3) 항목을 더한다

```js
// 머리 주석에 추가:
// 3) 3D가 켜질 기기(WebGL 있음·메모리 2GB 초과 — three/capability.ts canRender3D와 같은 기준)면 첫 그리기 전에
//    html.hero-runway(첫 화면 아래 60vh 여백, 머리말 230svh)를 붙인다. 3D가 켜진 뒤 붙이면 첫 화면이 88vh라
//    휴대폰에서 이미 보이던 머리말 윗부분이 60vh 밀려 CLS가 생겼다(2026-10-08 측정 0.067). 판정이 빗나가 3D가
//    끝내 꺼져도 클래스는 지우지 않는다 — 지우면 그때 콘텐츠가 튄다(Backdrop.tsx setMode와 같은 원칙)

  if (!reduced) {
    d.setAttribute('data-3d', 'pending');
    var mem = w.navigator && w.navigator.deviceMemory;
    if (w.WebGLRenderingContext && !(mem && mem <= 2)) d.classList.add('hero-runway');
    w.${PENDING_TIMER_KEY} = w.setTimeout(function () { if (d.getAttribute('data-3d') === 'pending') d.setAttribute('data-3d', 'off'); }, ${PENDING_TIMEOUT_MS});
  }
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run tests/unit/boot.test.ts`
Expected: 전부 PASS

- [ ] **Step 5: 주석 맞추기** — `Backdrop.tsx` `setMode`의 긴 주석 끝에 "보통은 부트 스크립트(src/lib/boot.ts)가 첫 그리기 전에 이미 붙여 둔다 — 여기서 붙이는 것은 부트가 못 붙인 경우(캡처 모드 등)뿐"을 더하고, `globals.css` `.hero-stage` 주석의 "첫 화면(88vh) 아래라 3D가 켜지는 순간 보이는 글은 움직이지 않는다(CLS 0)"를 "부트 스크립트가 첫 그리기 전에 붙여 3D가 켜져도 아무것도 밀리지 않는다(CLS 0 — 3D가 켜진 뒤 붙이던 때는 휴대폰에서 머리말 윗부분 12vh가 밀렸다)"로 바꾼다

- [ ] **Step 6: e2e 기대 바꾸기** — `tests/e2e/airport.spec.ts`

(a) 23번 줄 주석 "(hero-runway는 첫 프레임 뒤에 붙어 …)"을 "(hero-runway는 부트 스크립트가 첫 그리기 전에 붙인다)"로.

(b) `'#project로 바로 들어오면(이미 스크롤된 채 3D 켜짐) 여백 클래스가 안 붙는다'` 테스트를 바꾼다:

```ts
// 여백 클래스는 부트 스크립트가 첫 그리기 전에 붙이므로(src/lib/boot.ts), #project로 바로 들어와도 3D가 켜지는 순간
// 화면 중간에 여백이 끼어들지 않는다 — #project 위치가 3D 판정 전후로 그대로여야 한다
test('#project로 바로 들어와도 3D가 켜질 때 #project 위치가 그대로다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#project');
  const before = await page.locator('#project').evaluate((n) => n.getBoundingClientRect().top + window.scrollY);
  await expect(page.locator('html')).toHaveAttribute('data-3d', /^(on|off)$/, { timeout: 20_000 });
  const after = await page.locator('#project').evaluate((n) => n.getBoundingClientRect().top + window.scrollY);
  expect(Math.abs(after - before)).toBeLessThanOrEqual(1);
});
```

(c) `'맨 위가 아닐 때 3D가 켜져도, 맨 위로 돌아오면 여백 클래스가 붙는다'`를 바꾼다:

```ts
// 맨 위가 아닐 때(로딩 중 스크롤·새로고침이 위치를 되살림) 3D가 켜져도 여백 클래스는 처음부터 있다 — 맨 위로
// 돌아오면 첫 화면 제목이 화면 안이고, 스크롤로 전환이 계산된다(data-handoff)
test('#project에서 3D가 켜져도 맨 위로 돌아오면 전환이 계산된다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#project');
  await expect(page.locator('html')).toHaveAttribute('data-3d', /^(on|off)$/, { timeout: 20_000 });
  test.skip((await page.locator('html').getAttribute('data-3d')) !== 'on', '3D가 꺼진 환경');
  const html = page.locator('html');
  await expect(html).toHaveClass(/hero-runway/);
  await page.evaluate(() => window.scrollTo(0, 0));
  const title = await page.locator('.hero-title').boundingBox();
  expect(title!.y).toBeGreaterThanOrEqual(0);
  await page.locator('#intro').evaluate((n) => n.scrollIntoView({ block: 'center' }));
  await expect.poll(async () => (await html.getAttribute('data-3d')) !== 'on' || (await html.getAttribute('data-handoff')) !== null).toBe(true);
});
```

(d) 파일 끝(`'움직임 줄이기(3D 꺼짐)'` describe 앞)에 휴대폰 CLS 검사를 더한다:

```ts
// 2026-10-08 측정: 휴대폰(첫 화면 88vh)에서 3D가 켜진 뒤 여백이 붙어 머리말이 밀려 CLS 0.067이었다
test('휴대폰 화면에서 3D가 켜져도 레이아웃 이동이 없다(CLS 0)', async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 823 });
  await page.addInitScript(() => {
    const w = window as Window & { __cls?: number };
    w.__cls = 0;
    new PerformanceObserver((l) => {
      for (const e of l.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) if (!e.hadRecentInput) w.__cls! += e.value;
    }).observe({ type: 'layout-shift', buffered: true });
  });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-3d', /^(on|off)$/, { timeout: 20_000 });
  await page.waitForTimeout(1000);
  expect(await page.evaluate(() => (window as Window & { __cls?: number }).__cls)).toBeLessThan(0.001);
});
```

- [ ] **Step 7: e2e 실행**

Run: `npm run build && npx playwright test tests/e2e/airport.spec.ts --reporter=line`
Expected: 전부 PASS(3D가 꺼진 환경 건너뜀은 그대로)

- [ ] **Step 8: 커밋**

```bash
git add src/lib/boot.ts src/components/Backdrop.tsx src/styles/globals.css tests/unit/boot.test.ts tests/e2e/airport.spec.ts
git commit -m "perf(cls): 3D가 켜질 기기면 첫 화면 아래 여백을 첫 그리기 전에 — 휴대폰 머리말 밀림(CLS 0.067) 제거"
```

---

### Task 2: 글자 모으기 규칙 (`scripts/font-chars.mjs`)

**Files:**
- Create: `scripts/font-chars.mjs`
- Test: `tests/unit/font-subset.test.ts`(이번 태스크는 주석 빼기·글자 모으기 부분만)

글꼴 파일 셋과 각 페이지가 쓰는 파일:
- `pretendard-ko.woff2` — ko 페이지 + 404(ko·en 글자 전부)
- `pretendard-latin.woff2` — en 페이지, ja 페이지의 예비 글꼴(ja의 한자·가나 밖 글자 + 다른 언어 페이지에 뜨는 한국어 언어 안내)
- `noto-sans-jp.woff2` — ja 페이지(ja 글자 전부, 라틴 포함 — 지금처럼 ja 페이지의 라틴도 Noto로 보이게)

- [ ] **Step 1: 실패하는 테스트**

```ts
// 글꼴 서브셋(계획 2026-10-08 성능 Task 2·3): 글자 모으기 규칙과, 지금 문구의 글자가 커밋된 글꼴에 다 있는지
import { describe, expect, it } from 'vitest';
import { requiredChars, requestedChars, stripComments, isHangul, isCjk } from '../../scripts/font-chars.mjs';

describe('stripComments', () => {
  it('줄·블록 주석을 빼고 문자열 안의 // 는 남긴다', () => {
    const code = "const a = 'https://x.y'; // 주석 가\n/* 블록 나 */ const b = \"다\"; {/* JSX 라 */}";
    const out = stripComments(code);
    expect(out).toContain('https://x.y');
    expect(out).toContain('"다"');
    expect(out).not.toMatch(/[가나라]/);
  });
});

describe('requiredChars', () => {
  it('ASCII 인쇄 글자는 언제나 들어간다', () => {
    for (const l of ['ko', 'en', 'ja'] as const) expect(requiredChars(l).has('~')).toBe(true);
  });
  it('ko는 문구의 한글, ja는 문구의 가나·한자가 들어간다', () => {
    expect([...requiredChars('ko')].some(isHangul)).toBe(true);
    expect([...requiredChars('ja')].some(isCjk)).toBe(true);
    expect([...requiredChars('en')].some((c) => isHangul(c) || isCjk(c))).toBe(false);
  });
  it('Intl 날짜·축약 숫자 글자가 들어간다(차트 축 "20만", "10月")', () => {
    expect(requiredChars('ko').has('만')).toBe(true);
    expect(requiredChars('ja').has('月')).toBe(true);
  });
  it('코드 문자열의 기호(→ ₩ −)는 들어가고 개발용 한글 오류 문구는 안 들어간다', () => {
    const en = requiredChars('en');
    for (const c of ['→', '₩', '−']) expect(en.has(c)).toBe(true);
    expect([...en].some(isHangul)).toBe(false);
  });
});

describe('requestedChars', () => {
  it('pretendard-ko는 ko·en 글자를 모두 담는다(404 화면이 ko 글꼴 하나로 en도 그린다)', () => {
    const ko = requestedChars('pretendard-ko.woff2');
    for (const c of [...requiredChars('ko'), ...requiredChars('en')]) expect(ko.has(c)).toBe(true);
  });
  it('pretendard-latin은 한자·가나를 담지 않고, ko 언어 안내 글자는 담는다', () => {
    const latin = requestedChars('pretendard-latin.woff2');
    expect([...latin].some(isCjk)).toBe(false);
    expect([...latin].some(isHangul)).toBe(true);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/unit/font-subset.test.ts`
Expected: FAIL(모듈 없음)

- [ ] **Step 3: `scripts/font-chars.mjs` 쓰기**

```js
// 글꼴 서브셋에 넣을 글자 모으기(순수 함수, 계획 2026-10-08 성능). scripts/build-fonts.mjs가 글꼴을 자를 때와
// tests/unit/font-subset.test.ts가 "지금 문구의 글자가 커밋된 글꼴에 다 있는지" 볼 때 같은 규칙을 쓴다.
// 화면 글자는 문구(content/*.json)·수치(data/facts.json)·코드 안 기호·Intl 날짜/숫자에서 온다. 코드 안 한글은
// 개발용 오류·경고 문구뿐이라(화면에 안 나온다) 기호만 모은다.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

export const LOCALES = ['ko', 'en', 'ja'];
export const FONT_FILES = ['pretendard-ko.woff2', 'pretendard-latin.woff2', 'noto-sans-jp.woff2'];
// 페이지마다 글자를 그리는 글꼴(앞 것이 먼저). 테스트가 이 목록으로 빠진 글자를 찾는다
export const PAGE_FONTS = { ko: ['pretendard-ko.woff2'], en: ['pretendard-latin.woff2'], ja: ['noto-sans-jp.woff2', 'pretendard-latin.woff2'] };

export const isHangul = (c) => /[ᄀ-ᇿ㄰-㆏가-힣]/.test(c);
export const isCjk = (c) => /[　-ヿㇰ-ㇿ㐀-䶿一-鿿豈-﫿＀-￯]/.test(c);

const addAll = (set, s) => { for (const c of s) set.add(c); return set; };
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

// JSON 값 안의 모든 문자열 글자(키는 이름표라 빼고 값만)
export function stringChars(value, out = new Set()) {
  if (typeof value === 'string') addAll(out, value);
  else if (Array.isArray(value)) value.forEach((v) => stringChars(v, out));
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => stringChars(v, out));
  return out;
}

// // 줄 주석과 /* */ 블록 주석(JSX {/* */} 포함)을 뺀다. 문자열·템플릿 안의 // 는 남긴다.
// TypeScript 7에는 JS API가 없어 직접 훑는다 — 정규식 리터럴 안의 // 같은 드문 경우는 글자를 조금 더 모을 뿐이라 괜찮다
export function stripComments(code) {
  let out = '';
  let quote = null;
  for (let i = 0; i < code.length; i++) {
    const c = code[i], d = code[i + 1];
    if (quote) {
      out += c;
      if (c === '\\') { out += d ?? ''; i++; } else if (c === quote) quote = null;
      continue;
    }
    if (c === '/' && d === '/') { while (i < code.length && code[i] !== '\n') i++; out += '\n'; continue; }
    if (c === '/' && d === '*') { const e = code.indexOf('*/', i + 2); i = e < 0 ? code.length : e + 1; continue; }
    if (c === "'" || c === '"' || c === '`') quote = c;
    out += c;
  }
  return out;
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

// 코드(src·app) 안 문자열·JSX 글의 기호(ASCII 밖, 한글·한자·가나 아닌 것). 예: → ₩ − · ▶
export function sourceSymbolChars(root = '.') {
  const out = new Set();
  for (const f of [...walk(join(root, 'src')), ...walk(join(root, 'app'))]) {
    for (const c of stripComments(readFileSync(f, 'utf8'))) if (c > '~' && !isHangul(c) && !isCjk(c)) out.add(c);
  }
  return out;
}

// 사이트가 Intl로 만드는 날짜·숫자 글자(src/lib/i18n.ts formatValue, src/charts/build.ts 축·표시 상자)
export function intlChars(locale) {
  const out = new Set();
  const dates = [
    { month: 'short' }, { weekday: 'short' }, { month: 'short', day: 'numeric', weekday: 'short' },
    { month: 'long', day: 'numeric', weekday: 'short' }, { year: 'numeric', month: 'long', day: 'numeric' },
    { year: 'numeric', month: 'long' }, { year: 'numeric', month: 'short' },
  ];
  for (let m = 0; m < 12; m++) {
    const d = new Date(Date.UTC(2026, m, 1 + m * 2));
    for (const o of dates) addAll(out, new Intl.DateTimeFormat(locale, { ...o, timeZone: 'UTC' }).format(d));
  }
  for (const v of [0.5, 12, 1234, 12345, 123456, 1234567, 12345678, 123456789]) {
    addAll(out, new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(v));
    addAll(out, new Intl.NumberFormat(locale, { maximumFractionDigits: 1, signDisplay: 'exceptZero' }).format(-v));
  }
  return out;
}

const ASCII = (() => { const s = new Set(); for (let c = 0x20; c < 0x7f; c++) s.add(String.fromCharCode(c)); return s; })();

// 한 페이지(로케일)에 나올 수 있는 글자. 다른 언어 페이지에 뜨는 언어 안내(langHint)는 requestedChars가 따로 넣는다
export function requiredChars(locale, root = '.') {
  const out = new Set(ASCII);
  stringChars(readJson(join(root, `content/${locale}.json`)), out);
  stringChars(readJson(join(root, 'data/facts.json')), out);
  addAll(out, sourceSymbolChars(root));
  addAll(out, intlChars(locale));
  return out;
}

// 글꼴 파일마다 잘라 넣을 글자
export function requestedChars(file, root = '.') {
  const req = (l) => requiredChars(l, root);
  if (file === 'pretendard-ko.woff2') return new Set([...req('ko'), ...req('en')]);
  if (file === 'pretendard-latin.woff2') {
    const out = new Set([...req('en'), ...[...req('ja')].filter((c) => !isCjk(c))]);
    // en·ja 페이지에 뜰 수 있는 한국어 언어 안내(RootDocument가 세 언어 안내를 모두 싣는다)
    stringChars(readJson(join(root, 'content/ko.json')).langHint, out);
    return out;
  }
  if (file === 'noto-sans-jp.woff2') return req('ja');
  throw new Error(`모르는 글꼴 파일: ${file}`);
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run tests/unit/font-subset.test.ts`
Expected: 전부 PASS

- [ ] **Step 5: 커밋**

```bash
git add scripts/font-chars.mjs tests/unit/font-subset.test.ts
git commit -m "perf(fonts): 글꼴 서브셋에 넣을 글자 모으기 규칙(문구·수치·코드 기호·Intl)"
```

---

### Task 3: 서브셋 글꼴 만들기 (`npm run fonts`) + 커버리지 테스트

**Files:**
- Create: `scripts/build-fonts.mjs`
- Create(생성물): `src/styles/font-files/pretendard-ko.woff2`, `pretendard-latin.woff2`, `noto-sans-jp.woff2`, `subset.json`, `OFL-Pretendard.txt`, `OFL-NotoSansJP.txt`
- Modify: `package.json`(devDependencies `subset-font`·`harfbuzzjs`, 스크립트 `fonts`)
- Test: `tests/unit/font-subset.test.ts`(커버리지)

- [ ] **Step 1: 개발 의존성**

Run: `npm i -D subset-font@2.9.0 harfbuzzjs@1.6.3`
Expected: `package.json` devDependencies에 두 줄. `package.json` scripts에 `"fonts": "node scripts/build-fonts.mjs",` 를 `"lighthouse"` 다음 줄에 넣는다

- [ ] **Step 2: 커버리지 테스트(실패)** — `tests/unit/font-subset.test.ts` 끝에 추가

```ts
import { readFileSync, existsSync } from 'node:fs';
import { PAGE_FONTS } from '../../scripts/font-chars.mjs';

describe('커밋된 글꼴 서브셋', () => {
  const manifestPath = 'src/styles/font-files/subset.json';
  it('글꼴 파일 셋과 목록(subset.json)이 있다', () => {
    expect(existsSync(manifestPath)).toBe(true);
    for (const f of ['pretendard-ko.woff2', 'pretendard-latin.woff2', 'noto-sans-jp.woff2']) expect(existsSync(`src/styles/font-files/${f}`)).toBe(true);
  });
  for (const locale of ['ko', 'en', 'ja'] as const) {
    it(`${locale}: 페이지에 나올 글자를 글꼴을 만들 때 모두 넣었다 — 빠졌으면 npm run fonts로 다시 만든다`, () => {
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<string, { requested: string; missing: string }>;
      const have = new Set(PAGE_FONTS[locale].flatMap((f) => [...manifest[f].requested]));
      const missing = [...requiredChars(locale)].filter((c) => !have.has(c));
      expect(missing.join('')).toBe('');
    });
  }
});
```

Run: `npx vitest run tests/unit/font-subset.test.ts`
Expected: 새 테스트 FAIL(`subset.json` 없음)

- [ ] **Step 3: `scripts/build-fonts.mjs` 쓰기**

```js
// npm run fonts: 사이트에 실제로 나오는 글자만 남긴 글꼴 셋을 만든다(src/styles/font-files/, 커밋한다). 계획 2026-10-08 성능.
// 왜: Pretendard 동적 서브셋(92조각)은 페이지 전체 글자 때문에 첫 배치에서 25~40조각(650~850KB)을 받아 LCP를 늘렸다.
// 문구가 바뀌어 새 글자가 생기면 tests/unit/font-subset.test.ts가 실패한다 → 이 스크립트를 다시 돌리고 결과를 커밋한다.
// 원본: Pretendard(node_modules/pretendard), Noto Sans JP(google/fonts 고정 커밋, scripts/.cache/fonts에 받아 둔다). 둘 다 OFL.
import subsetFont from 'subset-font';
import { Blob, Face } from 'harfbuzzjs';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { FONT_FILES, requestedChars } from './font-chars.mjs';

const OUT = 'src/styles/font-files';
const CACHE = 'scripts/.cache/fonts';
const NOTO_COMMIT = '66a36c8c94b1a5d992ee4e7f392fccfe4945767c'; // google/fonts ofl/notosansjp 최신(2026-03-25)
const NOTO_URL = `https://raw.githubusercontent.com/google/fonts/${NOTO_COMMIT}/ofl/notosansjp`;
const PRETENDARD = 'node_modules/pretendard/dist/web/variable/woff2/PretendardVariable.woff2';

async function cached(name, url) {
  const p = `${CACHE}/${name}`;
  if (!existsSync(p)) {
    mkdirSync(CACHE, { recursive: true });
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
    writeFileSync(p, Buffer.from(await res.arrayBuffer()));
  }
  return readFileSync(p);
}

// 굵기 축은 CSS에서 쓰는 범위만 남긴다: Pretendard 400~700, Noto Sans JP 400~600(지금 Google 글꼴과 같은 두 굵기)
const SOURCES = {
  'pretendard-ko.woff2': { load: async () => readFileSync(PRETENDARD), wght: [400, 700] },
  'pretendard-latin.woff2': { load: async () => readFileSync(PRETENDARD), wght: [400, 700] },
  'noto-sans-jp.woff2': { load: () => cached('NotoSansJP[wght].ttf', `${NOTO_URL}/NotoSansJP%5Bwght%5D.ttf`), wght: [400, 600] },
};

mkdirSync(OUT, { recursive: true });
const manifest = {};
for (const file of FONT_FILES) {
  const { load, wght } = SOURCES[file];
  const src = await load();
  const text = [...requestedChars(file)].sort().join('');
  const opts = { variationAxes: { wght: { min: wght[0], max: wght[1] } } };
  // 원본에 없는 글자를 알리려고 sfnt로 한 번 더 잘라 실제로 담긴 글자를 센다(harfbuzz)
  const sfnt = await subsetFont(src, text, { ...opts, targetFormat: 'sfnt' });
  const covered = new Set([...new Face(new Blob(sfnt), 0).collectUnicodes()].map((u) => String.fromCodePoint(u)));
  const woff2 = await subsetFont(src, text, { ...opts, targetFormat: 'woff2' });
  writeFileSync(`${OUT}/${file}`, woff2);
  const missing = [...text].filter((c) => !covered.has(c)).join('');
  manifest[file] = { requested: text, missing };
  console.log(`${file}: 글자 ${[...text].length}개 → ${(woff2.length / 1024).toFixed(1)}KB${missing ? ` (원본에 없음: ${missing})` : ''}`);
}
writeFileSync(`${OUT}/subset.json`, `${JSON.stringify(manifest, null, 2)}\n`);
copyFileSync('node_modules/pretendard/dist/LICENSE.txt', `${OUT}/OFL-Pretendard.txt`);
writeFileSync(`${OUT}/OFL-NotoSansJP.txt`, await cached('OFL-NotoSansJP.txt', `${NOTO_URL}/OFL.txt`));
```

- [ ] **Step 4: 만들기**

Run: `npm run fonts`
Expected(대략): `pretendard-ko.woff2: 글자 5xx개 → 75~110KB`, `pretendard-latin.woff2: … → 35~50KB`, `noto-sans-jp.woff2: … → 150~190KB`. "원본에 없음"이 Noto 쪽에 한글 언어 안내 글자처럼 뜨면 정상(예비 글꼴 Pretendard가 그린다). `src/styles/font-files/`에 파일 6개

- [ ] **Step 5: 테스트 통과 확인**

Run: `npx vitest run tests/unit/font-subset.test.ts`
Expected: 전부 PASS

- [ ] **Step 6: 커밋**

```bash
git add package.json package-lock.json scripts/build-fonts.mjs src/styles/fonts tests/unit/font-subset.test.ts
git commit -m "perf(fonts): 사이트에 나오는 글자만 남긴 글꼴 셋(npm run fonts) + 빠진 글자 테스트"
```

---

### Task 4: 서브셋 글꼴로 바꿔 끼우기

**Files:**
- Modify: `src/styles/fonts.ts`, `src/styles/font-jp.ts`, `src/styles/globals.css:8-10`
- Modify: `app/(ko)/layout.tsx`, `app/(en)/layout.tsx`, `app/(ja)/layout.tsx`, `app/global-not-found.tsx`
- Create: `tests/e2e/fonts.spec.ts`

- [ ] **Step 1: 실패하는 e2e** — `tests/e2e/fonts.spec.ts`

```ts
// 글꼴 서브셋(계획 2026-10-08 성능 Task 4): 페이지마다 받는 woff2가 적고 작아야 한다. 예전에는 Pretendard 동적 서브셋
// 조각(PretendardVariable.subset.N)을 페이지 전체 글자 때문에 25~40개(650~850KB) 받아 LCP가 늘었다
import { expect, test } from '@playwright/test';

for (const [path, maxKb] of [['/', 260], ['/en/', 200], ['/ja/', 320]] as const) {
  test(`${path}: 글꼴 요청이 적고 작다(옛 조각 없음)`, async ({ page }) => {
    const fonts: { url: string; bytes: number }[] = [];
    page.on('response', async (r) => {
      if (r.url().endsWith('.woff2')) fonts.push({ url: r.url(), bytes: (await r.body().catch(() => Buffer.alloc(0))).length });
    });
    await page.goto(path);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(500);
    expect(fonts.some((f) => /PretendardVariable\.subset/.test(f.url))).toBe(false);
    expect(fonts.length).toBeLessThanOrEqual(6);
    expect(fonts.reduce((s, f) => s + f.bytes, 0) / 1024).toBeLessThan(maxKb);
  });
}
```

Run: `npm run build && npx playwright test tests/e2e/fonts.spec.ts --project=desktop --reporter=line`
Expected: FAIL(옛 조각 있음)

- [ ] **Step 2: `src/styles/fonts.ts` 바꾸기**

```ts
// 글꼴: 제목 Space Grotesk·수치 IBM Plex Mono(Google, 라틴만)와 본문 Pretendard(로컬 서브셋).
// Pretendard는 사이트에 나오는 글자만 남긴 파일을 쓴다(scripts/build-fonts.mjs, 계획 2026-10-08 성능) — 예전 동적
// 서브셋 CSS는 페이지 전체 글자 때문에 첫 배치에서 조각 25~40개를 받아 LCP를 늘렸다. 문구가 바뀌면 npm run fonts.
// 세 파일 모두 같은 변수(--font-pretendard)를 쓰고, 로케일 layout이 하나만 붙인다.
import localFont from 'next/font/local';
import { IBM_Plex_Mono, Space_Grotesk } from 'next/font/google';

export const display = Space_Grotesk({ subsets: ['latin'], weight: ['500', '700'], variable: '--font-display', display: 'swap' });
export const mono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '600'], variable: '--font-mono', display: 'swap' });

// ko 페이지·공용 404: 한글 + ko·en 글자 전부
export const textKo = localFont({ src: './font-files/pretendard-ko.woff2', weight: '400 700', variable: '--font-pretendard', display: 'swap' });
// en 페이지: 라틴 + 한국어 언어 안내 글자
export const textLatin = localFont({ src: './font-files/pretendard-latin.woff2', weight: '400 700', variable: '--font-pretendard', display: 'swap' });
// ja 페이지의 예비 글꼴(Noto 서브셋에 없는 글자 — 한국어 언어 안내 등). 거의 안 쓰이니 미리 받지 않는다
export const textLatinFallback = localFont({ src: './font-files/pretendard-latin.woff2', weight: '400 700', variable: '--font-pretendard', display: 'swap', preload: false });

export const baseFontVars = `${display.variable} ${mono.variable}`;
```

- [ ] **Step 3: `src/styles/font-jp.ts` 바꾸기**

```ts
// ja 로케일 전용 글꼴. ko/en 레이아웃은 이 파일을 import하지 않으므로 ko/en 페이지에는 일본어 글꼴이 실리지 않는다.
// Noto Sans JP를 ja 페이지에 나오는 글자만 남겨(scripts/build-fonts.mjs, 굵기 400~600) 한 파일로 쓴다 — Google 글꼴
// 조각(약 120개 중 페이지당 40개·830KB)을 받던 것을 줄였다(계획 2026-10-08 성능). 라틴도 담아 ja 페이지 라틴 모양은 그대로
import localFont from 'next/font/local';

export const jp = localFont({ src: './font-files/noto-sans-jp.woff2', weight: '400 600', variable: '--font-jp', display: 'swap' });
```

- [ ] **Step 4: 변수·레이아웃**

`src/styles/globals.css` 8~10번 줄:

```css
  --font-text: var(--font-pretendard), system-ui, sans-serif;
}
:root:lang(ja) { --font-text: var(--font-jp), var(--font-pretendard), system-ui, sans-serif; }
```

`app/(ko)/layout.tsx`: `import { textKo } from '@/styles/fonts';` 후 `<RootDocument locale="ko" extraClass={textKo.variable}>`
`app/(en)/layout.tsx`: `import { textLatin } from '@/styles/fonts';` 후 `<RootDocument locale="en" extraClass={textLatin.variable}>`
`app/(ja)/layout.tsx`: `import { textLatinFallback } from '@/styles/fonts';` 후 `extraClass={`${jp.variable} ${textLatinFallback.variable}`}`
`app/global-not-found.tsx`: `import { baseFontVars, textKo } from '@/styles/fonts';` 후 `className={`${baseFontVars} ${textKo.variable} ${jp.variable}`}`
(각 layout 머리 주석에 "본문 글꼴 서브셋 변수(fonts.ts)도 여기서 붙인다" 한 줄)

- [ ] **Step 5: 빌드·검사**

Run: `npm run typecheck && npx vitest run && npm run build && npm run size && npx playwright test tests/e2e/fonts.spec.ts tests/e2e/site.spec.ts tests/e2e/info-clarity.spec.ts tests/e2e/header.spec.ts --reporter=line --workers=2`
Expected: 전부 PASS. 초기 JS는 그대로(글꼴은 CSS·woff2)

- [ ] **Step 6: 눈 확인** — 1440·390, ko·en·ja 첫 화면·② 수집·④ 차트 글·연락처를 캡처해 바꾸기 전(main 빌드) 캡처와 나란히 본다. 글자 모양·굵기·줄바꿈이 같아야 한다(ja 라틴도 Noto). 다르면 굵기 축 범위·`adjustFontFallback`부터 의심한다

- [ ] **Step 7: 커밋**

```bash
git add src/styles/fonts.ts src/styles/font-jp.ts src/styles/globals.css app tests/e2e/fonts.spec.ts
git commit -m "perf(fonts): 본문·일본어 글꼴을 서브셋 한 파일로 — 첫 화면 전 글꼴 650~850KB → 80~180KB"
```

---

### Task 5: 3D 첫 프레임에서 셰이더 컴파일 떼어 내기

**Files:**
- Modify: `src/three/TerrainScene.tsx`

- [ ] **Step 1: 바꾸기 전 3D 시작 긴 작업을 잰다** — 로컬 분석 도구 `.lighthouse/trace.mjs`(git 밖, 계획 작성 때 만든 것: 휴대폰 화면 + CPU 4배로 trace를 찍어 50ms 넘는 작업과 그 안 이벤트를 출력)

Run: `npm run build && cp .lighthouse/trace.mjs ./.trace.mjs && node ./.trace.mjs / 12 .lighthouse/trace-before.json; GPU=1 node ./.trace.mjs / 12 .lighthouse/trace-before-gpu.json; rm ./.trace.mjs`
Expected: `FireAnimationFrame`이 400ms 안팎인 작업(3D 첫 프레임)이 보인다. 그 길이를 적어 둔다

- [ ] **Step 2: `TerrainScene.tsx` 고치기**

`import { Canvas, useFrame } from '@react-three/fiber';` → `import { Canvas, useFrame, useThree } from '@react-three/fiber';`

컴포넌트 안 상태 선언들 옆에:

```tsx
  // 셰이더를 첫 프레임 전에 따로 컴파일한다(계획 2026-10-08 성능) — 첫 프레임이 컴파일 + 버퍼 올리기를 한 작업에서 해
  // 메인 스레드를 수백 ms 막았다. 끝날 때까지 프레임 루프를 멈춰 두고(frameloop 'never'), 끝나면 돌린다
  const [compiled, setCompiled] = useState(false);
```

`<Canvas>`의 `frameloop`:

```tsx
        frameloop={(running || capture) && compiled ? 'always' : 'never'}
```

`<FrameWatch …/>` 바로 위에:

```tsx
        <Precompile onDone={() => setCompiled(true)} />
```

파일 끝(`FrameWatch` 위)에:

```tsx
// 장면의 모든 재질을 compileAsync로 미리 컴파일한다. KHR_parallel_shader_compile이 있으면 컴파일을 기다리는 동안
// 메인 스레드가 놀고, 없어도(소프트웨어 렌더러) 컴파일이 첫 프레임과 다른 작업으로 떨어진다.
// 형제(점·공항 곁가지) 효과가 먼저 돌아 객체가 장면에 붙은 뒤 이 효과가 돈다(마지막 자식). 실패해도 그냥 프레임을 연다
function Precompile({ onDone }: { onDone: () => void }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    let alive = true;
    gl.compileAsync(scene, camera).catch(() => undefined).finally(() => { if (alive) onDone(); });
    return () => { alive = false; };
  }, [gl, scene, camera, onDone]);
  return null;
}
```

`onDone`이 렌더마다 새 함수라 효과가 다시 돌지 않게 `const onCompiled = useCallback(() => setCompiled(true), []);`를 만들어 `onDone={onCompiled}`로 넘긴다(`useCallback`을 react import에 더한다).

- [ ] **Step 3: 단위·e2e**

Run: `npm run typecheck && npx vitest run && npm run build && npx playwright test tests/e2e/airport.spec.ts tests/e2e/terrain.spec.ts tests/e2e/charts.spec.ts --reporter=line --workers=2`
Expected: 전부 PASS(3D가 on이 되고 장면 전환 그대로)

- [ ] **Step 4: 바꾼 뒤 다시 잰다**

Run: `cp .lighthouse/trace.mjs ./.trace.mjs && node ./.trace.mjs / 12 .lighthouse/trace-after.json; GPU=1 node ./.trace.mjs / 12 .lighthouse/trace-after-gpu.json; rm ./.trace.mjs`
Expected: 3D 첫 프레임 작업이 Step 1보다 짧아지고, 컴파일이 별도 작업으로 보인다. 짧아지지 않으면 이 태스크를 되돌리고 결과에 "효과 없음"으로 적는다(첫 프레임이 버퍼 올리기 위주인 경우)

- [ ] **Step 5: 커밋**

```bash
git add src/three/TerrainScene.tsx
git commit -m "perf(3d): 셰이더를 첫 프레임 전에 compileAsync로 — 3D 시작 긴 작업 쪼개기"
```

---

### Task 6: 클라이언트 데이터 검사를 `zod/mini`로

**Files:**
- Modify: `src/three/data.ts:4-31`, `src/charts/data.ts:3-76`, `src/demo/source.ts:4-55`
- Test: 기존 `tests/unit/three-data.test.ts`, `charts-data.test.ts`, `demo-source.test.ts`(바꾸지 않고 그대로 통과해야 한다)

`src/lib/facts.ts`는 서버(빌드)에서만 돌아 초기·지연 청크에 안 들어가므로 그대로 `zod`를 쓴다.

- [ ] **Step 1: 바꾸기 전 청크 크기 기록**

Run: `npm run build && for f in out/_next/static/chunks/*.js; do grep -q "_zod" "$f" && echo "$f $(gzip -9c "$f" | wc -c)"; done`
Expected: zod가 든 청크 하나(약 89KB gzip)

- [ ] **Step 2: `src/three/data.ts`**

```ts
import * as z from 'zod/mini';

const ints = z.array(z.int());
const layer = z.object({ dtd: ints, date: ints, pct: ints });

export const terrainSchema = z.object({
  asOf: z.string(),
  maxDtd: z.int().check(z.positive()),
  clip: z.object({ min: z.number(), max: z.number() }),
  dates: z.array(z.string()).check(z.minLength(2)),
  holiday: ints,
  curve: z.optional(z.object({ dtd: ints, pct: ints, n: ints })),
  signal: layer,
  noise: layer,
  removed: layer,
});
export const mapSchema = z.object({
  bbox: z.array(z.number()).check(z.length(4)),
  coast: ints.check(z.minLength(4)), // 선분 하나라도 있어야 해안선을 다시 뽑을 수 있다(최소 2 점 = 4개 원소)
  routes: z.array(z.object({ from: z.string(), to: z.string(), pts: ints.check(z.minLength(4)) })),
  airports: z.array(z.object({ code: z.string(), lon: z.number(), lat: z.number() })),
});
```

(머리 주석의 "zod로 검사"는 "zod/mini로 검사(지연 청크를 작게)"로. 나머지 줄은 그대로)

- [ ] **Step 3: `src/charts/data.ts`**

```ts
import * as z from 'zod/mini';

const iso = z.string().check(z.regex(/^\d{4}-\d{2}-\d{2}$/));
const ints = z.array(z.int());

export const chartsSchema = z.object({
  asOf: iso,
  dates: z.array(iso).check(z.minLength(2)),
  depart: z.object({ pct: ints, holiday: z.array(z.nullable(z.string())) }),
  labels: z.array(z.object({ date: iso, code: z.string() })),
  curve: z.object({
    bins: z.array(z.tuple([z.int(), z.int()])).check(z.length(8)),
    mean: ints.check(z.length(8)),
    n: ints.check(z.length(8)),
    sample: z.object({ bin: ints, pct: ints }),
  }),
  // (기존 주석 그대로)
  shap: z.optional(z.object({
    n: z.int().check(z.positive()),
    features: z.array(z.string()).check(z.minLength(1)),
    categorical: z.array(z.string()),
    v: z.array(ints),
    f: z.array(ints),
  })),
  // (기존 주석 그대로)
  model: z.optional(z.object({
    route: z.string(),
    cabin: z.string(),
    base: z.array(z.nullable(z.int())),
    obs: z.object({ date: ints, pct: ints }),
  })),
  // (기존 주석 그대로)
  filter: z.optional(z.object({ dur: ints, pct: ints, rule: ints })),
  // (기존 주석 그대로)
  split: z.optional(z.object({
    fetch: ints, date: ints, kf: ints, gkf: ints, tss: ints,
    fetchDays: z.int().check(z.positive()),
    show: z.object({ kf: z.int().check(z.minimum(0), z.maximum(4)), gkf: z.int().check(z.minimum(0), z.maximum(4)) }),
  })),
}).check(
  z.refine((c) => c.depart.pct.length === c.dates.length && c.depart.holiday.length === c.dates.length, '출발일 배열 길이가 서로 다르다'),
  z.refine((c) => c.curve.sample.bin.length === c.curve.sample.pct.length, '표본 배열 길이가 서로 다르다'),
  z.refine((c) => !c.shap || (c.shap.v.length === c.shap.features.length && c.shap.f.length === c.shap.features.length
    && [...c.shap.v, ...c.shap.f].every((r) => r.length === c.shap!.n)), 'SHAP 배열 모양이 다르다'),
  z.refine((c) => !c.model || (c.model.base.length === c.dates.length && c.model.obs.date.length === c.model.obs.pct.length
    && c.model.obs.date.every((i) => i >= 0 && i < c.dates.length)), '모델 구조 배열 모양이 다르다'),
  // 기준이 전부 null이면 기준 가격 선을 그릴 수 없다(model.ts가 known[0]을 읽는다) — 그릴 때 죽지 않고 불러올 때 막는다
  z.refine((c) => !c.model || c.model.base.some((b) => b !== null), '모델 구조 기준 가격이 하나도 없다'),
  z.refine((c) => !c.filter || (c.filter.dur.length === c.filter.pct.length && c.filter.rule.length === c.filter.dur.length
    && c.filter.rule.every((r) => r >= 0 && r <= 3)), '걸러내기 배열 모양이 다르다'),
  z.refine((c) => {
    const s = c.split;
    if (!s) return true;
    const n = s.fetch.length;
    return [s.date, s.kf, s.gkf, s.tss].every((a) => a.length === n)
      && s.date.every((i) => i >= 0 && i < c.dates.length)
      && s.fetch.every((f) => f >= 0 && f < s.fetchDays)
      && [...s.kf, ...s.gkf].every((f) => f >= 0 && f <= 4) && s.tss.every((f) => f >= -1 && f <= 4);
  }, '검증 설계 배열 모양이 다르다'),
);
export type ChartsData = z.infer<typeof chartsSchema>;

export const CLOUD_SERIES = 'ICN_NRT/LCC';
const won = z.nullable(z.number());
const cloudSchema = z.object({
  asOf: iso,
  dates: z.array(iso).check(z.minLength(1)),
  holidays: z.record(z.string(), z.string()),
  series: z.record(z.string(), z.nullable(z.object({ price: z.array(won), lo: z.array(won), hi: z.array(won) }))),
});
```

(나머지 `CloudData`·`getJson`·`loadCharts`·`loadCloud`는 그대로)

- [ ] **Step 4: `src/demo/source.ts`**

```ts
import * as z from 'zod/mini';
// (types import 그대로)

const isoDate = z.string().check(z.regex(/^\d{4}-\d{2}-\d{2}$/));
const won = z.nullable(z.int().check(z.nonnegative()));
const reco = z.object({
  action: z.enum(ACTIONS),
  why: z.enum(WHYS),
  bestDay: z.int(),
  bestPrice: z.int(),
  waitDays: z.int(),
  saving: z.int(),
  savingPct: z.number(),
  globalBestDay: z.int(),
  confidence: z.nullable(z.enum(['high', 'medium'])),
});
const series = z.object({ price: z.array(won), lo: z.array(won), hi: z.array(won), reco: z.array(z.nullable(reco)) });
const SERIES_KEY = new RegExp(`^(${ROUTES.join('|')})/(${CABINS.join('|')})$`);

export const demoSchema = z
  .object({
    asOf: isoDate,
    precomputed: z.boolean(),
    routes: z.array(z.enum(ROUTES)),
    cabins: z.array(z.enum(CABINS)),
    dates: z.array(isoDate).check(z.minLength(1)),
    holidays: z.record(isoDate, z.string().check(z.regex(/^(kr|jp)_[a-z0-9_]+$/))),
    series: z.record(z.string().check(z.regex(SERIES_KEY)), z.nullable(series)),
  })
  .check(z.superRefine((d, ctx) => {
    for (const [key, s] of Object.entries(d.series)) {
      if (!s) continue;
      if ([s.price, s.lo, s.hi, s.reco].some((a) => a.length !== d.dates.length)) {
        // 영어 머리말은 e2e가 "이 모듈이 초기 청크에 없는지" 찾을 때 쓰는 표식이다(tests/e2e/demo.spec.ts)
        ctx.addIssue({ code: 'custom', message: `demo-series-length-mismatch: ${key} 배열 길이가 dates와 다르다`, input: s });
        continue;
      }
      d.dates.forEach((date, i) => {
        const nulls = [s.price[i], s.lo[i], s.hi[i], s.reco[i]].filter((v) => v === null).length;
        if (nulls !== 0 && nulls !== 4) {
          ctx.addIssue({ code: 'custom', message: `demo-series-null-mismatch: ${key} ${date} price/lo/hi/reco 중 일부만 비어 있다`, input: s });
        }
      });
    }
  }));
export type DemoData = z.infer<typeof demoSchema>;
```

(기존 주석 줄들은 그대로 둔다)

- [ ] **Step 5: 검사**

Run: `npm run typecheck && npx vitest run && npm run build && npm run size`
Expected: 전부 PASS. 기존 데이터 테스트(잘못된 데이터 거부 포함)가 그대로 통과

Run: `for f in out/_next/static/chunks/*.js; do grep -q "_zod" "$f" && echo "$f $(gzip -9c "$f" | wc -c)"; done`
Expected: zod 청크가 Step 1보다 크게 작다(목표 30KB gzip 이하). 거의 안 줄면 원인(다른 import가 `zod` 전체를 끌어오는지 — `grep -rn "from 'zod'" src`)을 찾는다

Run: `npx playwright test tests/e2e/demo.spec.ts tests/e2e/charts.spec.ts --reporter=line --workers=2`
Expected: PASS

- [ ] **Step 6: 커밋**

```bash
git add src/three/data.ts src/charts/data.ts src/demo/source.ts
git commit -m "perf(bundle): 클라이언트 데이터 검사를 zod/mini로 — 지연 청크 축소"
```

---

### Task 7: 측정·기록·PR

**Files:**
- Modify: `docs/superpowers/plans/2026-10-08-performance.md`(결과), `.claude/rules/performance.md`, `.claude/rules/content-i18n.md`, `CLAUDE.md`

- [ ] **Step 1: 로컬 측정(후)**

Run: `npm run build && npm run lighthouse -- --runs=3`
Expected: ko·en·ja 성능 ≥90, CLS 0.000. 아래 "결과" 표 "로컬 후" 줄에 적는다

- [ ] **Step 2: 전체 검사**

Run: `npm run typecheck && npx vitest run && npm run size && npx playwright test --reporter=line --workers=2`
Expected: 전부 PASS(무거운 브라우저 테스트라 다른 브라우저 작업과 동시에 돌리지 않는다)

- [ ] **Step 3: 기록**
- 이 계획서 끝에 "결과" 절(로컬 전/후 표, 태스크별 효과, 되돌린 것)
- `.claude/rules/performance.md`: "최적화 계획" 후보에서 한 것(CLS 부트 여백, 글꼴 서브셋, compileAsync, zod/mini)을 "한 것"으로 옮기고 남은 후보를 둔다. 예산 줄의 현재 값(초기 JS·3D 청크) 갱신. "글꼴" 줄: "본문·일본어 글꼴은 사이트 글자만 남긴 로컬 서브셋(`npm run fonts`, 문구가 바뀌면 다시 — 테스트가 알려 준다)"
- `.claude/rules/content-i18n.md` "수치" 절 아래: "문구에 새 글자가 생기면 `npm run fonts`로 글꼴 서브셋을 다시 만들어 함께 커밋한다(`tests/unit/font-subset.test.ts`)"
- `CLAUDE.md` 현재 상태: PR 번호·확인 대기

- [ ] **Step 4: PR(`ship-pr` 스킬)** — 본문에 전후 표와 "미리보기는 로그인 보호로 Lighthouse를 못 돌려 로컬로 비교, 병합 뒤 운영에서 다시 잰다"

- [ ] **Step 5: 병합 뒤 운영 측정**

Run: `npm run lighthouse -- --runs=3 --base=https://signal-ml.vercel.app`
Expected: 성능 ≥90. `.claude/rules/performance.md` "운영 측정 기록"을 새 값으로 바꾸고 main에 문서 커밋

---

## 결과

(구현하며 채운다)

| | ko 성능 | en 성능 | ja 성능 | LCP(ko/en/ja) | TBT(ko/en/ja) | CLS |
|---|---|---|---|---|---|---|
| 운영 전(2026-10-08) | 86 | 86 | 76 | 2.96 / 3.01 / 3.47s | 376 / 296 / 398ms | 0.067 |
| 로컬 전(`serve`, HTTP/1.1이라 조각 글꼴이 줄을 서서 운영보다 나쁨) | 61 | 80 | 81 | 5.75 / 3.69 / 2.86s | 305 / 268 / 381ms | 0.067 |
| 로컬 후 | | | | | | |
| 운영 후 | | | | | | |
