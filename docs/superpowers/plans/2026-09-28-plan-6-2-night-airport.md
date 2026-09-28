# 계획 6-2: 밤의 공항 첫 화면 · 로딩 NOW BOARDING Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 첫 화면을 "터미널 창가에서 본 밤 활주로"로 바꾼다. 스크롤하면 카메라가 땅 가까이 내려앉고, ①로 넘어가며 모든 공항 불빛이 가격 지형 점으로 모인다. 로딩 화면은 가운데 큰 숫자의 `NOW BOARDING`으로 바꾼다.

**Architecture:** 공항 불빛은 **지금의 점 구름(Points 하나)을 그대로 쓴다**. 순수 모듈 `src/three/airport.ts`가 활주로·유도로·계류장·창문·도시 불빛의 자리·색·크기·켜지는 순서를 코드로 만들고, `assignAirport`가 그 불빛을 점 구름의 신호 점에 하나씩 배정해 셰이더 속성(`aAirport`, `aAirStyle`, `aRunS`)으로 넣는다. 셰이더는 uniform `uAirport`(1 = 공항, 0 = 지형)로 두 목표를 섞는다 — 첫 화면에서 ①로 넘어가면 `uAirport`가 1→0으로 부드럽게 줄며 불빛이 자기 지형 자리로 옮겨 간다. 점이 아닌 것(바닥 판·빛 웅덩이·활주로 표시·별·착륙 비행기·진입등 섬광·유도 비행기·빨간 경고등)은 `AirportExtras.tsx`가 같은 캔버스에 작은 객체로 그린다. 하늘은 CSS 그라데이션이다.

**Tech Stack:** Next.js 16(App Router, 정적 export), React 19, React Three Fiber, three, TypeScript, vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-28-night-airport-and-layout-design.md` §4(4.1~4.6), §5, §6, §7(6-2 부분). **시안(기준 그림):** `docs/superpowers/mockups/2026-09-28/01-night-airport.html` — 2D 캔버스로 그린 채택안. 좌표·간격·색·켜지는 순서는 이 시안의 코드(`at()`, `add()`, `BUILD`, `APPROACH`, 비행기 경로)를 그대로 옮긴다. 조작판은 비교용이라 옮기지 않는다.

## 이 계획에서 정한 것(설계에 없는 세부)

- **좌표 변환**: 시안은 미터 단위, 카메라가 +z를 본다. 사이트 월드 = `[x·K, y·K, −z·K]`, `K = 0.01`(three.js 카메라는 −z를 보므로 z를 뒤집어야 좌우가 같다). 활주로 3,200m → 32 단위.
- **카메라**(시안 A·B를 사이트 fov 40°에 맞춘 값): A 위치 `[-1.2, 0.42, 1.6]` → 목표 `[0.781, -0.321, -8.174]`, B 위치 `[-1.2, 0.12, 1.6]` → 목표 `[0.777, -0.850, -8.154]`. 첫 화면 마우스 시차는 0.06(지금 1.2는 공항 크기에 너무 크다).
- **내려앉기 진행도**: 스크롤 위치로 정한다 — `descent = clamp(scrollY / (0.9 · innerHeight), 0, 1)`. 첫 화면 섹션(88vh) 뒤에 3D가 켜졌을 때만 60vh 여백을 둬(화면 밖이라 CLS 없음) 내려앉을 스크롤 거리를 만든다. 여백까지 포함한 감싸개가 `data-scene="hero"`를 가진다.
- **빼는 것**: 시안의 "젖은 노면 반사"(세로로 늘인 빛)는 점 스프라이트로 만들 수 없어 뺀다(설계 §4.1 표의 한 줄 — 구현 결과에 기록). 나머지 표 항목은 모두 넣는다.
- **첫 화면 좌우 여백**: 설계 §4.4의 `max(7vw, …)`는 시안 기준 값이다. 사이트 첫 화면은 이미 `.wrap`(최대 1080px 가운데)이라 다른 섹션과 같은 선에 서고 가장자리에 붙지 않는다 → `.wrap`을 유지한다(구현 결과에 기록).
- **OG 이미지는 이번에 다시 만들지 않는다**(설계 §4.6: 구현 뒤 비교해 사용자가 정함). `npm run og`는 돌리지 않는다.

## Global Constraints

- **코드 주석**: 한국어. 파일마다 맨 위에 무엇을 하는 파일인지 한두 줄, 이유가 드러나지 않는 로직에는 "왜"를 적는다. 코드를 한 줄씩 옮겨 적는 주석은 달지 않는다.
- **문구·수치**: 문장은 `content/{ko,en,ja}.json`에만, 수치는 `data/facts.json`에만. `NOW BOARDING`·`ROWS`·`SIGNAL` 같은 영어 연출 글자는 세 언어 공통으로 부품에 둔다(지금 `LOADING … ROWS`와 같은 방식).
- **초기 JS 150KB(gzip)**, **3D 청크 ≤ 256,000B(gzip)** — 지금 141.2KB / 241.1KB. 3D 쪽 여유가 약 9KB뿐이다. **Task 4·6·7 끝마다 `npm run build && npm run size`**. 넘으면 Task 7의 "줄일 순서"를 따른다.
- **색**: 배경 `#070B16`, 점 파랑 `#8FB8FF`, 호박 `#FFB547`, 글자 흰색 `#EEF3FF`. 공항에서만 **따뜻한 흰색 `#FFE2B8`**(색 번호 4)과 **경고등 빨강 `#FF4A4A`**(경고등 한 개에만)를 더 쓴다. 초록은 쓰지 않는다.
- **모션**: 이징은 기존 damp(expo.out 느낌). 움직임 줄이기·3D 불가는 3D가 꺼지고 `hero.webp` 대체 이미지.
- **접근성**: 캔버스·로딩 화면은 `aria-hidden`. 첫 화면 글 대비는 기존 화소 대비 e2e가 지킨다(`.hero-keywords`, `.hero-sub`).
- **커밋**: 브랜치 `plan-6-2-airport`(Task 0에서 main 위에 만든다). 메시지 끝에 `Co-Authored-By: <구현 모델 이름> <noreply@anthropic.com>`. 커밋 이메일 noreply(`55799748+hyde0395@users.noreply.github.com`).
- **e2e**는 빌드 결과를 쓴다: `npm run build` 뒤 `npx playwright test <파일>`. 3D가 켜져야 하는 검사는 헤드리스 크롬에서도 켜진다(소프트웨어 렌더러, 느림).
- 긴 명령은 앞에서(foreground) 돌리고 시간 제한을 넉넉히(10분) 준다. 띄운 서버는 끝나면 끈다.
- 명령은 저장소 루트에서(맥북 `~/dev/untitled folder/signal-ml-portfolio`).

## Review Focus

1. **첫 화면 → ① 전환에서 사라지는 불빛이 없다**(사용자 요청): 고정 불빛(활주로·유도로·계류장·창문·도시) 모두가 점 구름의 서로 다른 점에 배정된다 → Task 3 단위 "모든 불빛이 서로 다른 신호 점에".
2. **빨간색은 경고등 하나뿐, 초록 없음** → Task 2 단위(색 번호), Task 6 코드 검토.
3. **3D 용량** ≤ 256,000B → Task 4·6·7의 size 단계.
4. **CLS 0 유지**: 첫 화면 뒤 여백은 3D가 켜진 뒤에만, 화면 밖에서 → Task 5 e2e(CLS 측정은 기존 `tests/e2e`의 CLS 검사가 있으면 그것, 없으면 첫 화면 글 위치가 3D 전후로 같은지).
5. **대체 화면**: 움직임 줄이기에서 `hero.webp`(새 공항 장면)가 보이고 글이 읽힌다 → Task 8.
6. **휴대폰**: 불빛 절반, 세로 화면 카메라, 글과 겹치지 않음 → Task 5·9 스크린샷.

## 파일 구조

| 파일 | 할 일 |
|---|---|
| `src/components/Loader.tsx`, `src/styles/globals.css`, `tests/e2e/motion.spec.ts` | NOW BOARDING 로딩(Task 1) |
| `data/facts.json`, `src/lib/facts.ts`, `src/components/sections/Hero.tsx`, `tests/unit/facts.test.ts` | 공항 좌표·메타 줄, 첫 화면 감싸개(Task 1·5) |
| `src/three/airport.ts` / `tests/unit/airport.test.ts` | 새로: 공항 불빛·이동 경로 배치(순수) (Task 2) |
| `src/three/airportAssign.ts` / `tests/unit/airport-assign.test.ts` | 새로: 불빛 → 점 구름 배정(순수) (Task 3) |
| `src/three/shaders.ts`, `src/three/TerrainPoints.tsx` | `aAirport`·`aAirStyle`·`aRunS`, `uAirport`·`uLightT`·`uWave`, 불빛 모양 (Task 4) |
| `src/three/scenes.ts` / `tests/unit/three-scenes.test.ts`, `src/three/CameraRig.tsx`, `src/three/TerrainScene.tsx` | 공항 장면·내려앉기 (Task 5) |
| `src/three/AirportExtras.tsx` | 새로: 바닥·웅덩이·표시·별·움직이는 불빛·경고등 (Task 6) |
| `src/styles/globals.css` | 하늘, 첫 화면 여백, 메타 줄 (Task 5·7) |
| `public/fallback/hero.webp` | 다시 캡처 (Task 8) |
| `tests/e2e/terrain.spec.ts`, `tests/e2e/airport.spec.ts` | 새 검사 (Task 5·8) |
| `CLAUDE.md`, 설계 문서 | 기록 (Task 9) |

---

### Task 0: 브랜치

- [ ] **Step 1**

```bash
git switch main && git pull --ff-only
git switch -c plan-6-2-airport
git config user.email   # 55799748+hyde0395@users.noreply.github.com
npm ci
```

---

### Task 1: 로딩 NOW BOARDING + 첫 화면 메타 줄

**Files:**
- Modify: `src/components/Loader.tsx`, `src/styles/globals.css:45-50`, `tests/e2e/motion.spec.ts`
- Modify: `data/facts.json`, `src/lib/facts.ts`, `src/components/sections/Hero.tsx`, `tests/unit/facts.test.ts`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`tests/e2e/motion.spec.ts`의 로딩 테스트(`const loader = page.locator('.loader');`가 있는 테스트)에서 `loader`를 만든 줄 바로 뒤에 더한다:

```ts
  await expect(loader.locator('.loader-label').first()).toHaveText('NOW BOARDING');
  await expect(loader.locator('.loader-bar')).toBeAttached();
```

`tests/unit/facts.test.ts` 끝에 더한다(파일이 이미 `facts`를 import한다):

```ts
describe('site.airport(첫 화면 메타 줄)', () => {
  it('공항 코드와 좌표가 있다', () => {
    expect(facts.site.airport.code).toBe('ICN');
    expect(facts.site.airport.lat).toBeGreaterThan(37);
    expect(facts.site.airport.lon).toBeGreaterThan(126);
  });
});
```
(`describe`·`it`·`expect`가 import되어 있지 않으면 `vitest` import에 더한다.)

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/unit/facts.test.ts`
Expected: FAIL — `facts.site` undefined

- [ ] **Step 3: 수치와 스키마**

`data/facts.json` 최상위(예: `"profile"` 바로 앞)에 더한다 — `export_facts.py`는 이 키를 건드리지 않는다(그 파일 맨 위 주석 "나머지 키는 손대지 않는다"):

```json
  "site": { "airport": { "code": "ICN", "lat": 37.46, "lon": 126.44 } },
```

`src/lib/facts.ts`의 `factsSchema`에서 `profile` 줄 위에:

```ts
  // 첫 화면 메타 줄(설계 2026-09-28 §4.4): 인천공항 좌표. 문구 파일에 숫자를 쓰지 않으려고 여기 둔다
  site: z.object({ airport: z.object({ code: z.string().length(3), lat: z.number(), lon: z.number() }) }),
```

- [ ] **Step 4: 로딩 화면** — `src/components/Loader.tsx`의 `return`을 바꾼다

```tsx
  return (
    <div className="loader" aria-hidden="true">
      {/* 설계 2026-09-28 §4.3: 가운데 큰 숫자 + 진행선. 숫자 플립·1.2초 고정 연출·CSS로 사라짐은 그대로 */}
      <p className="loader-label">NOW BOARDING</p>
      {/* React는 {rows}를 한 번만 그리고 flip()이 자식을 바꿔 끼운다 — Loader가 다시 그려지지 않으므로 안전하다 */}
      <p className="loader-num"><span data-count ref={count}>{rows}</span></p>
      <span className="loader-bar"><i /></span>
      <p className="loader-label">ROWS</p>
    </div>
  );
```

`src/styles/globals.css`의 로딩 규칙(`.loader { … }`부터 `html.no-loader .loader`까지)을 다음으로 바꾼다:

```css
/* 로딩 화면(설계 2026-09-28 §4.3): 가운데 NOW BOARDING → 큰 숫자 → 호박색 진행선 → ROWS. 0.85초에 사라진다 */
.loader { position: fixed; inset: 0; z-index: 90; display: grid; place-content: center; justify-items: center; gap: 14px;
  background: var(--bg); pointer-events: none; animation: loader-out 0.35s var(--ease) 0.85s forwards; }
.loader-label { font: 500 0.72rem var(--font-mono); letter-spacing: 0.4em; padding-left: 0.4em; color: var(--amb); }
.loader-num { font: 500 clamp(2.4rem, 6vw, 4.4rem) var(--font-mono); letter-spacing: -0.02em; line-height: 1; color: var(--tx); font-variant-numeric: tabular-nums; }
.loader-bar { position: relative; width: min(260px, 60vw); height: 1px; overflow: hidden; background: rgba(238, 243, 255, 0.14); }
.loader-bar i { position: absolute; inset: 0; background: var(--amb); transform-origin: left; transform: scaleX(0);
  animation: loader-fill 0.8s var(--ease) forwards; }
@keyframes loader-fill { to { transform: scaleX(1); } }
@keyframes loader-out { to { opacity: 0; visibility: hidden; } }
html.no-loader .loader { display: none; }
@media (prefers-reduced-motion: reduce) { .loader-bar i { animation: none; transform: scaleX(1); } }
```

- [ ] **Step 5: 첫 화면 메타 줄** — `src/components/sections/Hero.tsx`

import에 `import { facts } from '@/lib/facts';`를 더하고, `hero-copy` 뒤(대체 이미지 `ChapterFigure` 앞)에:

```tsx
      {/* 오른쪽 아래 메타 줄(설계 §4.4): 공항 좌표와 노선. 숫자는 facts에서 조립한다. 장식이라 낭독하지 않는다 */}
      <p className="hero-meta mono" aria-hidden="true">
        {facts.site.airport.code} · {facts.site.airport.lat.toFixed(2)}°N {facts.site.airport.lon.toFixed(2)}°E<br />
        {facts.site.airport.code} ⇄ {[...new Set(facts.data.byRoute.map((r) => r.pair.split('_')[1]))].join(' · ')}
      </p>
```

CSS(첫 화면 규칙 `.hero-keywords { … }` 뒤):

```css
.hero-meta { position: absolute; right: 0; bottom: 12vh; text-align: right; font-size: 0.66rem; letter-spacing: 0.18em;
  line-height: 2; color: rgba(238, 243, 255, 0.42); }
@media (max-width: 767px) { .hero-meta { display: none; } }
```
(`.hero`는 이미 `position: relative`다.)

- [ ] **Step 6: 확인**

Run: `npm run typecheck && npm test && npm run build && npx playwright test tests/e2e/motion.spec.ts`
Expected: PASS

- [ ] **Step 7: 커밋**

```bash
git add src/components/Loader.tsx src/styles/globals.css tests/e2e/motion.spec.ts data/facts.json src/lib/facts.ts src/components/sections/Hero.tsx tests/unit/facts.test.ts
git commit -m "feat: NOW BOARDING loader; airport meta line on the hero

Co-Authored-By: <model> <noreply@anthropic.com>"
```

---

### Task 2: 공항 불빛 배치 (순수 모듈)

**Files:**
- Create: `src/three/airport.ts`
- Test: `tests/unit/airport.test.ts`

- [ ] **Step 1: 실패하는 테스트**

```ts
// 공항 배치 검사: 종류별 개수, 색은 파랑·호박·흰색·따뜻한 흰색뿐(빨강·초록 없음), 켜지는 순서 0~1.1,
// 활주로 등만 신호 물결 위치(runS)를 가진다, 좌표 변환(z 뒤집기·축척), 휴대폰은 절반.
import { describe, expect, it } from 'vitest';
import { AIR_TONE, buildAirport, K, runwayPoint, toWorld } from '@/three/airport';

describe('buildAirport', () => {
  const A = buildAirport({ stride: 1 });
  const count = (k: string) => A.lights.filter((l) => l.kind === k).length;
  it('종류별 개수(시안과 같은 간격)', () => {
    expect(count('edge')).toBe(108);
    expect(count('center')).toBe(177); // s = 30, 48, …, 3198
    expect(count('thr') + count('end')).toBe(22);
    expect(count('taxi')).toBe(202 + 60);
    expect(count('apron')).toBe(4);
    expect(count('city')).toBe(160);
    expect(count('win')).toBeGreaterThan(250);
  });
  it('색은 파랑·호박·흰색·따뜻한 흰색뿐', () => {
    const tones = new Set(A.lights.map((l) => l.tone));
    for (const t of tones) expect([AIR_TONE.blue, AIR_TONE.amber, AIR_TONE.white, AIR_TONE.warm]).toContain(t);
  });
  it('켜지는 순서는 0~1.1, 활주로 가장자리·중앙등만 runS ≥ 0', () => {
    for (const l of A.lights) {
      expect(l.ord).toBeGreaterThanOrEqual(0); expect(l.ord).toBeLessThanOrEqual(1.1);
      expect(l.runS >= 0).toBe(l.kind === 'edge' || l.kind === 'center');
    }
  });
  it('같은 시드면 같은 배치(캡처 이미지가 매번 같다)', () => {
    expect(buildAirport({ stride: 1 }).lights.map((l) => l.pos.join()).join()).toBe(A.lights.map((l) => l.pos.join()).join());
  });
  it('휴대폰(stride 2)은 약 절반', () => {
    const half = buildAirport({ stride: 2 }).lights.length;
    expect(half).toBeGreaterThanOrEqual(Math.floor(A.lights.length / 2) - 1);
    expect(half).toBeLessThanOrEqual(Math.ceil(A.lights.length / 2) + 1);
  });
  it('경고등은 불빛 목록 밖 한 개, 진입등 14개', () => {
    expect(A.beacon).toHaveLength(3);
    expect(A.approach).toHaveLength(14);
  });
});

describe('좌표', () => {
  it('시안 미터 → 사이트 월드: 축척 K, z 뒤집기', () => {
    expect(toWorld(100, 50, 200)).toEqual([100 * K, 50 * K, -200 * K]);
  });
  it('활주로 시작점과 끝점', () => {
    expect(runwayPoint(0, 0)).toEqual([-60, 180]);
    const [x, z] = runwayPoint(3200, 0);
    expect(x).toBeCloseTo(-60 + Math.sin(0.62) * 3200, 6);
    expect(z).toBeCloseTo(180 + Math.cos(0.62) * 3200, 6);
  });
});
```

- [ ] **Step 2: 실패 확인** — `npx vitest run tests/unit/airport.test.ts` → FAIL(모듈 없음)

- [ ] **Step 3: 구현** — `src/three/airport.ts`

```ts
// 밤의 공항 첫 화면(설계 2026-09-28 §4) 배치: 시안(docs/superpowers/mockups/2026-09-28/01-night-airport.html)의
// 활주로·유도로·계류장·창문·도시 불빛 자리를 그대로 옮긴다. 시안은 미터 단위이고 +z를 보므로, 사이트 월드로는
// 축척 K를 곱하고 z를 뒤집는다(three.js 카메라는 −z를 본다 — 뒤집지 않으면 좌우가 바뀐다).
// React·three에 의존하지 않는 순수 모듈이다.

export const K = 0.01;
// 색 번호: 셰이더(shaders.ts airTone)와 같은 순서. 1 파랑(유도로), 2 호박(계류장), 3 흰색, 4 따뜻한 흰색
export const AIR_TONE = { blue: 1, amber: 2, white: 3, warm: 4 } as const;

export type AirKind = 'edge' | 'center' | 'thr' | 'end' | 'taxi' | 'apron' | 'win' | 'city';
// pos: 사이트 월드 좌표, size: 크기 배율, ord: 켜지는 순서(0 앞 → 1 뒤), runS: 활주로 위 거리(m, 신호 물결용), 아니면 -1
export type AirLight = { pos: [number, number, number]; tone: number; size: number; ord: number; runS: number; kind: AirKind };

// 활주로(시안과 같은 값): 방향 각 RA, 시작점 R0, 길이 RLEN, 반폭 RHALF, 평행 유도로 옆 거리 TO
export const RUNWAY = { angle: 0.62, start: [-60, 180] as [number, number], length: 3200, half: 30, taxiOffset: -190 } as const;
const RD = [Math.sin(RUNWAY.angle), Math.cos(RUNWAY.angle)];
const RN = [RD[1], -RD[0]];

// 활주로 좌표(s: 시작점에서 거리, o: 옆 거리) → 시안 평면 (x, z) 미터
export function runwayPoint(s: number, o: number): [number, number] {
  return [RUNWAY.start[0] + RD[0] * s + RN[0] * o, RUNWAY.start[1] + RD[1] * s + RN[1] * o];
}

export function toWorld(x: number, y: number, z: number): [number, number, number] {
  return [x * K, y * K, -z * K];
}

// 시안과 같은 시드 난수(Park–Miller) — 창문·도시 불빛이 매번 같은 자리에 온다(대체 이미지가 같게)
function rng(seed: number) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
}

const BUILDINGS: [number, number, number, number][] = [ // [s, o, 폭, 높이] 미터 — 활주로 건너편·먼 쪽
  [300, 520, 260, 26], [650, 560, 180, 34], [1000, 620, 420, 22], [1600, 600, 300, 30], [2100, 700, 520, 18],
  [2700, 650, 240, 28], [3000, 800, 380, 20], [1300, -1900, 520, 40], [2300, -2000, 380, 55], [3100, -2100, 600, 34],
];
const APRON: [number, number][] = [[-40, 150], [160, 110], [360, 60], [-260, 260]];
const CONNECTORS = [500, 1300, 2200];

export type Airport = {
  lights: AirLight[];
  beacon: [number, number, number];      // 빨간 경고등(화면에서 유일한 빨강, 관제탑 자리)
  approach: [number, number, number][];  // 진입등(활주로 끝 너머, 섬광이 활주로 쪽으로 달린다)
};

// stride: 휴대폰은 2(불빛 절반, 설계 §4.5). 순서대로 stride번째마다 남긴다
export function buildAirport({ stride }: { stride: number }): Airport {
  const rnd = rng(7);
  const L: AirLight[] = [];
  const add = (xz: [number, number], y: number, tone: number, kind: AirKind, size: number, ord: number, runS = -1) =>
    L.push({ pos: toWorld(xz[0], y, xz[1]), tone, size, ord: Math.min(1.1, Math.max(0, ord)), runS, kind });
  const { length: RLEN, half: RH, taxiOffset: TO } = RUNWAY;
  for (let s = 0; s <= RLEN; s += 60) {
    add(runwayPoint(s, -RH), 0.5, AIR_TONE.white, 'edge', 1, s / RLEN, s);
    add(runwayPoint(s, RH), 0.5, AIR_TONE.white, 'edge', 1, s / RLEN, s);
  }
  // 중앙등: 끝 900m는 따뜻한 흰색(실제 활주로와 같은 규칙)
  for (let s = 30; s < RLEN; s += 18) add(runwayPoint(s, 0), 0.2, s > RLEN - 900 ? AIR_TONE.warm : AIR_TONE.white, 'center', 0.45, s / RLEN, s);
  // 시작·끝 줄: 실제는 초록·빨강이지만 흰색·따뜻한 흰색으로(설계 §4.1 — 빨강은 경고등 하나뿐)
  for (let o = -RH; o <= RH; o += 6) {
    add(runwayPoint(0, o), 0.5, AIR_TONE.white, 'thr', 0.6, 0);
    add(runwayPoint(RLEN, o), 0.5, AIR_TONE.warm, 'end', 0.6, 1);
  }
  for (let s = -200; s <= RLEN; s += 34) {
    add(runwayPoint(s, TO - 11), 0.3, AIR_TONE.blue, 'taxi', 0.6, (s + 200) / RLEN);
    add(runwayPoint(s, TO + 11), 0.3, AIR_TONE.blue, 'taxi', 0.6, (s + 200) / RLEN);
  }
  for (const s0 of CONNECTORS) {
    for (let i = 0; i <= 9; i++) {
      const t = i / 9, o = TO + 11 + (-RH - 10 - (TO + 11)) * t, s = s0 + Math.sin((t * Math.PI) / 2) * 160;
      add(runwayPoint(s, o - 8), 0.3, AIR_TONE.blue, 'taxi', 0.55, s / RLEN);
      add(runwayPoint(s, o + 8), 0.3, AIR_TONE.blue, 'taxi', 0.55, s / RLEN);
    }
  }
  for (const p of APRON) add(p, 26, AIR_TONE.amber, 'apron', 2.2, 0);
  // 건물: 형체 없이 창문 불빛만(설계 §4.1). 줄 = 높이/9, 칸 = 폭/14, 45%만 켠다
  for (const [s, o, w, h] of BUILDINGS) {
    const a = runwayPoint(s - w / 2, o), e = runwayPoint(s + w / 2, o);
    const rows = Math.max(1, Math.floor(h / 9)), cols = Math.floor(w / 14);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      if (rnd() >= 0.45) continue;
      const u = (c + 0.5) / cols, tone = rnd() < 0.2 ? AIR_TONE.white : AIR_TONE.warm;
      add([a[0] + (e[0] - a[0]) * u, a[1] + (e[1] - a[1]) * u], h * ((r + 0.5) / rows), tone, 'win', 0.8, 1.05);
    }
  }
  // 먼 도시: 지평선의 작은 반짝임
  for (let i = 0; i < 160; i++) {
    const ang = -0.9 + rnd() * 1.9, r = 9000 + rnd() * 6000;
    const y = rnd() * 40, tone = rnd() < 0.7 ? AIR_TONE.warm : AIR_TONE.white;
    add([Math.sin(ang) * r, Math.cos(ang) * r], y, tone, 'city', 1.3, 1.1);
  }
  const tw = runwayPoint(1500, -520);
  return {
    lights: stride > 1 ? L.filter((_, i) => i % stride === 0) : L,
    beacon: toWorld(tw[0], 60, tw[1]),
    approach: Array.from({ length: 14 }, (_, i) => { const p = runwayPoint(RLEN + (i + 1) * 30, 0); return toWorld(p[0], 1, p[1]); }),
  };
}

// 착륙 비행기 위치(사이클 20초 중 u = 0..1): 멀리서 내려와 접지 후 감속(시안과 같은 경로). 보이지 않을 때 null
export function landingPlane(u: number): [number, number, number] | null {
  if (u >= 0.8) return null;
  const k = u / 0.8, RLEN = RUNWAY.length;
  const ease = (t: number) => 1 - Math.pow(1 - t, 4);
  const s = k < 0.6 ? RLEN + 5200 + (RLEN - 250 - (RLEN + 5200)) * (k / 0.6) : RLEN - 250 + (900 - (RLEN - 250)) * ease((k - 0.6) / 0.4);
  const [x, z] = runwayPoint(s, 0);
  return toWorld(x, Math.max(3, (s - (RLEN - 250)) * 0.052), z);
}

// 유도로를 천천히 지나가는 비행기(시안: 초당 22m, 3,000m 주기)
export function taxiPlane(t: number): [number, number, number] {
  const s = 2800 - ((t * 22) % 3000);
  const [x, z] = runwayPoint(s, RUNWAY.taxiOffset);
  return toWorld(x, 4, z);
}
```

- [ ] **Step 4: 통과 확인** — `npx vitest run tests/unit/airport.test.ts` → PASS. 개수가 다르면 루프 경계를 시안 코드와 한 줄씩 대조한다(시안이 기준이다). 창문 개수 하한(250)은 시드에 따라 다르니 실제 값을 보고 테스트 주석에 적는다.

- [ ] **Step 5: 커밋** — `git add src/three/airport.ts tests/unit/airport.test.ts` → `git commit -m "feat(3d): night-airport light layout (pure)"` + Co-Authored-By

---

### Task 3: 불빛 → 점 구름 배정 (순수 모듈)

**Files:**
- Create: `src/three/airportAssign.ts`
- Test: `tests/unit/airport-assign.test.ts`

- [ ] **Step 1: 실패하는 테스트**

```ts
// 배정 검사: 불빛마다 서로 다른 점 하나, 신호 점부터(모자라면 잡음), 배정 안 된 점은 스타일 알파 0,
// 활주로 거리(runS)와 켜지는 순서가 그 점의 속성으로 들어간다.
import { describe, expect, it } from 'vitest';
import type { AirLight } from '@/three/airport';
import { assignAirport } from '@/three/airportAssign';

const light = (i: number, runS = -1): AirLight => ({ pos: [i, i, i], tone: 3, size: 1, ord: 0.5, runS, kind: 'edge' });

describe('assignAirport', () => {
  const kind = Float32Array.from([1, 0, 2, 0, 1, 0]); // 신호 점: 1, 3, 5
  it('신호 점부터 차례로, 서로 다른 점', () => {
    const r = assignAirport([light(0, 10), light(1), light(2)], kind);
    const used = [1, 3, 5];
    for (const [j, i] of used.entries()) {
      expect(Array.from(r.pos.slice(i * 3, i * 3 + 3))).toEqual([j, j, j]);
      expect(r.style[i * 4]).toBe(1); // 알파(= 공항 불빛)
    }
    expect(r.runS[1]).toBe(10);
    expect(r.runS[3]).toBe(-1);
  });
  it('신호가 모자라면 잡음 점, 제거 레이어(kind 2)는 쓰지 않는다', () => {
    const r = assignAirport([light(0), light(1), light(2), light(3), light(4)], kind);
    const lit = [0, 1, 2, 3, 4, 5].filter((i) => r.style[i * 4] === 1);
    expect(lit).toEqual([0, 1, 3, 4, 5]);
    expect(r.style[2 * 4]).toBe(0);
  });
  it('불빛이 점보다 많으면 남는 불빛은 버리고 개수를 알려 준다', () => {
    const r = assignAirport(Array.from({ length: 9 }, (_, i) => light(i)), kind);
    expect(r.assigned).toBe(5);
  });
});
```

- [ ] **Step 2: 실패 확인** — `npx vitest run tests/unit/airport-assign.test.ts` → FAIL

- [ ] **Step 3: 구현** — `src/three/airportAssign.ts`

```ts
// 공항 불빛을 점 구름의 점에 하나씩 배정해 셰이더 속성 버퍼를 만든다(설계 2026-09-28 §4.5).
// 신호 점(kind 0)부터 쓴다 — 첫 화면에서 ①로 넘어가면 불빛 하나하나가 그 점의 지형 자리(밝은 신호 점)로 옮겨 가
// "불빛이 곧 데이터"가 된다. 모자라면 잡음 점(kind 1). 제거 레이어(kind 2)는 차트 3 전용이라 쓰지 않는다.
import type { AirLight } from './airport';

export type AirportBuffers = {
  pos: Float32Array;    // 점마다 공항 자리(xyz). 배정 안 된 점은 0
  style: Float32Array;  // 점마다 (알파 1/0, 색 번호, 크기 배율, 켜지는 순서)
  runS: Float32Array;   // 점마다 활주로 거리(m, 신호 물결), 아니면 -1
  assigned: number;
};

export function assignAirport(lights: AirLight[], kind: Float32Array): AirportBuffers {
  const n = kind.length;
  const out: AirportBuffers = { pos: new Float32Array(n * 3), style: new Float32Array(n * 4), runS: new Float32Array(n).fill(-1), assigned: 0 };
  const order: number[] = [];
  for (let i = 0; i < n; i++) if (kind[i] < 0.5) order.push(i);
  for (let i = 0; i < n; i++) if (kind[i] > 0.5 && kind[i] < 1.5) order.push(i);
  const m = Math.min(lights.length, order.length);
  for (let j = 0; j < m; j++) {
    const i = order[j], l = lights[j];
    out.pos.set(l.pos, i * 3);
    out.style.set([1, l.tone, l.size, l.ord], i * 4);
    out.runS[i] = l.runS;
  }
  out.assigned = m;
  return out;
}
```

- [ ] **Step 4: 통과 확인** → PASS. **Step 5: 커밋** — `feat(3d): assign airport lights to point-cloud points`

---

### Task 4: 셰이더와 점 재질 — 공항 불빛 그리기

**Files:**
- Modify: `src/three/shaders.ts`, `src/three/TerrainPoints.tsx`, `src/three/TerrainScene.tsx`(점 구름 만들 때 배정 호출)

이 태스크는 단위 테스트가 없다(GL). Task 5의 e2e와 Task 9의 스크린샷으로 확인한다. 타입 검사·기존 테스트·용량만 본다.

- [ ] **Step 1: 셰이더** — `src/three/shaders.ts`

(a) 속성·uniform 선언(기존 `attribute float aWaffle;` 아래, `uniform float uFocus;` 아래):

```glsl
  attribute vec3 aAirport;   // 공항 불빛 자리(설계 2026-09-28 §4.5)
  attribute vec4 aAirStyle;  // (공항 불빛이면 1, 색 번호, 크기 배율, 켜지는 순서)
  attribute float aRunS;     // 활주로 위 거리(m) — 신호 물결. 아니면 -1
```
```glsl
  uniform float uAirport;    // 1 = 공항 장면, 0 = 지형·지도·차트
  uniform float uLightT;     // 불이 켜지기 시작한 뒤 흐른 초(앞에서 뒤로 차례로 켜짐)
  uniform float uWave;       // 신호 물결의 지금 위치(활주로 거리 m)
  uniform vec3 uWarm;        // 따뜻한 흰색(공항 전용)
  varying float vAir;        // 이 점이 지금 공항 불빛으로 그려지는 정도(조각 셰이더가 모양을 바꾼다)
```

(b) 색 표에 공항 색을 더한다(기존 `toneColor` 아래):

```glsl
  // 공항 색 번호(airport.ts AIR_TONE): 1 파랑, 2 호박, 3 흰색, 4 따뜻한 흰색
  vec3 airTone(float t) { return t > 3.5 ? uWarm : (t > 2.5 ? uText : (t > 1.5 ? uAmber : uDot)); }
```

(c) `main()`에서 위치: 차트 섞기 줄(`p = mix(p, mix(aChartA, aChartB, uSlot) + …, uChart);`) **바로 앞**에:

```glsl
    // 공항: 불빛으로 배정된 점만 공항 자리로. uAirport가 1→0으로 줄면 자기 지형 자리로 옮겨 간다
    float isAir = aAirStyle.x;
    p = mix(p, aAirport, uAirport * isAir);
```

(d) 크기: `gl_PointSize = mix(terrainPx, chartPx, uChart);` 줄을 다음으로 바꾼다:

```glsl
    // 공항 불빛: 작고 선명한 점 + 옅은 번짐(시안 core = clamp(5.5·size/거리, 0.6, 2.6)px, 번짐 반경 = core × 9).
    // 스프라이트 지름 = 번짐 지름이고, 조각 셰이더가 가운데 core만 또렷하게 칠한다
    float corePx = clamp(5.5 * aAirStyle.z / max(-mv.z, 0.01), 0.6, 2.6) * uDpr;
    float airPx = corePx * 18.0;
    float basePx = mix(terrainPx, chartPx, uChart);
    vAir = uAirport * isAir;
    gl_PointSize = mix(basePx, airPx, vAir);
```

(e) 알파·색: `vAlpha = mix(a * uDim, chartA, uChart);` 와 `vColor = mix(terrainCol, chartCol, uChart);` 두 줄 뒤에:

```glsl
    // 켜지는 순서(로딩 뒤 앞에서 뒤로) + 공기 원근(멀수록 흐림) + 신호 물결
    float on = clamp((uLightT - aAirStyle.w * 1.2) / 0.18, 0.0, 1.0);
    float haze = 1.0 / (1.0 + (-mv.z) / 52.0);
    float wave = aRunS < 0.0 ? 0.0 : exp(-pow((aRunS - uWave) / 90.0, 2.0));
    float airA = on * haze * (1.0 + wave * 2.2);
    vAlpha = mix(vAlpha * (1.0 - uAirport), airA, vAir); // 공항 장면에서 불빛이 아닌 점은 숨긴다
    vColor = mix(vColor, airTone(aAirStyle.y), vAir);
    vEdge = mix(vEdge, 0.0, vAir);
```

(f) 조각 셰이더: `varying float vAir;`를 더하고 `main()`을 바꾼다:

```glsl
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    // 공항 불빛: 가운데 또렷한 핵(반경 = 스프라이트의 1/18) + 가우스 번짐
    float core = 1.0 - smoothstep(0.022, 0.034, d);
    float glow = exp(-d * d * 60.0) * 0.55;
    float air = max(core, glow);
    float disc = smoothstep(0.5, vEdge, d); // 이름을 dot으로 하면 GLSL 내장 함수와 겹친다
    gl_FragColor = vec4(vColor, vAlpha * mix(disc, air, vAir));
  }
```

- [ ] **Step 2: `TerrainPoints.tsx`**

(a) props에 `airport: AirportBuffers | null`을 더하고(`import type { AirportBuffers } from './airportAssign';`), `geometry` 안에서:

```ts
    // 공항 불빛(설계 2026-09-28 §4.5): 배정이 없으면(캡처 등) 모두 0 → 공항 장면에서 점이 안 보인다
    const air = airport ?? { pos: new Float32Array(cloud.count * 3), style: new Float32Array(cloud.count * 4), runS: new Float32Array(cloud.count).fill(-1) };
    g.setAttribute('aAirport', new THREE.BufferAttribute(air.pos, 3));
    g.setAttribute('aAirStyle', new THREE.BufferAttribute(air.style, 4));
    g.setAttribute('aRunS', new THREE.BufferAttribute(air.runS, 1));
```
`useMemo` 의존성에 `airport`를 더한다.

(b) uniforms: `uAirport: { value: target.current?.airport ?? 0 }, uLightT: { value: instant ? 99 : 0 }, uWave: { value: -1e4 }, uWarm: { value: new THREE.Color('#FFE2B8') },` — 초기값이 목표와 같아야 첫 프레임에 지형이 번쩍 보이지 않는다.

(c) `useFrame`에서:

```ts
    step('uAirport', t.airport);
    // 불 켜짐은 3D가 뜬 순간부터 센다(로딩 화면은 그 전에 끝난다). 캡처 모드는 다 켜진 상태로 고정
    u.uLightT.value = instant ? 99 : state.clock.elapsedTime;
    // 신호 물결: 3초 뒤부터 초당 700m로 활주로를 따라 달리고 5,800m마다 되풀이(시안과 같은 속도)
    const wt = state.clock.elapsedTime - 3;
    u.uWave.value = instant || wt < 0 ? -1e4 : (wt * 700) % 5800;
```

- [ ] **Step 3: `TerrainScene.tsx`에서 배정을 만든다**

import: `import { buildAirport } from './airport'; import { assignAirport } from './airportAssign';`

`cloud` `useMemo` 뒤에:

```ts
  // 공항 불빛 배정: 세로 화면(대개 휴대폰)은 불빛 절반(설계 §4.5)
  const airport = useMemo(() => {
    if (!cloud) return null;
    const isPortrait = typeof window !== 'undefined' && window.innerHeight > window.innerWidth;
    return assignAirport(buildAirport({ stride: isPortrait ? 2 : 1 }).lights, cloud.kind);
  }, [cloud]);
```
`<TerrainPoints … airport={airport} />`로 넘긴다.

- [ ] **Step 4: 타입이 요구하는 `SceneState.airport`를 더한다** — `src/three/scenes.ts`의 `SceneState`에 `airport: number; // 1 = 밤의 공항(첫 화면), 0 = 그 밖`과 `sway: number; // 첫 화면 마우스 시차 크기(월드 단위)`를 더하고, `base`에 `airport: 0, sway: 0`을 더한다. `hero`는 Task 5에서 바꾼다. `CameraRig.tsx`의 `const sway = parallax.current ? 1.2 : 0;`을 `const sway = parallax.current ? t.sway : 0;`로 바꾸고, 지금 동작을 유지하려고 `hero`에 `sway: 1.2`를 임시로 준다(Task 5에서 공항 값으로 바뀐다).

- [ ] **Step 5: 확인** — `npm run typecheck && npm test && npm run build && npm run size`. 3D 청크 숫자를 적는다(≤ 256,000B). `tests/unit/three-scenes.test.ts`가 장면 객체를 통째로 비교해 실패하면 새 필드를 넣어 맞춘다.

- [ ] **Step 6: 커밋** — `feat(3d): point shader draws airport lights (uAirport, light-on order, signal wave)`

---

### Task 5: 공항 장면·내려앉기·첫 화면 여백

**Files:**
- Modify: `src/three/scenes.ts`, `tests/unit/three-scenes.test.ts`, `src/three/TerrainScene.tsx`, `src/components/sections/Hero.tsx`, `src/styles/globals.css`
- Test: `tests/e2e/airport.spec.ts` (새로)

- [ ] **Step 1: 실패하는 단위 테스트** — `tests/unit/three-scenes.test.ts`에 더한다

```ts
describe('밤의 공항 첫 화면(설계 2026-09-28 §4.2)', () => {
  it('hero만 공항 장면', () => {
    for (const k of KEYS) expect(SCENES[k].airport, k).toBe(k === 'hero' ? 1 : 0);
  });
  it('진행도 0은 A(높은 창가), 1은 B(낮게 내려앉음) — 같은 x·z, 눈높이만 낮다', () => {
    const a = sceneFor('hero', 0, false), b = sceneFor('hero', 1, false);
    expect(a.camera[0]).toBeCloseTo(b.camera[0], 6);
    expect(a.camera[2]).toBeCloseTo(b.camera[2], 6);
    expect(b.camera[1]).toBeLessThan(a.camera[1]);
    const m = sceneFor('hero', 0.5, false);
    expect(m.camera[1]).toBeLessThan(a.camera[1]);
    expect(m.camera[1]).toBeGreaterThan(b.camera[1]);
  });
  it('첫 화면 마우스 시차는 공항 크기에 맞게 작다', () => {
    expect(SCENES.hero.sway).toBeLessThanOrEqual(0.1);
  });
});
```

기존 테스트 중 `hero`의 세로 화면 1.6배·글 쪽 장면 목록(`TEXT_SIDE`) 테스트는 공항 카메라와 맞지 않는다. `TEXT_SIDE` 목록에서 `'hero'`를 빼고, "세로 화면은 카메라가 목표점에서 1.6배" 테스트의 `hero`를 `about`으로 바꾼다(공항 장면은 세로 화면 전용 구도를 Step 3에서 따로 준다).

- [ ] **Step 2: 실패 확인** — `npx vitest run tests/unit/three-scenes.test.ts` → FAIL

- [ ] **Step 3: 장면 표** — `src/three/scenes.ts`

```ts
// 밤의 공항(설계 2026-09-28 §4.2): A = 터미널 창가(눈높이 약 42m), B = 땅 가까이(약 12m). 같은 방향을 본다.
// 값은 시안(mockups/2026-09-28/01-night-airport.html)의 카메라를 사이트 좌표(airport.ts K·z 뒤집기)와 fov 40°로 옮긴 것
export const AIRPORT_CAM = {
  a: { camera: [-1.2, 0.42, 1.6] as SceneState['camera'], target: [0.781, -0.321, -8.174] as SceneState['target'] },
  b: { camera: [-1.2, 0.12, 1.6] as SceneState['camera'], target: [0.777, -0.85, -8.154] as SceneState['target'] },
};
```
`SCENES.hero`를 `hero: { ...base, camera: AIRPORT_CAM.a.camera, target: AIRPORT_CAM.a.target, airport: 1, sway: 0.06, noise: 0 },`로 바꾼다(주석: "첫 화면: 밤의 공항. 진행도(내려앉기)는 sceneFor가 A→B로 보간").

`PORTRAIT_OVERRIDE`의 `hero` 줄을 지운다(공항은 아래 전용 처리).

`sceneFor` 맨 앞(차트 분기보다 앞)에:

```ts
  if (key === 'hero') {
    // 공항: 진행도 = 내려앉은 정도(TerrainScene이 스크롤로 계산). 세로 화면은 같은 방향에서 조금 물러나 넓게 본다
    const e = smooth(p);
    const lerp3 = (u: number[], v: number[]) => u.map((x, i) => x + (v[i] - x) * e) as [number, number, number];
    let camera = lerp3(AIRPORT_CAM.a.camera, AIRPORT_CAM.b.camera);
    const target = lerp3(AIRPORT_CAM.a.target, AIRPORT_CAM.b.target);
    if (portrait) camera = camera.map((v, i) => target[i] + (v - target[i]) * 1.25) as [number, number, number];
    return { ...s, camera, target, drop: 0 };
  }
```
(`p`·`smooth`는 이 함수·파일에 이미 있다. `p` 선언보다 앞이면 `const p = …` 줄 뒤에 둔다.)

- [ ] **Step 4: 통과 확인** — `npx vitest run tests/unit/three-scenes.test.ts` → PASS

- [ ] **Step 5: 내려앉기 진행도** — `src/three/TerrainScene.tsx` `update()`에서 `const s = sceneFor(active.key, active.progress, portrait.current);`를:

```ts
      // 첫 화면은 섹션 안 진행도가 아니라 스크롤 위치로 내려앉는다(처음 화면에서 진행도가 이미 0.5 근처라서)
      const progress = active.key === 'hero' ? Math.min(1, window.scrollY / (0.9 * window.innerHeight)) : active.progress;
      const s = sceneFor(active.key, progress, portrait.current);
```

`parallax.current = active.key === 'hero';`는 그대로 둔다.

- [ ] **Step 6: 첫 화면 감싸개와 여백** — `src/components/sections/Hero.tsx`

`<section id="hero" data-scene="hero" className="hero wrap">`에서 `data-scene`을 빼고 섹션을 감싼다:

```tsx
    // 감싸개가 장면 이름을 가진다 — 3D가 켜지면 아래 여백(globals.css)까지 첫 화면 장면이라 그동안 카메라가 내려앉는다
    <div className="hero-stage" data-scene="hero">
      <section id="hero" className="hero wrap">
        …(기존 내용 그대로)…
      </section>
    </div>
```

CSS(첫 화면 규칙 근처):

```css
/* 3D가 켜졌을 때만 첫 화면 뒤에 60vh를 둔다 — 스크롤하는 동안 카메라가 땅 가까이 내려앉을 거리(설계 §4.2).
   첫 화면(88vh) 아래라 3D가 켜지는 순간 보이는 글은 움직이지 않는다(CLS 0) */
html[data-3d="on"] .hero-stage { padding-bottom: 60vh; }
```

- [ ] **Step 7: e2e** — `tests/e2e/airport.spec.ts` 새로

```ts
// 밤의 공항 첫 화면 e2e(설계 2026-09-28 §4): 처음엔 hero 장면, 첫 화면 뒤 여백을 지나는 동안 계속 hero,
// ①에 오면 지형(about)으로. 3D가 켜져도 첫 화면 글 위치는 그대로(CLS).
import { expect, test } from '@playwright/test';

test.describe('3D 켜짐', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-3d', /^(on|off)$/, { timeout: 20_000 });
    test.skip((await page.locator('html').getAttribute('data-3d')) !== 'on', '3D가 꺼진 환경');
  });

  test('처음엔 공항(hero), 여백 동안 hero, ①에서 지형(about)', async ({ page }) => {
    await expect(page.locator('html')).toHaveAttribute('data-active-scene', 'hero');
    await page.evaluate(() => window.scrollTo(0, window.innerHeight * 0.9));
    await expect(page.locator('html')).toHaveAttribute('data-active-scene', 'hero');
    await page.locator('#project-h').evaluate((n) => n.scrollIntoView({ block: 'center' }));
    await expect(page.locator('html')).toHaveAttribute('data-active-scene', 'about', { timeout: 10_000 });
  });
});

test('3D가 켜져도 첫 화면 이름 위치가 그대로다(여백은 화면 밖)', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const before = await page.locator('.hero-name').boundingBox();
  await expect(page.locator('html')).toHaveAttribute('data-3d', /^(on|off)$/, { timeout: 20_000 });
  const after = await page.locator('.hero-name').boundingBox();
  expect(Math.abs(after!.y - before!.y)).toBeLessThanOrEqual(1);
});
```

Run: `npm run build && npx playwright test tests/e2e/airport.spec.ts tests/e2e/terrain.spec.ts`
Expected: PASS. `terrain.spec.ts`의 "처음엔 hero 장면" 같은 기존 검사가 `[data-scene="hero"]`를 `section#hero`에서 찾으면 감싸개로 바꾼다.

- [ ] **Step 8: 커밋** — `feat(3d): night-airport hero scene; camera settles low while scrolling the hero`

---

### Task 6: 공항 곁가지 — 바닥·웅덩이·표시·별·움직이는 불빛·경고등

**Files:**
- Create: `src/three/AirportExtras.tsx`
- Modify: `src/three/TerrainScene.tsx` (캔버스 안에 붙인다)

- [ ] **Step 1: 부품** — `src/three/AirportExtras.tsx`

```tsx
'use client';
// 밤의 공항(설계 2026-09-28 §4.1)에서 점 구름이 아닌 것: 활주로·유도로 바닥, 불빛이 바닥에 떨어진 웅덩이, 활주로 표시,
// 하늘의 별, 움직이는 불빛(착륙 비행기·진입등 섬광·유도로 비행기), 빨간 경고등 하나. 모두 첫 화면에서만 보이고
// ①로 넘어가며 사라진다(공항 장면 비율 airport를 TerrainPoints와 같은 속도로 따라간다).
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { buildAirport, landingPlane, runwayPoint, RUNWAY, taxiPlane, toWorld } from './airport';
import type { SceneState } from './scenes';

type Props = { target: React.RefObject<SceneState>; instant: boolean; portrait: boolean };

const DAMP = 2.2; // TerrainPoints와 같게 — 점과 곁가지가 함께 사라진다

// 둥근 빛 점 셰이더(곁가지 전용): 위치·색·크기(px)·알파를 받아 가산 합성으로 그린다
const glowVert = /* glsl */ `
  attribute vec3 color; attribute float size; attribute float alpha;
  uniform float uFade; uniform float uDpr; uniform float uTime;
  varying vec3 vColor; varying float vAlpha;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = size * uDpr;
    vColor = color;
    // 별(크기 ≤ 1.5px)만 천천히 반짝인다
    float tw = size <= 1.5 ? 0.7 + 0.3 * sin(uTime * 0.8 + position.x * 13.0) : 1.0;
    vAlpha = alpha * uFade * tw;
  }`;
const glowFrag = /* glsl */ `
  varying vec3 vColor; varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    gl_FragColor = vec4(vColor, vAlpha * exp(-d * d * 14.0));
  }`;

function glowMaterial() {
  return new THREE.ShaderMaterial({
    vertexShader: glowVert, fragmentShader: glowFrag, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uFade: { value: 1 }, uDpr: { value: 1 }, uTime: { value: 0 } },
  });
}

function glowGeometry(n: number) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('size', new THREE.BufferAttribute(new Float32Array(n), 1).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('alpha', new THREE.BufferAttribute(new Float32Array(n), 1).setUsage(THREE.DynamicDrawUsage));
  return g;
}

const C = { white: new THREE.Color('#EEF3FF'), warm: new THREE.Color('#FFE2B8'), blue: new THREE.Color('#8FB8FF'), amber: new THREE.Color('#FFB547'), red: new THREE.Color('#FF4A4A') };

export function AirportExtras({ target, instant, portrait }: Props) {
  const fade = useRef(target.current?.airport ?? 0);
  const air = useMemo(() => buildAirport({ stride: portrait ? 2 : 1 }), [portrait]);

  // 고정: 별 + 빛 웅덩이(계류장 조명·활주로 가장자리 아래 바닥)
  const statics = useMemo(() => {
    const pts: { p: [number, number, number]; c: THREE.Color; s: number; a: number }[] = [];
    let seed = 11; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < 90; i++) { // 별: 멀리(반경 150) 지평선 위 하늘에만
      const az = -1.1 + rnd() * 2.2, el = 0.03 + rnd() * 0.5, r = 150;
      pts.push({ p: [Math.sin(az) * r * Math.cos(el), Math.sin(el) * r, -Math.cos(az) * r * Math.cos(el)], c: C.white, s: 1 + rnd() * 0.5, a: 0.05 + rnd() * 0.2 });
    }
    for (const l of air.lights) {
      if (l.kind === 'apron') pts.push({ p: [l.pos[0], 0.002, l.pos[2]], c: C.amber, s: 120, a: 0.16 });
      else if (l.kind === 'edge') pts.push({ p: [l.pos[0], 0.002, l.pos[2]], c: C.white, s: 26, a: 0.07 });
      else if (l.kind === 'taxi') pts.push({ p: [l.pos[0], 0.002, l.pos[2]], c: C.blue, s: 18, a: 0.06 });
    }
    const g = glowGeometry(pts.length);
    pts.forEach((q, i) => {
      (g.attributes.position.array as Float32Array).set(q.p, i * 3);
      (g.attributes.color.array as Float32Array).set([q.c.r, q.c.g, q.c.b], i * 3);
      (g.attributes.size.array as Float32Array)[i] = q.s;
      (g.attributes.alpha.array as Float32Array)[i] = q.a;
    });
    return g;
  }, [air]);

  // 바닥: 활주로·평행 유도로 판(풀밭보다 아주 조금 밝게) + 활주로 표시(끝 줄무늬·착지 막대·중앙 점선)
  const ground = useMemo(() => {
    const quads: number[] = [];
    const quad = (s1: number, s2: number, o1: number, o2: number, y = 0) => {
      const a = runwayPoint(s1, o1), b = runwayPoint(s2, o1), c = runwayPoint(s2, o2), d = runwayPoint(s1, o2);
      const w = (p: [number, number]) => toWorld(p[0], y, p[1]);
      quads.push(...w(a), ...w(b), ...w(c), ...w(a), ...w(c), ...w(d));
    };
    const { length: RLEN, half: RH, taxiOffset: TO } = RUNWAY;
    const surface: number[] = [];
    quad(-30, RLEN + 30, -RH - 4, RH + 4); quad(-260, RLEN, TO - 13, TO + 13);
    surface.push(...quads.splice(0));
    for (const s of [RLEN - 40, 10]) for (let o = -26; o <= 26; o += 4.2) if (Math.abs(o) > 3) quad(s, s + 30, o - 1, o + 0.8, 0.05);
    for (const s of [150, 300, 450, RLEN - 480, RLEN - 330, RLEN - 180]) { quad(s, s + 22, -14, -9, 0.05); quad(s, s + 22, 9, 14, 0.05); }
    for (let s = 60; s < RLEN - 60; s += 50) quad(s, s + 30, -0.5, 0.5, 0.05);
    const geo = (arr: number[]) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3)); return g; };
    return { surface: geo(surface), marks: geo(quads) };
  }, []);
  const surfaceMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#0a0e18', transparent: true, depthWrite: false }), []);
  const markMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#c9d4ee', transparent: true, opacity: 0.08, depthWrite: false, blending: THREE.AdditiveBlending }), []);

  // 움직이는 것: 진입등 14 + 착륙 비행기 3(착륙등·양 날개) + 유도 비행기 3 + 경고등 1
  const movers = useMemo(() => glowGeometry(21), []);
  const staticMat = useMemo(glowMaterial, []);
  const moverMat = useMemo(glowMaterial, []);
  // 착륙등의 가는 가로 렌즈 플레어(설계 §4.1)
  const flare = useRef<THREE.Sprite>(null);
  const flareMat = useMemo(() => {
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 4;
    const g = cv.getContext('2d')!; const gr = g.createLinearGradient(0, 0, 256, 0);
    gr.addColorStop(0, 'rgba(238,243,255,0)'); gr.addColorStop(0.5, 'rgba(238,243,255,0.9)'); gr.addColorStop(1, 'rgba(238,243,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 256, 4);
    return new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: false });
  }, []);

  useFrame((state, delta) => {
    const goal = target.current?.airport ?? 0;
    fade.current = instant ? goal : THREE.MathUtils.damp(fade.current, goal, DAMP, delta);
    const f = fade.current, t = instant ? 6 : state.clock.elapsedTime, dpr = state.viewport.dpr;
    for (const m of [staticMat, moverMat]) { m.uniforms.uFade.value = f; m.uniforms.uDpr.value = dpr; m.uniforms.uTime.value = t; }
    surfaceMat.opacity = 0.9 * f; markMat.opacity = 0.08 * f; flareMat.opacity = f;
    const P = movers.attributes.position.array as Float32Array, Cc = movers.attributes.color.array as Float32Array;
    const S = movers.attributes.size.array as Float32Array, A = movers.attributes.alpha.array as Float32Array;
    const set = (i: number, p: [number, number, number] | null, c: THREE.Color, s: number, a: number) => {
      if (p) P.set(p, i * 3); Cc.set([c.r, c.g, c.b], i * 3); S[i] = s; A[i] = p ? a : 0;
    };
    // 진입등: 활주로 쪽으로 달리는 섬광 하나(초당 16칸, 22칸 주기)
    const step = Math.floor((t * 16) % 22);
    air.approach.forEach((p, i) => set(i, p, C.white, 13 - i === step ? 14 : 4, 13 - i === step ? 1 : 0.25));
    // 착륙 비행기(20초 주기) — 착륙등 + 양 날개 흰 불빛
    const lp = landingPlane(((t % 20) / 20));
    set(14, lp, C.white, 18, 0.95);
    const wing = (dx: number, dz: number): [number, number, number] | null => (lp ? [lp[0] + dx, lp[1] + 0.01, lp[2] + dz] : null);
    set(15, wing(0.14, -0.1), C.white, 4, 0.45);
    set(16, wing(-0.14, 0.1), C.white, 4, 0.45);
    if (flare.current) { flare.current.visible = !!lp; if (lp) flare.current.position.set(...lp); }
    // 유도로 비행기
    const tp = taxiPlane(t);
    set(17, tp, C.white, 8, 0.9); set(18, [tp[0] + 0.1, tp[1], tp[2]], C.white, 3, 0.5); set(19, [tp[0] - 0.1, tp[1], tp[2]], C.white, 3, 0.5);
    // 경고등: 1.6초마다 0.5초 켜짐 — 화면에서 유일한 빨강
    set(20, air.beacon, C.red, 7, (t % 1.6) < 0.5 ? 1 : 0.06);
    for (const k of ['position', 'color', 'size', 'alpha'] as const) movers.attributes[k].needsUpdate = true;
  });

  return (
    <group>
      <mesh geometry={ground.surface} material={surfaceMat} renderOrder={-2} />
      <mesh geometry={ground.marks} material={markMat} renderOrder={-1} />
      <points geometry={statics} material={staticMat} frustumCulled={false} />
      <points geometry={movers} material={moverMat} frustumCulled={false} />
      <sprite ref={flare} material={flareMat} scale={[0.22, 0.003, 1]} />
    </group>
  );
}
```

- [ ] **Step 2: 캔버스에 붙인다** — `TerrainScene.tsx`의 `<TerrainPoints …/>` **앞**에 `<AirportExtras target={target} instant={!!capture} portrait={portrait.current} />`(import 추가). 바닥이 점보다 먼저 그려져야 불빛이 위에 온다.

- [ ] **Step 3: 확인** — `npm run typecheck && npm test && npm run build && npm run size`.

**3D 청크가 256,000B를 넘으면 줄일 순서**(설계 §4.5 "곁가지부터"): ① 활주로 표시(`marks`) 삭제 → ② 착륙등 플레어 스프라이트 삭제 → ③ 별 삭제. 줄일 때마다 size를 다시 재고, 뺀 것을 커밋 메시지와 Task 9 기록에 적는다.

- [ ] **Step 4: 커밋** — `feat(3d): airport extras — ground, light pools, markings, stars, moving lights, beacon`

---

### Task 7: 하늘과 첫 화면 마감

**Files:**
- Modify: `src/styles/globals.css`

- [ ] **Step 1: 하늘** — `.backdrop canvas { display: block; }` 규칙을 바꾸고 하늘 층을 더한다

```css
/* 캔버스는 하늘(::before) 위, 비네트(::after) 아래 */
.backdrop canvas { display: block; position: relative; z-index: 1; }
/* 밤의 공항 하늘(설계 2026-09-28 §4.1): 거의 검은 남색, 지평선(화면 위에서 약 38%)에만 가는 빛 띠.
   지평선 높이는 카메라 기울기로만 정해져(화면 비율과 무관) 고정 비율로 맞춘다. 첫 화면에서만 보인다 */
.backdrop::before { content: ''; position: absolute; inset: 0; opacity: 0; transition: opacity 0.8s var(--ease);
  background: linear-gradient(180deg, #010206 0%, #02050c 26%, #060b18 34%, #0c1426 38%, #03050b 38.4%, #02040a 100%); }
html[data-active-scene="hero"] .backdrop::before { opacity: 1; }
```
`.backdrop::after`(비네트) 규칙에 `z-index: 2;`를 더한다.

3D가 꺼졌을 때 첫 화면 대체 이미지 뒤에도 같은 하늘을 깐다 — `.hero .scene-figure { … }` 규칙에 `background: linear-gradient(180deg, #010206 0%, #02050c 26%, #060b18 34%, #0c1426 38%, #03050b 38.4%, #02040a 100%);`를 더한다.

- [ ] **Step 2: 확인** — `npm run build && npx playwright test tests/e2e/terrain.spec.ts -g "대비"`(첫 화면 `.hero-keywords`·`.hero-sub` 대비). 실패하면 판을 되살리지 말고 공항 카메라 A의 목표점 x를 +0.3씩(불빛을 더 오른쪽으로) 옮긴다 — Task 5 단위 테스트가 A·B의 x·z가 같기를 요구하므로 B도 같이 옮긴다.

- [ ] **Step 3: 커밋** — `feat: night sky behind the airport hero`

---

### Task 8: 대체 이미지·캡처

**Files:**
- Modify: `public/fallback/hero.webp`(다시 캡처)
- Test: `tests/e2e/airport.spec.ts`

- [ ] **Step 1: e2e** — `tests/e2e/airport.spec.ts`에 더한다

```ts
test.describe('움직임 줄이기(3D 꺼짐)', () => {
  test.use({ reducedMotion: 'reduce' });
  test('첫 화면 대체 이미지와 이름이 보인다', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-3d', 'off');
    await expect(page.locator('.hero .scene-figure img')).toBeVisible();
    await expect(page.locator('.hero-name')).toBeVisible();
  });
});

test('캡처 모드(hero)는 공항 장면을 그린다', async ({ page }) => {
  await page.goto('/?capture=hero');
  await page.waitForFunction(() => (window as Window & { __sceneReady?: boolean }).__sceneReady === true, null, { timeout: 30_000 });
  // 캔버스 윗부분(하늘·지평선)보다 아래(활주로)에 밝은 화소가 더 많다 — 지형(가운데 덩어리)이 아닌 공항 구도
  const ratio = await page.locator('canvas').evaluate((c: HTMLCanvasElement) => {
    const g = document.createElement('canvas'); g.width = c.width; g.height = c.height;
    const x = g.getContext('2d')!; x.drawImage(c, 0, 0);
    const d = x.getImageData(0, 0, g.width, g.height).data;
    let top = 0, bottom = 0;
    for (let y = 0; y < g.height; y++) for (let i = 0; i < g.width; i++) {
      const k = (y * g.width + i) * 4; if (d[k] + d[k + 1] + d[k + 2] < 300) continue;
      if (y < g.height * 0.35) top++; else bottom++;
    }
    return bottom / Math.max(1, top);
  });
  expect(ratio).toBeGreaterThan(3);
});
```

- [ ] **Step 2: 확인** — `npm run build && npx playwright test tests/e2e/airport.spec.ts` → PASS

- [ ] **Step 3: 대체 이미지** — `npm run fallbacks` → `git diff --stat public/fallback`(hero.webp가 바뀐다). 이미지를 열어 공항 장면(불 다 켜짐, A 시점)인지 본다. **`npm run og`는 돌리지 않는다**(설계 §4.6).

- [ ] **Step 4: 커밋** — `test: airport hero e2e; regenerate hero fallback`

---

### Task 9: 시안과 맞추기, 전체 검사, 기록

- [ ] **Step 1: 시안과 나란히 비교** — 빌드를 띄우고(`npx serve out -l 4321`) Playwright로 1440×900에서 첫 화면을 6초 기다려 찍고, 같은 크기로 시안(`docs/superpowers/mockups/2026-09-28/01-night-airport.html`을 파일로 열어 조작판을 숨기고 6초 뒤) 찍어 나란히 본다. 스크롤 0.45·0.9·①(project) 위치도 찍는다. 390×844도 찍는다.
  - 맞출 것: 활주로가 화면 오른쪽 위로 비스듬히, 지평선 약 38%, 이름 쪽(왼쪽 아래)에 밝은 불빛이 없음, 불빛 크기가 시안처럼 작고 선명.
  - 다르면 **값만** 고친다: 카메라(`AIRPORT_CAM`), 불빛 크기 식의 5.5·18.0·60.0, 웅덩이 크기·알파. 고친 값과 이유를 커밋 메시지에 적는다. 끝나면 서버를 끈다.
- [ ] **Step 2: 전체 검사** — `npm run typecheck && npm test && npm run build && npm run size && npm run e2e`. `board.spec` "화면에 들어오면 넘어가고…"는 main에서도 가끔 실패하는 기존 문제(CLAUDE.md) — 다른 실패는 고친다. 값이 바뀌었으면 `npm run fallbacks` 다시.
- [ ] **Step 3: 설계 문서 "구현 결과 (계획 6-2)"** — `## 8. 범위 밖` 앞에: 좌표 변환·카메라 값, 내려앉기(스크롤 0.9vh, 여백 60vh), 불빛 수(데스크톱·휴대폰), 뺀 것(젖은 노면 반사, 그리고 용량 때문에 뺀 것이 있으면), 첫 화면 여백은 `.wrap` 유지, OG는 그대로, 검사 숫자(단위·e2e·초기 JS·3D 청크).
- [ ] **Step 4: CLAUDE.md** — 현재 상태 표에 `| 6-2 밤의 공항 | 공항 첫 화면(불빛 → 지형), NOW BOARDING 로딩 | 2026-09-28-plan-6-2-night-airport.md | ✅ (PR 대기) |`, "다음 세션" 0번을 6-2 PR 대기 + OG 비교(사용자 결정) + 다음 5-3로, "확정된 결정 → 페이지 구성"의 로딩·첫 화면 줄을 새 내용으로(계획 6-2 반영).
- [ ] **Step 5: 커밋** — `docs: record plan 6-2`
- [ ] **Step 6: 푸시·PR** — 사용자 확인 뒤 `git push -u origin plan-6-2-airport` → `gh pr create --base main` (본문 끝 `🤖 Generated with [Claude Code](https://claude.com/claude-code)`), CI 확인, 미리보기 주소 전달.
