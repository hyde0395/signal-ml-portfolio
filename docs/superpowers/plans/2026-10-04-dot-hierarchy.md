# 점 위계와 별자리 선 — 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 차트의 핵심 점은 크고 밝은 "별" + 가는 별자리 선으로, 근거 점은 작고 옅게 바꿔 ④ U자·⑤ 예측 구간·④ 출발일·③ 모델 구조·② 걸러내기·⑤ 검증 설계가 한눈에 읽히게 한다.

**Architecture:** 배치 함수(`src/charts/*.ts`)는 지금처럼 점 배열(`ChartLayout`)을 만들고, 새로 `lines`(정규화 좌표의 꺾은선)·`overlay(sel)`(짚은 항목에 따라 바뀌는 원·글자)를 함께 돌려준다. 그림 판(`ChartStage`)은 캔버스와 이름표 층 사이에 SVG 층(`ChartLines`)을 두고 3D 켜짐·꺼짐 모두 같은 SVG로 그린다. 3D에서는 점이 날아와 자리 잡는 시간(약 1.2초) 뒤에 선이 페이드인한다.

**Tech Stack:** Next.js(App Router, 정적 export) + React 19, TypeScript, Vitest(단위), Playwright(e2e, axe), React Three Fiber(3D — 이번 계획에서 셰이더는 안 바꿈)

**Spec:** `docs/superpowers/specs/2026-10-04-dot-hierarchy-design.md` · 시안 `docs/superpowers/mockups/2026-10-04/interval-constellation.html`(⑤), `docs/superpowers/mockups/2026-10-04/ucurve-constellation.html`(④ U자)

## Global Constraints

- 코드 주석은 한국어. 파일 맨 위에 무엇을 하는 파일인지 한두 줄, 이유가 드러나지 않는 로직에는 "왜". 코드를 그대로 옮겨 적는 주석은 달지 않는다
- 문구는 `content/{ko,en,ja}.json`에만, **문구에 숫자 직접 기입 금지**(테스트가 강제 — 숫자는 `{v.…}` 자리표시로 코드가 채운다), 세 파일 키 일치. 새 문구는 임시값(문구는 디자인을 다 정한 뒤 한꺼번에 다듬는다)
- 색: 배경 `#02040A`, 점 `#8FB8FF`(TONE.dot), 글 `#EEF3FF`(TONE.text), 호박 `#FFB547`(TONE.amber). 이징 `cubic-bezier(.16,1,.3,1)` 하나, bounce 금지
- 호박색은 뜻이 있을 때만(공휴일 무렵·가장 싼 값·걸린 행·평가 점)
- 별자리 선: 1~1.2px, `#EEF3FF` 알파 0.45~0.6. 굵은 실선·면 덧그림 금지. 결론 점끼리만 잇는다
- 초기 JS gzip ≤150KB(`npm run size`), 무거운 라이브러리(three·zod·gsap·lenis)는 `import()`로만(`tests/unit/client-imports.test.ts`)
- 커밋은 `git add <경로>`로만(`git add -A` 금지). 커밋 메시지 끝에 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
- 무거운 e2e는 동시에 한두 개까지(`uptime`으로 부하 확인, 포트는 `E2E_PORT`). e2e는 `tests/e2e/*.spec.ts` 전부 돌린다. 3D 켜짐 검사는 `expect3D()`로 기다린다
- 데스크톱 우선(화질·배치는 데스크톱 기준, 휴대폰은 가볍게)

## Review Focus

1. **3D에서 점이 아직 날아오는 동안 선이 먼저 보이는 것** — 판에 들어온 직후에는 선이 없어야 하고, 약 1.2초 뒤 나타나야 한다. 단계 차트(③ 모델 구조)에서 단계가 바뀌면 옛 선은 바로 사라졌다가 다시 나타나야 한다(Task 1 단위 테스트 `linesDelay`, Task 7 e2e)
2. **창 크기 변경·휴대폰 회전 뒤 선이 점과 어긋나는 것** — SVG는 판 크기(px)로 그리므로 판 크기가 바뀌면 다시 그려야 한다(Task 1 `ChartLines`가 `plotSize` 상태로 그림, Task 7 e2e "창 크기 변경" 검사에 선 끝점 확인 추가)
3. **⑤ 오른쪽 점 20개 칸이 좁은 판에서 겹치거나 판 밖으로 나가는 것** — 640px 미만은 칸을 숨긴다(Task 3 단위 테스트, Task 7 e2e 390px)
4. **⑤ 예측 없는 날(null)이 끼어 있을 때** 별자리 선이 그 날을 건너뛰어도 끊김 없이 이어지고, 칸이 예측 없는 날을 고르지 않는 것(Task 3 단위 테스트 — 기존 고정 데이터에 null이 있다)
5. **3D가 도중에 꺼질 때**(저프레임) 선·칸이 2D 그림과 함께 그대로 보이는 것(Task 7 e2e — 기존 "3D가 도중에 꺼지면" 검사에 선 확인 추가)

---

## 파일 구조

| 파일 | 책임 |
|---|---|
| `src/charts/types.ts` (수정) | `ChartLine`·`OverlayShape` 타입, `ChartLayout.lines`·`overlay`, 이름표 종류 `callout` |
| `src/charts/lines.ts` (새) | 순수 도우미: 별(빛 번짐 + 심) 추가, 꺾은선 SVG 경로, 선이 나타날 지연 시간, 상수 `LINE`·`STAR` |
| `src/components/charts/ChartLines.tsx` (새) | SVG 층: `lines`·`overlay` 모양을 판 크기(px)로 그림 |
| `src/components/charts/ChartStage.tsx` (수정) | 판 크기 상태, 선 켜짐 타이밍, `ChartLines` 끼우기, `callout` 이름표 그리기 |
| `src/styles/globals.css` (수정) | `.chart-lines` 페이드, `.chart-callout`, `.chart-panel-*` 글자 |
| `src/charts/layouts.ts` (수정) | `swarmLayout`(④ U자), `cloudLayout`·`cloudScale`(⑤), `departLayout`(④ 출발일) |
| `src/charts/model.ts`, `filter.ts`, `split.ts` (수정) | ③ 모델 구조 선, ② 걸러내기·⑤ 검증 설계 알파 |
| `src/charts/build.ts` (수정) | 새 문구(`ChartStrings`)를 배치 함수에 넘김 |
| `src/components/sections/Charts.tsx` (수정) | 새 문구 키를 `strings`로 |
| `content/{ko,en,ja}.json` (수정) | `charts.curve.zero/callMin/callLast`, `charts.band.panelHead/panelNote` |
| `tests/unit/charts-lines.test.ts` (새), `charts-layouts.test.ts`·`charts-model.test.ts`·`charts-filter.test.ts`·`charts-split.test.ts` (수정) | 단위 |
| `tests/e2e/charts.spec.ts` (수정) | 선·칸·눈금 수 |

---

### Task 1: 선·덧그림 층 기반(타입, 도우미, SVG 층, 그림 판 연결)

**Files:**
- Modify: `src/charts/types.ts`
- Create: `src/charts/lines.ts`
- Create: `src/components/charts/ChartLines.tsx`
- Modify: `src/components/charts/ChartStage.tsx`
- Modify: `src/styles/globals.css`
- Test: `tests/unit/charts-lines.test.ts`

**Interfaces:**
- Produces:
  - `type ChartLine = { pts: number[]; tone: number; alpha: number; width: number }` — `pts`는 정규화 좌표를 펼친 배열 `[x0, y0, x1, y1, …]`
  - `type OverlayShape = { type: 'dot'; x: number; y: number; r: number; tone: number; alpha: number; hollow?: boolean } | { type: 'text'; x: number; y: number; text: string; align: 'start' | 'center' | 'end'; cls: 'panelHead' | 'panelNote' | 'panelValue' | 'panelQ' } | { type: 'dash'; x0: number; x1: number; y: number; tone: number; alpha: number }` — x·y 정규화, r은 px 반지름
  - `ChartLayout.lines?: ChartLine[]`, `ChartLayout.overlay?: (sel: number) => OverlayShape[]`
  - `ChartLabel`에 `{ type: 'callout'; x: number; y: number; value: string; note: string; tone: 'amber' | 'text'; place: 'above' | 'below' }`
  - `lines.ts`: `LINE = { width: 1.2, alpha: 0.6, delay3dMs: 1200 }`, `STAR = { haloScale: 2.5, haloAlpha: 0.14 }`, `addStar(p: Adder, x: number, y: number, d: number, tone: number, alpha?: number, group?: number, hl?: number): void`, `linePath(pts: number[], w: number, h: number): string`, `linesDelay(is3d: boolean, reduced: boolean): number`, `type Adder = { add(x: number, y: number, size: number, alpha: number, tone: number, group?: number, hl?: number): void }`

- [ ] **Step 1: 실패하는 테스트 쓰기** — `tests/unit/charts-lines.test.ts`

```ts
// 선·별 도우미 검사: 별은 빛 번짐 + 심 두 점, 꺾은선 경로, 3D에서만 선이 늦게 나타난다
import { describe, expect, it } from 'vitest';
import { addStar, LINE, linePath, linesDelay, STAR } from '@/charts/lines';
import { Pts } from '@/charts/layouts';
import { TONE } from '@/charts/types';

describe('addStar', () => {
  it('같은 자리에 빛 번짐(크고 옅게)을 먼저, 심을 나중에 — 심이 위에 그려진다', () => {
    const p = new Pts();
    addStar(p, 0.5, 0.25, 4, TONE.text, 1, 7, 3);
    const L = p.done([], TONE.text, 1);
    expect(L.n).toBe(2);
    expect([L.x[0], L.y[0], L.x[1], L.y[1]]).toEqual([0.5, 0.25, 0.5, 0.25]);
    expect(L.size[0]).toBeCloseTo(4 * STAR.haloScale);
    expect(L.alpha[0]).toBeCloseTo(STAR.haloAlpha);
    expect(L.size[1]).toBe(4);
    expect(L.alpha[1]).toBe(1);
    expect([L.group[0], L.hl[0], L.group[1], L.hl[1]]).toEqual([7, 3, 7, 3]);
  });
});

describe('linePath', () => {
  it('정규화 좌표를 판 px로 바꿔 M·L 경로를 만든다(소수 한 자리)', () => {
    expect(linePath([0, 0, 0.5, 1, 1, 0.25], 200, 100)).toBe('M0 0L100 100L200 25');
  });
  it('점이 둘보다 적으면 빈 경로', () => {
    expect(linePath([0.2, 0.3], 200, 100)).toBe('');
    expect(linePath([], 200, 100)).toBe('');
  });
});

describe('linesDelay', () => {
  it('3D가 켜져 있으면 점이 자리 잡을 시간만큼 기다리고, 2D·움직임 줄이기는 바로', () => {
    expect(linesDelay(true, false)).toBe(LINE.delay3dMs);
    expect(linesDelay(false, false)).toBe(0);
    expect(linesDelay(true, true)).toBe(0);
  });
});
```

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run tests/unit/charts-lines.test.ts` / Expected: FAIL `Cannot find module '@/charts/lines'`

- [ ] **Step 3: 타입 추가** — `src/charts/types.ts`의 `ChartLabel` 끝(`| { type: 'detail'; … }` 다음)에 추가하고, `ChartLayout`에 두 필드를 더한다

```ts
  // 결론 이름표(설계 2026-10-04 §2): 큰 숫자 + 아래 작은 설명. place = 점 위/아래, tone = 숫자 색
  | { type: 'callout'; x: number; y: number; value: string; note: string; tone: 'amber' | 'text'; place: 'above' | 'below' };

// 별자리 선(설계 2026-10-04 §3): 결론 점끼리 잇는 가는 꺾은선. pts = 정규화 좌표를 펼친 배열 [x0, y0, x1, y1, …]
export type ChartLine = { pts: number[]; tone: number; alpha: number; width: number };
// 짚은 항목에 따라 바뀌는 SVG 덧그림(⑤ 분위수 점 그림 칸). x·y 정규화, r = px 반지름, hollow = 속 빈 점
export type OverlayShape =
  | { type: 'dot'; x: number; y: number; r: number; tone: number; alpha: number; hollow?: boolean }
  | { type: 'text'; x: number; y: number; text: string; align: 'start' | 'center' | 'end'; cls: 'panelHead' | 'panelNote' | 'panelValue' | 'panelQ' }
  | { type: 'dash'; x0: number; x1: number; y: number; tone: number; alpha: number };
```

`ChartLayout`의 `summary?` 다음 줄에:

```ts
  // 별자리 선(SVG 층). 점이 아니라 3D 셰이더는 모른다 — 3D 켜짐·꺼짐 모두 같은 SVG로 그린다(ChartLines)
  lines?: ChartLine[];
  // 짚은 항목 번호(−1 포함)를 받아 덧그림 모양을 돌려준다. 없으면 덧그림 없음
  overlay?: (sel: number) => OverlayShape[];
```

- [ ] **Step 4: 도우미 만들기** — `src/charts/lines.ts`

```ts
// 별자리 선·별 도우미(설계 2026-10-04 §2·§3). 배치 함수가 결론 점을 "별"(빛 번짐 + 심)로 더하고, 별끼리 잇는 선을
// SVG 경로로 바꾸며, 3D에서 선이 나타날 때까지 기다릴 시간을 정한다. 의존성이 없어 그림 판(초기 JS)에서 불러도 가볍다.

// 3D 점은 TerrainPoints의 damp(λ = 2.2)로 따라가 약 1.36초에 95%에 닿는다 — 그보다 조금 앞에서 선을 띄우기 시작해
// 페이드(0.6초)가 끝날 때 점과 함께 자리 잡게 한다
export const LINE = { width: 1.2, alpha: 0.6, delay3dMs: 1200 } as const;
// 빛 번짐: 같은 자리에 지름 2.5배·알파 0.14 점 하나(시안 v6). 셰이더·2D 캔버스 모두 둥근 점이라 그대로 번짐처럼 보인다
export const STAR = { haloScale: 2.5, haloAlpha: 0.14 } as const;

// layouts.ts의 Pts와 같은 모양 — Pts를 import하면 layouts ↔ lines가 서로 부르게 되어 모양만 받는다
export type Adder = { add(x: number, y: number, size: number, alpha: number, tone: number, group?: number, hl?: number): void };

// 빛 번짐을 먼저 넣어야 심이 그 위에 그려진다(2D는 순서대로 칠하고, 3D도 같은 깊이에서 뒤 번호가 위)
export function addStar(p: Adder, x: number, y: number, d: number, tone: number, alpha = 1, group = -1, hl = -1): void {
  p.add(x, y, d * STAR.haloScale, STAR.haloAlpha, tone, group, hl);
  p.add(x, y, d, alpha, tone, group, hl);
}

const r1 = (v: number) => Math.round(v * 10) / 10;

export function linePath(pts: number[], w: number, h: number): string {
  if (pts.length < 4) return '';
  let d = '';
  for (let i = 0; i + 1 < pts.length; i += 2) d += `${i ? 'L' : 'M'}${r1(pts[i] * w)} ${r1(pts[i + 1] * h)}`;
  return d;
}

export function linesDelay(is3d: boolean, reduced: boolean): number {
  return is3d && !reduced ? LINE.delay3dMs : 0;
}
```

- [ ] **Step 5: 테스트 통과 확인** — Run: `npx vitest run tests/unit/charts-lines.test.ts` / Expected: PASS(4개)

- [ ] **Step 6: SVG 층 컴포넌트** — `src/components/charts/ChartLines.tsx`

```tsx
'use client';
// 그림 판 위 SVG 층(설계 2026-10-04 §3): 별자리 선과 ⑤ 분위수 점 그림 칸을 판 크기(px)로 그린다. 3D 켜짐·꺼짐 모두
// 같은 층이라 점(3D 캔버스 또는 2D 캔버스)과 같은 정규화 좌표로 겹친다. 낭독은 자막·조작 층이 맡아 aria-hidden.
import { TONE_COLOR } from '@/charts/draw2d';
import { linePath } from '@/charts/lines';
import type { ChartLine, OverlayShape } from '@/charts/types';

type Props = { lines?: ChartLine[]; overlay?: OverlayShape[]; w: number; h: number; on: boolean };

const color = (tone: number) => TONE_COLOR[tone] ?? TONE_COLOR[1];
const anchor = { start: 'start', center: 'middle', end: 'end' } as const;

export function ChartLines({ lines, overlay, w, h, on }: Props) {
  if (!w || !h || (!lines?.length && !overlay?.length)) return null;
  return (
    <svg className="chart-lines" data-on={on ? '' : undefined} width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      {lines?.map((l, i) => (
        <path key={i} d={linePath(l.pts, w, h)} fill="none" stroke={color(l.tone)} strokeOpacity={l.alpha}
          strokeWidth={l.width} strokeLinejoin="round" strokeLinecap="round" />
      ))}
      {overlay?.map((s, i) => {
        if (s.type === 'dot') {
          return s.hollow
            ? <circle key={i} cx={s.x * w} cy={s.y * h} r={s.r} fill="none" stroke={color(s.tone)} strokeOpacity={s.alpha} strokeWidth={1.2} />
            : <circle key={i} cx={s.x * w} cy={s.y * h} r={s.r} fill={color(s.tone)} fillOpacity={s.alpha} />;
        }
        if (s.type === 'dash') {
          return <line key={i} x1={s.x0 * w} x2={s.x1 * w} y1={s.y * h} y2={s.y * h} stroke={color(s.tone)} strokeOpacity={s.alpha}
            strokeWidth={1.6} strokeLinecap="round" strokeDasharray="0 5" />;
        }
        return <text key={i} x={s.x * w} y={s.y * h} textAnchor={anchor[s.align]} dominantBaseline="middle" className={`chart-${s.cls}`}>{s.text}</text>;
      })}
    </svg>
  );
}
```

(`strokeDasharray="0 5"` + 둥근 끝 = 5px마다 점 하나인 점선 — 점 컨셉을 지킨다.)

- [ ] **Step 7: 그림 판 연결** — `src/components/charts/ChartStage.tsx`
  1. import 추가: `import { ChartLines } from './ChartLines';`, `import { linesDelay } from '@/charts/lines';`, `useMemo`를 react import에 더한다
  2. 상태 추가(`const [fontTick…` 아래): 
  ```ts
  // SVG 층(ChartLines)이 판 px로 그리므로 배치 때 판 크기를 같이 둔다. linesOn: 점이 자리 잡은 뒤 선을 보인다(설계 §3)
  const [plotSize, setPlotSize] = useState({ w: 0, h: 0 });
  const [linesOn, setLinesOn] = useState(false);
  ```
  3. `redraw` 안 `setLay(layout);` 바로 앞에 `setPlotSize((p) => (p.w === r.width && p.h === r.height ? p : { w: r.width, h: r.height }));`
  4. 선 타이밍 effect(단계 effect들 다음):
  ```ts
  // 선은 판이 화면 절반 이상 들어온 뒤, 3D면 점이 날아와 자리 잡을 시간(linesDelay) 뒤에 페이드인. 판을 벗어나거나 배치 종류
  // (단계)가 바뀌면 바로 숨긴다 — 점이 옮겨 가는 동안 옛 선이 엉뚱한 자리에 떠 있지 않게
  const hasLines = !!(lay?.lines?.length || lay?.overlay);
  useEffect(() => {
    const st = stage.current;
    setLinesOn(false);
    if (!st || !hasLines) return;
    let reduced = true;
    try { reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { /* 없으면 줄인 쪽 */ }
    let timer = 0;
    const io = new IntersectionObserver(([e]) => {
      clearTimeout(timer);
      if (!e.isIntersecting) { setLinesOn(false); return; }
      const is3d = document.documentElement.getAttribute('data-3d') !== 'off';
      timer = window.setTimeout(() => setLinesOn(true), linesDelay(is3d, reduced));
    }, { threshold: 0.5 });
    io.observe(st);
    return () => { io.disconnect(); clearTimeout(timer); };
  }, [hasLines, lay?.variant]);
  const overlayShapes = useMemo(() => lay?.overlay?.(sel) ?? [], [lay, sel]);
  ```
  5. JSX: `<canvas … />` 바로 다음 줄에 `<ChartLines lines={lay?.lines} overlay={overlayShapes} w={plotSize.w} h={plotSize.h} on={linesOn} />`
  6. 이름표 map 안, `if (l.type === 'detail') {…}` 다음에 callout 분기:
  ```tsx
  if (l.type === 'callout') {
    return (
      <span key={i} className={`chart-callout is-${l.tone} is-${l.place}`} style={style}>
        <b>{l.value}</b><small>{l.note}</small>
      </span>
    );
  }
  ```

- [ ] **Step 8: CSS** — `src/styles/globals.css`의 `.chart-labels { … }` 줄 다음에:

```css
/* 별자리 선·⑤ 분위수 점 그림 칸(설계 2026-10-04 §3): 점이 자리 잡은 뒤 페이드인, 숨길 때는 빠르게 */
.chart-lines { position: absolute; inset: 0; pointer-events: none; overflow: visible; opacity: 0; transition: opacity 0.2s linear; }
.chart-lines[data-on] { opacity: 1; transition: opacity 0.6s cubic-bezier(.16, 1, .3, 1); }
.chart-panelHead { font: 600 13px var(--font-sans); fill: var(--tx); }
.chart-panelNote { font: 400 12px var(--font-sans); fill: var(--mute); }
.chart-panelValue { font: 600 12px var(--font-mono); fill: var(--tx); }
.chart-panelQ { font: 400 11px var(--font-mono); fill: var(--dot); }
/* 결론 이름표: 큰 숫자 + 작은 설명. above = 점 위에 아래쪽 끝을, below = 점 아래에 위쪽 끝을 맞춘다 */
.chart-callout { position: absolute; display: flex; flex-direction: column; align-items: center; gap: 2px; white-space: nowrap; pointer-events: none; }
.chart-callout.is-above { transform: translate(-50%, calc(-100% - 14px)); flex-direction: column-reverse; }
.chart-callout.is-below { transform: translate(-50%, 14px); }
.chart-callout b { font: 700 20px/1 var(--font-display); letter-spacing: -0.02em; color: var(--tx); }
.chart-callout.is-amber b { color: var(--amb); }
.chart-callout small { font: 400 12px var(--font-sans); color: rgba(238, 243, 255, 0.75); }
@media (prefers-reduced-motion: reduce) { .chart-lines, .chart-lines[data-on] { transition: none; } }
```

글꼴 변수 이름(`--font-sans`·`--font-display`·`--font-mono`)과 색 변수(`--tx`·`--mute`·`--amb`·`--dot`)는 `globals.css` 맨 위 `:root`에서 실제 이름을 확인해 맞춘다(`grep -n "^\s*--" src/styles/globals.css | head -30`). `--dot`이 없으면 `#8FB8FF` 대신 그 줄에서 쓰는 점 색 변수를 쓴다.

- [ ] **Step 9: 확인** — Run: `npx tsc --noEmit && npx vitest run tests/unit/charts-lines.test.ts tests/unit/client-imports.test.ts` / Expected: 타입 오류 없음, PASS

- [ ] **Step 10: Commit**

```bash
git add src/charts/types.ts src/charts/lines.ts src/components/charts/ChartLines.tsx src/components/charts/ChartStage.tsx src/styles/globals.css tests/unit/charts-lines.test.ts
git commit -m "feat(charts): SVG line/overlay layer and star helpers for dot hierarchy

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: ④ U자 곡선 — 옅은 표본 + 별 8개 + 별자리 선 + 결론 이름표

**Files:**
- Modify: `src/charts/layouts.ts` (`SWARM`, `swarmLayout`)
- Modify: `src/charts/build.ts` (`ChartStrings`, `chartCurve` 분기)
- Modify: `src/components/sections/Charts.tsx` (strings)
- Modify: `content/ko.json`, `content/en.json`, `content/ja.json` (`charts.curve`)
- Test: `tests/unit/charts-layouts.test.ts` (`describe('swarmLayout')`)

**Interfaces:**
- Consumes: Task 1 `addStar`, `LINE`, `ChartLine`, `callout` 이름표
- Produces: `swarmLayout(c, size, s)`의 `s`에 `zero: string; callMin(lo: number, hi: number): string; callLast: string; pct1(v: number): string` 추가. `SWARM` 상수 새 모양(아래)

- [ ] **Step 1: 테스트 고치기(실패하게)** — `tests/unit/charts-layouts.test.ts`의 `describe('swarmLayout', …)` 위쪽 정의와 아래 세 테스트를 바꾼다. 문자열 함수에 새 항목을 더하고, 표본·별을 크기로 구분하던 부분을 새 상수로:

```ts
  const L = swarmLayout(curve, { w: W, h: H }, {
    bin: (lo, hi) => `D-${lo}~${hi}`, pct: (v) => `${v}%`, axis: 'A', tip,
    zero: 'Z', callMin: (lo, hi) => `min ${lo}~${hi}`, callLast: 'last', pct1: (v) => `${v.toFixed(1)}%`,
  });
  const isSample = (i: number) => L.size[i] === SWARM.dot;
  const stars = () => Array.from({ length: L.n }, (_, i) => i).filter((i) => L.size[i] === SWARM.star || L.size[i] === SWARM.starKey);
```

(import에 `SWARM` 추가.) 기존 `'범위 밖 표본은 빼고 320개, 평균선 점과 구간 마디 8개'`는:

```ts
  it('범위 밖 표본은 빼고 320개, 구간 평균 별 8개, 별자리 선 하나(꼭짓점 8개, 왼쪽→오른쪽)', () => {
    expect(Array.from({ length: L.n }, (_, i) => i).filter(isSample)).toHaveLength(320);
    expect(stars()).toHaveLength(8);
    expect(L.lines).toHaveLength(1);
    const pts = L.lines![0].pts;
    expect(pts).toHaveLength(16);
    for (let k = 2; k < pts.length; k += 2) expect(pts[k]).toBeGreaterThan(pts[k - 2]);
  });
```

`'가장 싼 세 구간(D-22~60)만 호박색'`과 `'호박색 구간은 평균이 가장 낮은 세 구간에서 정한다(고정 번호가 아니다)'`는 지우고 대신:

```ts
  it('표본은 모두 파랑(꾸밈 호박색 없음), 가장 싼 구간의 별만 호박색', () => {
    for (let i = 0; i < L.n; i++) if (isSample(i)) expect(L.tone[i]).toBe(TONE.dot);
    const amberStars = stars().filter((i) => L.tone[i] === TONE.amber);
    expect(amberStars).toHaveLength(1);
    expect(L.size[amberStars[0]]).toBe(SWARM.starKey);
    // 가장 싼 구간 = 평균 −50(구간 번호 5)의 마디 높이
    const ys = stars().map((i) => L.y[i]);
    expect(L.y[amberStars[0]]).toBe(Math.max(...ys));
  });
  it('결론 이름표 둘: 최저(호박, 아래)와 출발 직전(글자색, 위), 값은 소수 한 자리', () => {
    const c = L.labels.filter((l) => l.type === 'callout');
    expect(c).toEqual([
      expect.objectContaining({ value: '-5.0%', note: 'min 31~45', tone: 'amber', place: 'below' }),
      expect.objectContaining({ value: '11.1%', note: 'last', tone: 'text', place: 'above' }),
    ]);
  });
  it('0% 기준 점선과 "같은 편 평균" 이름표', () => {
    expect(L.labels).toContainEqual(expect.objectContaining({ type: 'text', text: 'Z', cls: 'axis', align: 'end' }));
  });
```

`'이름표: 구간 8개 + y 눈금 3개(tick), 축 이름 1개'`는 눈금이 5개(+20·+10·0·−10·−20)로 바뀌므로 `13`개(구간 8 + 눈금 5)로, `'강조 번호: 구간 표본 점은 그 구간의 항목 번호, 평균선·마디는 −1'`은 "별·0% 점선은 −1"로 이름만 바꾼다(검사 내용은 `isSample`이 아닌 점은 −1 — 그대로 통과해야 함). 기존 `'같은 구간의 표본 점끼리 겹치지 않는다'`, `'구간 폭을 넘치는 점은…'`은 `SWARM.dot`·`SWARM.gap` 상수를 쓰므로 그대로 둔다(숫자를 박아 둔 곳이 있으면 상수로 바꾼다).

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run tests/unit/charts-layouts.test.ts -t swarmLayout` / Expected: FAIL(`SWARM.star` undefined, 호박색 표본 등)

- [ ] **Step 3: 구현** — `src/charts/layouts.ts`
  1. import에 `import { addStar, LINE } from './lines';`
  2. `SWARM` 주석·상수 교체:
  ```ts
  // ④ 차트 2 구간별 분포 벌떼(설계 2026-10-04 §4, 시안 ucurve-constellation): 출발이 지난 편의 관측 하나 = 점 하나(배경 층 —
  // 작고 옅게, 모두 파랑). 구간 8개를 왼쪽(D-61~90)에서 오른쪽(D-1~3)으로 놓고, 같은 높이의 점은 좌우로 번갈아 비켜 쌓는다.
  // 구간 평균 8개는 별(빛 번짐 + 심)과 가는 별자리 선(결론 층). 가장 싼 구간의 별만 호박색·조금 크게, 그 아래 최저 이름표,
  // 가장 가까운 구간(D-1~3) 위에 출발 직전 이름표. ±22% 밖은 그리지 않는다(몇 개가 축을 늘려 모양을 뭉개지 않게).
  // sampleA: 표본 알파 — 차트 2는 늘 한 구간이 짚혀 있어(처음 = 가장 싼 구간) 나머지는 × CHART_FOCUS_DIM(0.45) ≈ 0.2가 되고,
  // 짚은 구간만 0.45로 밝다(설계 §2 "짚은 항목만 약 0.45")
  // narrowColPx: 구간 칸이 이보다 좁으면(휴대폰) 이름표에서 "D-"를 뺀다 — 9px 글자로 "D-61~90"이 칸 폭을 다 채워 옆 이름표와 겹친다
  export const SWARM = { dot: 2.4, gap: 0.5, sampleA: 0.45, star: 6.8, starKey: 9.2, clip: 22, narrowColPx: 56, marginLeft: 0.08, marginTop: 0.12, marginBottom: 0.12 } as const;
  ```
  (`star`·`starKey`는 지름 px — 시안의 심 반지름 3.4·4.6. `marginTop` 0.08 → 0.12: 위쪽 이름표 "+11.1% / 출발 직전" 자리)
  3. `swarmLayout` 시그니처의 `s` 타입에 `zero: string; callMin(lo: number, hi: number): string; callLast: string; pct1(v: number): string;` 추가
  4. 표본 루프: `cheapBins`·`cheap` 계산을 지우고 `p.add((cx(b) + off) / size.w, (row * step) / size.h, SWARM.dot, SWARM.sampleA, TONE.dot, -1, keyOf(b));`
  5. 표본 루프 **앞**(표본보다 먼저 그려 뒤에 깔리게)에 0% 기준 점선:
  ```ts
  // 0% 기준(같은 편 평균): 성긴 점선 — 기준 층(설계 §2)
  for (let x = left; x <= size.w - 4; x += 7) p.add(x / size.w, y(0) / size.h, 1.6, 0.35, TONE.text);
  ```
  6. 옛 평균선(`nodes` … `linePts` 이중 루프와 `size 6` 마디)을 지우고:
  ```ts
  const nodes = c.mean
    .map((m, b) => ({ b, x: cx(b), y: y(Math.max(-SWARM.clip, Math.min(SWARM.clip, m / 10))), v: m / 10 }))
    .sort((a, z) => a.x - z.x);
  const cheapest = c.mean.reduce((best, m, b) => (m < c.mean[best] ? b : best), 0);
  for (const n of nodes) {
    const key = n.b === cheapest;
    addStar(p, n.x / size.w, n.y / size.h, key ? SWARM.starKey : SWARM.star, key ? TONE.amber : TONE.text);
  }
  const lines = [{ pts: nodes.flatMap((n) => [n.x / size.w, n.y / size.h]), tone: TONE.text, alpha: LINE.alpha, width: LINE.width }];
  ```
  (아래 `const cheapest = …`(처음 강조) 줄은 이미 위에서 만들었으니 지운다.)
  7. 이름표: y 눈금을 `[20, 10, 0, -10, -20]`로, 그리고 마지막 `labels.push(…axis…)` 다음에:
  ```ts
  labels.push({ type: 'text', x: (size.w - 4) / size.w, y: (y(0) - 8) / size.h, text: s.zero, align: 'end', cls: 'axis' });
  const minN = nodes.find((n) => n.b === cheapest)!, lastN = nodes.find((n) => n.b === 0)!;
  const [mlo, mhi] = c.bins[cheapest];
  labels.push({ type: 'callout', x: minN.x / size.w, y: minN.y / size.h, value: s.pct1(minN.v), note: s.callMin(mlo, mhi), tone: 'amber', place: 'below' });
  labels.push({ type: 'callout', x: lastN.x / size.w, y: lastN.y / size.h, value: s.pct1(lastN.v), note: s.callLast, tone: 'text', place: 'above' });
  ```
  8. return을 `return { ...p.done(labels, TONE.text, CHART_FOCUS_DIM), items, initial: keyOf(cheapest), lines };`

- [ ] **Step 4: 문구·전달** —
  - `content/ko.json` `charts.curve`에 `"zero": "같은 편 평균"`, `"callMin": "최저 · 출발 {v.lo}~{v.hi}일 전"`, `"callLast": "출발 직전"`
  - `content/en.json`: `"zero": "Same-flight average"`, `"callMin": "Lowest · {v.lo}–{v.hi} days out"`, `"callLast": "Right before departure"`
  - `content/ja.json`: `"zero": "同じ便の平均"`, `"callMin": "最安 · 出発{v.lo}〜{v.hi}日前"`, `"callLast": "出発直前"`
  - `src/charts/build.ts` `ChartStrings`에 `zero?: string; callMin?: string; callLast?: string;`(주석: "④ U자 결론 이름표(설계 2026-10-04). callMin은 {v.lo}·{v.hi}가 남은 채 넘어온다"), `chartCurve` 분기:
  ```ts
    case 'chartCurve':
      return swarmLayout(loaded.charts!.curve, size, {
        bin: (lo, hi) => `D-${lo}~${hi}`, pct: signed, axis: s.axis ?? '',
        tip: (v) => tip({ bin: v.bin, pct: signedInt(v.pct), n: v.n }),
        // 결론 이름표 값은 소수 한 자리, 부호는 기존 signed와 같은 −(U+2212)
        zero: s.zero ?? '', callLast: s.callLast ?? '', pct1: (v) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(1)}%`,
        callMin: (lo, hi) => (s.callMin ? interpolate(s.callMin, { v: { lo, hi } }, s.locale) : ''),
      });
  ```
  (Step 1 테스트는 테스트 쪽 `pct1`(`toFixed(1)`)을 쓰므로 기대값 `'-5.0%'`·`'11.1%'`가 그대로 맞다)
  - `src/components/sections/Charts.tsx` `strings`에 `...(b.id === 'curve' ? { zero: t('charts.curve.zero'), callLast: t('charts.curve.callLast'), callMin: tipOf('curve', 'callMin') } : {})`

- [ ] **Step 5: 통과 확인** — Run: `npx tsc --noEmit && npx vitest run tests/unit/charts-layouts.test.ts tests/unit/content.test.ts tests/unit/charts-content.test.ts` / Expected: PASS(문구 숫자 금지·세 언어 키 일치 포함)

- [ ] **Step 6: Commit**

```bash
git add src/charts/layouts.ts src/charts/build.ts src/components/sections/Charts.tsx content/ko.json content/en.json content/ja.json tests/unit/charts-layouts.test.ts
git commit -m "feat(charts): U-curve as faint samples + constellation of bin means with callouts

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: ⑤ 예측 구간 — 두 층 구름 + 예측가 별자리 + 분위수 점 그림 칸

**Files:**
- Modify: `src/charts/layouts.ts` (`CLOUD`, `cloudScale`, `cloudLayout`, 새 `cloudPanel`)
- Modify: `src/charts/build.ts`, `src/components/sections/Charts.tsx`
- Modify: `content/{ko,en,ja}.json` (`charts.band`)
- Test: `tests/unit/charts-layouts.test.ts` (`describe('cloudLayout')`)

**Interfaces:**
- Consumes: Task 1 `addStar`, `LINE`, `OverlayShape`, `ChartLayout.overlay`
- Produces: `cloudScale(cd, size, rightPx = 0)`; `cloudLayout(cd, size, s)`의 `s`에 `panelHead(v: { date: string; dday: number }): string; panelNote(v: { step: number; total: number; inside: number }): string; moneyFull(v: number): string` 추가; `CLOUD` 새 상수; `export const QDOT = { n: 20, r: 5, gap: 2.4, rows: 6 }`

- [ ] **Step 1: 테스트 고치기(실패하게)** — `describe('cloudLayout')`의 `s`에 `panelHead: (v) => \`H ${v.date} ${v.dday}\``, `panelNote: (v) => \`N ${v.step} ${v.inside}/${v.total}\``, `moneyFull: (v) => \`${v}\``를 더하고, 기존 `'예측 없는 날은 건너뛰고, 출발일마다 구름 24개 + 예측가 1개'`를 바꾼다. import에 `CLOUD, QDOT` 추가:

```ts
  it('예측 없는 날은 건너뛰고, 출발일마다 구름 perDate개 + 예측가 별(번짐 + 심) 2개', () => expect(L.n).toBe(2 * (CLOUD.perDate + 2)));
  it('가운데 50% 층은 바깥 층보다 크고 진하다', () => {
    const cloud = Array.from({ length: L.n }, (_, i) => i).filter((i) => L.size[i] === CLOUD.coreSize || L.size[i] === CLOUD.outerSize);
    expect(cloud).toHaveLength(2 * CLOUD.perDate);
    const core = cloud.filter((i) => L.size[i] === CLOUD.coreSize), outer = cloud.filter((i) => L.size[i] === CLOUD.outerSize);
    expect(core.length).toBeGreaterThan(0); expect(outer.length).toBeGreaterThan(0);
    for (const i of core) expect(L.alpha[i]).toBe(CLOUD.coreA);
    for (const i of outer) expect(L.alpha[i]).toBe(CLOUD.outerA);
  });
  it('별자리 선 하나: 예측 있는 날의 예측가 자리를 날짜 순으로(예측 없는 날은 건너뛴다)', () => {
    expect(L.lines).toHaveLength(1);
    const pts = L.lines![0].pts;
    expect(pts).toHaveLength(4);
    expect([pts[0], pts[1]]).toEqual([sc.x(0) / size.w, sc.y(200_000) / size.h]);
    expect([pts[2], pts[3]]).toEqual([sc.x(2) / size.w, sc.y(300_000) / size.h]);
  });
  it('처음 짚은 날 = 공휴일 무렵 출발일 중 구간이 가장 넓은 날(항목 번호), 없으면 전체에서', () => {
    expect(L.initial).toBe(1); // 2026-09-27(공휴일, 폭 130,000) — 예측 있는 날만 센 번호 1
    const noHol = cloudLayout({ ...cd, holidays: {} }, size, s);
    expect(noHol.initial).toBe(1); // 폭 110,000 < 130,000
  });
  it('넓은 판: 덧그림 칸에 점 20개(속 빈 점 4개), 칸 머리·설명, 같은 세로축', () => {
    const shapes = L.overlay!(1);
    const dots = shapes.filter((x) => x.type === 'dot' && x.r === QDOT.r);
    expect(dots).toHaveLength(QDOT.n);
    expect(dots.filter((x) => x.type === 'dot' && x.hollow)).toHaveLength(4);
    expect(shapes).toContainEqual(expect.objectContaining({ type: 'text', cls: 'panelHead', text: 'H 2026-09-27 5' }));
    expect(shapes).toContainEqual(expect.objectContaining({ type: 'text', cls: 'panelNote', text: 'N 5 16/20' }));
    // 칸의 점은 모두 그날 q10 아래 ~ q90 위 범위 안 세로 자리(같은 축): 맨 위 점 ≥ y(q95 근사) 위쪽 한계, 판 안
    for (const d of dots) { expect(d.y).toBeGreaterThan(0); expect(d.y).toBeLessThan(1); expect(d.x).toBeGreaterThan(sc.x(2) / size.w); }
  });
  it('좁은 판(640px 미만): 칸 없음 — 덧그림은 짚은 날 별 강조만', () => {
    const N = cloudLayout(cd, { w: 600, h: 380 }, s);
    const shapes = N.overlay!(0);
    expect(shapes.filter((x) => x.type === 'dot' && x.r === QDOT.r)).toHaveLength(0);
    expect(shapes.filter((x) => x.type === 'text')).toHaveLength(0);
  });
  it('짚은 날이 없으면(−1) 덧그림 없음', () => expect(L.overlay!(-1)).toEqual([]));
```

배치 함수는 `s.panelHead`에 ISO 날짜와 D+일수를 넘긴다(기준일 09-22 → 09-27은 D+5). 날짜 글자 형식은 build.ts가 정한다.

**같은 describe 위쪽의 `const sc = cloudScale(cd, size);`를 칸 폭을 뺀 축으로 바꾼다** — 넓은 판(1080px)은 오른쪽 칸 때문에 가로축이 좁아진다:

```ts
  const side = Math.max(CLOUD.panelMin, Math.min(CLOUD.panelMax, size.w * CLOUD.panelFrac));
  const sc = cloudScale(cd, size, side + CLOUD.panelGap);
```

`'구름 점은 모두 그날 q10~q90 안, 예측가 점은 예측가 자리'`·`'예측가 가까이가 가장자리보다 빽빽하다'`·`'공휴일 출발일은 호박색(구름과 예측가 모두)…'`은 예측가 점을 "크기 `CLOUD.star`인 심"으로 찾게 고친다(번짐 점은 `CLOUD.star * STAR.haloScale`). 기존 `'강조 번호'`·`'짚을 항목'` 테스트는 그대로 통과해야 한다(항목 문장 끝에 `panelNote`가 붙으므로 문장 기대값에 `' · N 5 16/20'`을 더한다 — 아래 Step 3-6).

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run tests/unit/charts-layouts.test.ts -t cloudLayout` / Expected: FAIL

- [ ] **Step 3: 구현** — `src/charts/layouts.ts`
  1. 상수:
  ```ts
  // ⑤ 차트 4 예측 구간(설계 2026-10-04 §4, 시안 interval-constellation v6): 출발일마다 q10~q90 사이에 점을 뿌리되 분위(0.1~0.9)를
  // 고르게 나눠 표준정규 분위수로 바꾸므로 예측가 근처는 빽빽하고 가장자리는 성기다(두 쪽 정규 근사 — 점 위치는 표현용, 자막에 밝힘).
  // 가운데 50%(분위 0.25~0.75)는 크고 진하게, 바깥은 작고 옅게 — 팬 차트의 두 층. 예측가는 별 + 별자리 선.
  // 넓은 판(panelMinPx 이상)은 오른쪽 칸(판 폭의 panelFrac, panelMin~panelMax px)에 짚은 날의 분위수 점 그림(QDOT)
  // focusDim 0.8: 짚은 날 외 점을 조금만 흐린다 — 0.45면 처음부터 짚힌 상태라 구름 전체가 늘 어두웠다(시안 대비)
  export const CLOUD = {
    perDate: 30, z90: 1.2815515655446004, coreLo: 0.25, coreHi: 0.75, coreSize: 2.5, coreA: 0.6, outerSize: 2, outerA: 0.24,
    star: 4.4, focusDim: 0.8, panelMinPx: 640, panelFrac: 0.24, panelMin: 200, panelMax: 280, panelGap: 28,
    marginLeft: 0.1, marginTop: 0.16, marginBottom: 0.12,
  } as const;
  // 분위수 점 그림(Kay 외 2016): 점 n개 = 확률 1/n씩. 칸 높이는 구간 폭의 1/rows(최소 점 한 줄)로 묶어 가로로 쌓는다
  export const QDOT = { n: 20, r: 5, gap: 2.4, rows: 6 } as const;
  ```
  (`marginTop` 0.12 → 0.16: 칸 머리 두 줄 자리)
  2. `cloudScale(cd, size, rightPx = 0)`: `innerW = size.w - left - rightPx`로 바꾼다(나머지 그대로)
  3. `cloudLayout` 시그니처 `s`에 `panelHead(v: { date: string; dday: number }): string; panelNote(v: { step: number; total: number; inside: number }): string; moneyFull(v: number): string;` 추가
  4. 본문 앞부분:
  ```ts
  const idx = valid(cd);
  const wide = size.w >= CLOUD.panelMinPx;
  const side = wide ? Math.max(CLOUD.panelMin, Math.min(CLOUD.panelMax, size.w * CLOUD.panelFrac)) : 0;
  const sc = cloudScale(cd, size, side ? side + CLOUD.panelGap : 0);
  const colW = ((size.w - side - (side ? CLOUD.panelGap : 0)) * (1 - CLOUD.marginLeft)) / cd.dates.length;
  ```
  5. 날짜 루프 안 구름·예측가:
  ```ts
  for (let k = 0; k < CLOUD.perDate; k++) {
    const q = 0.1 + (0.8 * (k + 0.5)) / CLOUD.perDate, z = invNorm(q);
    const v = z < 0 ? price + (z / CLOUD.z90) * (price - lo) : price + (z / CLOUD.z90) * (hi - price);
    const core = q > CLOUD.coreLo && q < CLOUD.coreHi;
    p.add((sc.x(i) + (rand() - 0.5) * colW * 0.62) / size.w, sc.y(v) / size.h, core ? CLOUD.coreSize : CLOUD.outerSize,
      core ? CLOUD.coreA : CLOUD.outerA, hol ? TONE.amber : TONE.dot, -1, j);
  }
  addStar(p, sc.x(i) / size.w, sc.y(price) / size.h, CLOUD.star, hol ? TONE.amber : TONE.text, 1, -1, j);
  ```
  6. 항목 문장 끝에 칸 설명을 붙인다(낭독용 — 설계 §4): `const note = s.panelNote({ step: 100 / QDOT.n, total: QDOT.n, inside: QDOT_INSIDE });` 를 루프 앞에서 한 번 만들고 `text: \`${s.tip({…})} · ${note}\``. `QDOT_INSIDE`는 모듈 상수로:
  ```ts
  // 분위 (k + 0.5)/n 중 q10~q90 안에 드는 점 수(n = 20이면 16) — 문구에 숫자를 쓰지 않으려고 코드가 센다
  const QDOT_Q = Array.from({ length: QDOT.n }, (_, k) => (k + 0.5) / QDOT.n);
  const QDOT_INSIDE = QDOT_Q.filter((q) => q > 0.1 && q < 0.9).length;
  ```
  7. 루프 뒤: 별자리 선과 처음 짚은 날
  ```ts
  const lines = [{ pts: idx.flatMap((i) => [sc.x(i) / size.w, sc.y(cd.price[i]!) / size.h]), tone: TONE.text, alpha: LINE.alpha * 0.9, width: LINE.width }];
  // 처음 짚은 날: 공휴일 무렵 출발일 중 구간(q90 − q10)이 가장 넓은 날 — 분위수 점 그림이 가장 잘 펼쳐지는 날(설계 §4). 없으면 전체에서
  const width = (i: number) => cd.hi[i]! - cd.lo[i]!;
  const holIdx = idx.filter((i) => cd.holidays[cd.dates[i]] !== undefined);
  const pool = holIdx.length ? holIdx : idx;
  const first = pool.reduce((a, i) => (width(i) > width(a) ? i : a), pool[0]);
  const initial = idx.indexOf(first);
  ```
  8. 덧그림 함수(같은 파일, `cloudLayout` 아래 export하지 않는 도우미 `cloudPanel`):
  ```ts
  // ⑤ 덧그림: 짚은 날의 별 강조(모든 판) + 넓은 판이면 오른쪽 분위수 점 그림 칸. 세로는 왼쪽 차트와 같은 sc.y
  function cloudPanel(cd: CloudData, size: PlotSize, sc: ReturnType<typeof cloudScale>, idx: number[], side: number,
    s: { panelHead(v: { date: string; dday: number }): string; panelNote(v: { step: number; total: number; inside: number }): string; moneyFull(v: number): string },
    sel: number): OverlayShape[] {
    if (sel < 0 || sel >= idx.length) return [];
    const i = idx[sel], price = cd.price[i]!, lo = cd.lo[i]!, hi = cd.hi[i]!;
    const hol = cd.holidays[cd.dates[i]] !== undefined;
    const W = size.w, H = size.h, X = sc.x(i), Y = (v: number) => sc.y(v);
    const out: OverlayShape[] = [
      { type: 'dot', x: X / W, y: Y(price) / H, r: 9, tone: hol ? TONE.amber : TONE.text, alpha: 0.22 },
      { type: 'dot', x: X / W, y: Y(price) / H, r: 3.4, tone: hol ? TONE.amber : TONE.text, alpha: 1 },
    ];
    if (!side) return out;
    const x0 = W - side, x1 = W - 16;
    const qv = (q: number) => { const z = invNorm(q) / CLOUD.z90; return z < 0 ? price + z * (price - lo) : price + z * (hi - price); };
    // q10·q90 자리: 기둥에서 칸 끝까지 성긴 점선
    for (const v of [lo, hi]) out.push({ type: 'dash', x0: (X + 8) / W, x1: x1 / W, y: Y(v) / H, tone: TONE.dot, alpha: 0.45 });
    // 점 쌓기: 세로를 칸(구간 폭의 1/rows, 최소 점 한 줄)으로 나눠 같은 칸의 점을 가로로
    const cell = QDOT.r * 2 + QDOT.gap, cellH = Math.max(cell, (Y(lo) - Y(hi)) / QDOT.rows), y0 = Y(hi) - cellH * 3;
    const bins = new Map<number, number[]>();
    QDOT_Q.forEach((q, k) => { const b = Math.floor((Y(qv(q)) - y0) / cellH); bins.set(b, [...(bins.get(b) ?? []), k]); });
    for (const [b, ks] of bins) ks.forEach((k, jx) => {
      const out4 = QDOT_Q[k] < 0.1 || QDOT_Q[k] > 0.9;
      out.push({ type: 'dot', x: (x0 + 8 + QDOT.r + jx * cell) / W, y: Math.min(H - QDOT.r, Math.max(QDOT.r, y0 + (b + 0.5) * cellH)) / H,
        r: QDOT.r, tone: out4 ? TONE.text : TONE.dot, alpha: out4 ? 0.75 : 0.95, hollow: out4 });
    });
    const dday = Math.round((utc(cd.dates[i]) - utc(cd.asOf)) / DAY);
    out.push({ type: 'text', x: x0 / W, y: 12 / H, text: s.panelHead({ date: cd.dates[i], dday }), align: 'start', cls: 'panelHead' });
    out.push({ type: 'text', x: x0 / W, y: 32 / H, text: s.panelNote({ step: 100 / QDOT.n, total: QDOT.n, inside: QDOT_INSIDE }), align: 'start', cls: 'panelNote' });
    out.push({ type: 'text', x: x1 / W, y: Y(price) / H, text: s.moneyFull(price), align: 'end', cls: 'panelValue' });
    out.push({ type: 'text', x: x1 / W, y: (Y(hi) - 10) / H, text: `q90 ${s.moneyFull(hi)}`, align: 'end', cls: 'panelQ' });
    out.push({ type: 'text', x: x1 / W, y: (Y(lo) + 10) / H, text: `q10 ${s.moneyFull(lo)}`, align: 'end', cls: 'panelQ' });
    return out;
  }
  ```
  (`y0`의 `- cellH * 3`: 바깥 점(q0.025·q0.975)이 q90 위·q10 아래로 나가도 칸 번호가 음수가 되지 않게 시작을 여유 있게 잡는다. `import type { OverlayShape }`를 types import에 추가)
  9. return: `return { ...p.done(labels, TONE.text, CLOUD.focusDim), items, initial, lines, overlay: (sel) => cloudPanel(cd, size, sc, idx, side, s, sel) };`
  10. 왼쪽 위 공휴일 이름표·D+ 눈금은 `sc.x`를 그대로 쓰므로 칸이 생겨도 따라온다. `const left = size.w * CLOUD.marginLeft` 쓰는 곳은 그대로

- [ ] **Step 4: 문구·전달**
  - ko `charts.band`: `"panelHead": "{v.date} 출발 · D+{v.dday}"`, `"panelNote": "점 하나 = 가능성 {v.step}% · {v.total}개 중 {v.inside}개가 구간 안"`
  - en: `"panelHead": "Departs {v.date} · D+{v.dday}"`, `"panelNote": "One dot = {v.step}% chance · {v.inside} of {v.total} inside the range"`
  - ja: `"panelHead": "{v.date}出発 · D+{v.dday}"`, `"panelNote": "点ひとつ = 確率{v.step}% · {v.total}個中{v.inside}個が区間内"`
  - `build.ts` `ChartStrings`에 `panelHead?: string; panelNote?: string;`, `chartCloud` 분기:
  ```ts
    case 'chartCloud': {
      const money = new Intl.NumberFormat(s.locale, { notation: 'compact', maximumFractionDigits: 1 });
      const full = new Intl.NumberFormat(s.locale);
      const fill = (tpl: string | undefined, v: Record<string, string | number>) => (tpl ? interpolate(tpl, { v }, s.locale) : '');
      return cloudLayout(loaded.cloud!, size, {
        money: (v) => money.format(v), dday: (n) => `D+${n}`, holiday, axis: s.axis ?? '',
        tip: (v) => tip({ date: dayOf(v.date), price: money.format(v.price), lo: money.format(v.lo), hi: money.format(v.hi) }),
        panelHead: (v) => fill(s.panelHead, { date: dayOf(v.date), dday: v.dday }),
        panelNote: (v) => fill(s.panelNote, v),
        moneyFull: (v) => full.format(v),
      });
    }
  ```
  - `Charts.tsx` strings에 `...(b.id === 'band' ? { panelHead: tipOf('band', 'panelHead'), panelNote: tipOf('band', 'panelNote') } : {})`
  - 표시 상자 문장(`charts.band.tip`)에 "원"이 있으므로 `moneyFull`은 숫자만(단위 없이) — 칸 글자는 숫자만 보인다(시안과 같음)

- [ ] **Step 5: 통과 확인** — Run: `npx tsc --noEmit && npx vitest run tests/unit/charts-layouts.test.ts tests/unit/content.test.ts tests/unit/charts-content.test.ts` / Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/charts/layouts.ts src/charts/build.ts src/components/sections/Charts.tsx content/ko.json content/en.json content/ja.json tests/unit/charts-layouts.test.ts
git commit -m "feat(charts): interval cloud in two layers, forecast constellation, quantile dotplot panel

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: ④ 출발일 — 별자리 선 + 가장 높은 공휴일 봉우리 이름표

**Files:**
- Modify: `src/charts/layouts.ts` (`departLayout`, `DEPART`)
- Test: `tests/unit/charts-layouts.test.ts` (`describe('departLayout')`)

**Interfaces:**
- Consumes: Task 1 `LINE`, `callout`
- Produces: `DEPART.lineA = 0.45`

- [ ] **Step 1: 실패하는 테스트** — `describe('departLayout')` 안에 추가:

```ts
  it('별자리 선 하나: 출발일 뭉치 가운데를 날짜 순으로, 알파 DEPART.lineA', () => {
    expect(L.lines).toHaveLength(1);
    const ln = L.lines![0];
    expect(ln.alpha).toBe(DEPART.lineA);
    expect(ln.pts).toHaveLength(charts.dates.length * 2);
    for (let d = 0; d < charts.dates.length; d++) {
      const [cx, cy] = centerOf(d);
      expect(ln.pts[d * 2]).toBeCloseTo(cx, 6);
      expect(ln.pts[d * 2 + 1]).toBeCloseTo(cy, 6);
    }
  });
  it('결론 이름표: 공휴일 무렵 출발일 중 가장 높은 봉우리 하나(호박, 위), 그 날의 공휴일 이름표는 빠진다', () => {
    const c = L.labels.filter((l) => l.type === 'callout');
    expect(c).toHaveLength(1);
    const peak = charts.depart.pct.reduce((b, v, i) => (charts.depart.holiday[i] !== null && v > charts.depart.pct[b] ? i : b),
      charts.depart.pct.findIndex((_, i) => charts.depart.holiday[i] !== null));
    expect(c[0]).toMatchObject({ tone: 'amber', place: 'above', value: depS.pct(Math.round(charts.depart.pct[peak] / 10)), note: depS.holiday(charts.depart.holiday[peak]!) });
    const peakLabel = charts.labels.find((l) => l.date === charts.dates[peak]);
    if (peakLabel) expect(L.labels.filter((l) => l.type === 'text' && l.cls === 'holiday' && l.text === depS.holiday(peakLabel.code) && Math.abs(l.x - c[0].x) < 1e-6)).toHaveLength(0);
  });
```

(`charts`·`depS`는 이 describe가 이미 쓰는 고정 데이터·문자열이다. 고정 데이터에 공휴일 출발일이 없으면 위 테스트의 `findIndex`가 −1 — 그 경우 고정 데이터 `charts.depart.holiday`에 공휴일 코드가 있는 날이 적어도 하나 있는지 먼저 확인하고, 없으면 테스트 위쪽 고정 데이터에 하나 넣는다.)

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run tests/unit/charts-layouts.test.ts -t departLayout` / Expected: FAIL

- [ ] **Step 3: 구현** — `DEPART`에 `lineA: 0.45` 추가(주석: "별자리 선 알파 — 출발일 180개라 ⑤보다 옅게(설계 §4, 화면 보고 조정)"). 날짜 루프에서 `cx, cy`를 모아 `const centers: number[] = [];` 에 `centers.push(cx / W, cy / H)`. 공휴일 이름표 루프 **앞**에서 봉우리를 고른다:

```ts
  // 결론 이름표: 공휴일 무렵 출발일 중 가장 높은 봉우리(지금 데이터로 신정 +71%) — 값·이름 모두 데이터에서
  let peak = -1;
  d.dates.forEach((_, i) => { if (d.depart.holiday[i] !== null && (peak < 0 || d.depart.pct[i] > d.depart.pct[peak])) peak = i; });
```

공휴일 이름표 `.filter(({ i }) => i >= 0)`를 `.filter(({ i }) => i >= 0 && i !== peak)`로. 이름표 목록 끝에:

```ts
  if (peak >= 0) {
    // 봉우리가 판 위쪽 끝(48px 안)이면 이름표가 판 밖으로 나가므로 아래에 붙인다
    const py = Y(d.depart.pct[peak] / 10) - r;
    const place = py < 48 ? 'below' : 'above';
    labels.push({ type: 'callout', x: X(d.dates[peak]) / W, y: py / H,
      value: s.pct(Math.round(d.depart.pct[peak] / 10)), note: s.holiday(d.depart.holiday[peak]!), tone: 'amber', place });
  }
```

return에 `lines: [{ pts: centers, tone: TONE.text, alpha: DEPART.lineA, width: 1 }]`를 더한다(`return { ...p.done(…), items, lines }` 형태 — 지금 return 모양에 맞춰).

(테스트는 지금 데이터 기준 'above'를 기대한다. 고정 데이터가 봉우리를 위쪽 끝에 두면 테스트 기대값을 `place`에 맞춰 고친다.)

- [ ] **Step 4: 통과 확인** — Run: `npx vitest run tests/unit/charts-layouts.test.ts` / Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/charts/layouts.ts tests/unit/charts-layouts.test.ts
git commit -m "feat(charts): departure-date constellation and top holiday peak callout

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: ③ 모델 구조 — 기준 가격 별자리 선, 잔차 0선 또렷이

**Files:**
- Modify: `src/charts/model.ts`
- Test: `tests/unit/charts-model.test.ts`

**Interfaces:**
- Consumes: Task 1 `LINE`
- Produces: `MODEL.zeroA = 0.95`

- [ ] **Step 1: 실패하는 테스트** — `tests/unit/charts-model.test.ts`에 추가(이 파일의 단계별 배치 배열 `L`과 고정 데이터 이름을 그대로 쓴다):

```ts
  it('1단계에만 별자리 선: 기준 가격이 있는 출발일 마디를 날짜 순으로', () => {
    expect(L[0].lines ?? []).toHaveLength(0);
    expect(L[2].lines ?? []).toHaveLength(0);
    expect(L[1].lines).toHaveLength(1);
    const pts = L[1].lines![0].pts;
    const known = data.model.base.filter((v) => v !== null).length;
    expect(pts).toHaveLength(known * 2);
    for (let k = 2; k < pts.length; k += 2) expect(pts[k]).toBeGreaterThanOrEqual(pts[k - 2]);
  });
  it('2단계 0 끊긴 점선은 결론 층(보이는 점 알파 MODEL.zeroA)', () => {
    const l = L[2];
    for (let i = lineStart(l); i < l.n; i++) if (l.alpha[i] > 0) expect(l.alpha[i]).toBe(MODEL.zeroA);
  });
```

(`data`·`lineStart`·`L`은 이 파일에 이미 있는 이름이다 — 이름이 다르면 파일 위쪽 정의를 보고 맞춘다. import에 `MODEL` 추가.)

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run tests/unit/charts-model.test.ts` / Expected: FAIL

- [ ] **Step 3: 구현** — `MODEL`에 `zeroA: 0.95` 추가(주석: "3단계 0 끊긴 점선 알파 — 결론 층(설계 2026-10-04 §4)"). 기준 선 루프의 `if (st === 2) p.add(x, Y(0) / H, 2.2, i % MODEL.dashPeriod < MODEL.dashOn ? 0.75 : 0, …)`의 `0.75`를 `MODEL.zeroA`로. return 앞에:

```ts
  // 1단계 별자리 선: 기준 가격이 있는 출발일 마디를 잇는다(설계 2026-10-04 §4). 점으로 된 기준 선 위에 겹쳐 선의 흐름만 또렷이
  const lines = st === 1
    ? [{ pts: known.flatMap((k) => [XT(k.t) / W, Y(k.v / 10) / H]), tone: TONE.text, alpha: LINE.alpha * 0.8, width: 1 }]
    : undefined;
```

return을 `return { ...p.done(labels, TONE.text, CHART_FOCUS_DIM), variant: \`stage:${st}\`, lines };`로. import `LINE` from `./lines`.

- [ ] **Step 4: 통과 확인** — Run: `npx vitest run tests/unit/charts-model.test.ts` / Expected: PASS(기존 "단계 사이 점 수 같음" 포함)

- [ ] **Step 5: Commit**

```bash
git add src/charts/model.ts tests/unit/charts-model.test.ts
git commit -m "feat(charts): model-structure baseline constellation, crisper residual zero line

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: ② 걸러내기·⑤ 검증 설계 — 배경 점 옅게, 걸린 점·평가 점 또렷이

**Files:**
- Modify: `src/charts/filter.ts`, `src/charts/split.ts`
- Test: `tests/unit/charts-filter.test.ts`, `tests/unit/charts-split.test.ts`

**Interfaces:**
- Produces: `FILTER.keptA = 0.4`, `FILTER.litA = 0.95`, `SPLIT.trainA = 0.4`

- [ ] **Step 1: 실패하는 테스트**
  - `charts-filter.test.ts`에 추가(파일의 단계별 배치·도우미 이름을 따른다):
  ```ts
  it('남는 점은 배경 층(FILTER.keptA), 걸려 켜진 점은 FILTER.litA', () => {
    for (const L of all) for (let i = 0; i < L.n; i++) {
      if (L.alpha[i] === 0 || L.size[i] === 1.5) continue; // 숨은 점·규칙 점선
      expect(L.alpha[i]).toBe(L.tone[i] === TONE.amber ? FILTER.litA : FILTER.keptA);
    }
  });
  ```
  (`all`이 없으면 이 파일이 단계별 배치를 담는 배열 이름을 쓴다)
  - `charts-split.test.ts` `'평가 점은 호박색, 아직 안 씀은 흐림…'`에 `expect(kf.alpha[0]).toBe(SPLIT.trainA); expect(kf.alpha[2]).toBe(0.95);` 추가(인덱스 0 = 학습, 2 = 평가 — 같은 테스트의 tone 기대값 순서와 같다)

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run tests/unit/charts-filter.test.ts tests/unit/charts-split.test.ts` / Expected: FAIL

- [ ] **Step 3: 구현**
  - `filter.ts` `FILTER`에 `keptA: 0.4, litA: 0.95`(주석: "남는 점은 배경 층, 걸린 점은 결론 층 — 규칙이 무엇을 걸렀는지 먼저 보이게(설계 2026-10-04 §4)"), 표본 루프 `visible ? 0.7 : 0`을 `visible ? (state === 'lit' ? FILTER.litA : FILTER.keptA) : 0`로
  - `split.ts` `SPLIT`에 `trainA: 0.4`(주석 같은 취지), `role === 0 ? 0.7`을 `role === 0 ? SPLIT.trainA`로

- [ ] **Step 4: 통과 확인** — Run: `npx vitest run tests/unit/charts-filter.test.ts tests/unit/charts-split.test.ts` / Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/charts/filter.ts src/charts/split.ts tests/unit/charts-filter.test.ts tests/unit/charts-split.test.ts
git commit -m "feat(charts): filter/split backgrounds recede, flagged and test points stand out

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: e2e·눈 확인·대체 이미지·문서·PR

**Files:**
- Modify: `tests/e2e/charts.spec.ts`
- Modify: `docs/superpowers/specs/2026-10-04-dot-hierarchy-design.md`(끝에 "구현 결과"), `CLAUDE.md`("현재 상태")

- [ ] **Step 1: e2e 고치기·추가** — `tests/e2e/charts.spec.ts`
  1. 눈금 수: `['chartCurve', '.chart-label.tick', 11]` → `13`(구간 8 + 눈금 5), 테스트 제목의 "벌떼 구간 8 + 눈금 3"도 "눈금 5"로. `'창 크기를 바꾸면…'`의 `toHaveCount(11` → `13`
  2. `test.describe('3D 꺼짐(움직임 줄이기)')` 안에 추가(움직임 줄이기 = 선이 바로 보인다):
  ```ts
  for (const [key, n] of [['chartCurve', 1], ['chartCloud', 1], ['chartDepart', 1]] as const) {
    test(`${key}: 별자리 선이 그려진다`, async ({ page }) => {
      await page.goto('/');
      await center(page, `.chart-block[data-scene="${key}"]`);
      const svg = page.locator(`.chart-block[data-scene="${key}"] .chart-lines`);
      await expect(svg).toHaveAttribute('data-on', '', { timeout: 10_000 });
      await expect(svg.locator('path')).toHaveCount(n);
      expect(await svg.locator('path').first().getAttribute('d')).toMatch(/^M[\d.]+ [\d.]+L/);
    });
  }
  test('④ U자: 결론 이름표 둘(최저·출발 직전)', async ({ page }) => {
    await page.goto('/');
    await center(page, '.chart-block[data-scene="chartCurve"]');
    await expect(page.locator('.chart-block[data-scene="chartCurve"] .chart-callout')).toHaveCount(2, { timeout: 10_000 });
  });
  test('⑤ 예측 구간 1440px: 칸에 점 20개, → 로 짚은 날을 바꾸면 칸 머리가 바뀐다', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await center(page, '.chart-block[data-scene="chartCloud"]');
    const block = page.locator('.chart-block[data-scene="chartCloud"]');
    await expect(block.locator('.chart-lines circle[r="5"]')).toHaveCount(20, { timeout: 10_000 });
    const head = block.locator('.chart-panelHead');
    const before = await head.textContent();
    await block.locator('.chart-touch').focus();
    await page.keyboard.press('ArrowRight');
    await expect(head).not.toHaveText(before ?? '');
  });
  test('⑤ 예측 구간 390px: 칸 없음, 가로 스크롤 없음', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await center(page, '.chart-block[data-scene="chartCloud"]');
    const block = page.locator('.chart-block[data-scene="chartCloud"]');
    await expect(block.locator('.chart-lines path')).toHaveCount(1, { timeout: 10_000 });
    await expect(block.locator('.chart-panelHead')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
  ```
  (`center`는 이 파일에 이미 있는 도우미. 칸 점은 속 빈 점을 포함해 모두 SVG `r="5"`(QDOT.r) — 짚은 날 별 강조 원은 r 9·3.4라 섞이지 않는다)
  3. `test('3D가 도중에 꺼지면 이미 불러온 판이 그 자리에서 2D로 그린다'…)` 끝에 `await expect(page.locator('.chart-block[data-scene="chartCloud"] .chart-lines path')).toHaveCount(1);` 추가
  4. 3D 켜짐 describe가 있으면(파일에서 `expect3D` 쓰는 곳) 거기에 하나: 판 가운데로 옮긴 직후 `.chart-lines`에 `data-on`이 **없고**, 2초 안에 생긴다:
  ```ts
  test('3D 켜짐: 선은 점이 자리 잡은 뒤에 나타난다', async ({ page }) => {
    await page.goto('/');
    if (!(await expect3D(page))) return;
    await center(page, '.chart-block[data-scene="chartCurve"]');
    const svg = page.locator('.chart-block[data-scene="chartCurve"] .chart-lines');
    await expect(svg).not.toHaveAttribute('data-on', '');
    await expect(svg).toHaveAttribute('data-on', '', { timeout: 3_000 });
  });
  ```
  (`expect3D`의 실제 시그니처·반환을 파일 위쪽에서 확인해 맞춘다 — 도중에 꺼지면 건너뛰는 규칙을 따른다)

- [ ] **Step 2: 전체 단위·타입·빌드·용량** — Run: `npx tsc --noEmit && npm test && npm run build && npm run size` / Expected: 모두 통과, 초기 JS ≤150KB

- [ ] **Step 3: e2e** — 부하 확인 `uptime` 뒤 Run: `npm run e2e`(전부) / Expected: 통과. 실패하면 화면 캡처(`test-results/`)를 직접 보고 고친다. 맥미니 로컬에서만 실패하는 `terrain.spec.ts` 대비 2.05:1(알려진 것, CLAUDE.md)은 무시

- [ ] **Step 4: 눈 확인** — `npm run build` 결과를 띄워(`npx serve out` 또는 이 저장소의 미리보기 명령) 1440×900·1024×768·390×844에서 ④ 출발일·④ U자·③ 모델 구조(단계 1·2)·② 걸러내기·⑤ 검증 설계·⑤ 예측 구간을 3D 켜짐·꺼짐(`?` 움직임 줄이기 에뮬레이션)으로 캡처해 **직접 본다**. 확인할 것: 선과 별이 겹친다(어긋남 없음), 3D에서 선이 점보다 먼저 보이지 않는다, ④ 출발일 선이 지저분하지 않은지(지저분하면 `DEPART.lineA`를 0.3~0.4로 낮춰 다시 본다), callout이 판 밖으로 안 나간다, ⑤ 칸 글자가 겹치지 않는다

- [ ] **Step 5: 대체 이미지** — Run: `npm run fallbacks` 뒤 `public/` 대체 WebP 중 차트 장면이 있으면 열어 본다. 차트 대체 화면은 2D 캔버스 + SVG 층을 그대로 쓰므로(설계 §5) 이미지에 선이 없어도 실제 대체 화면에는 선이 보인다 — 대체 화면(`data-3d="off"`)에서 선이 보이는지만 Step 4에서 확인했으면 된다. 대체 이미지 파일이 바뀌었으면 커밋에 포함

- [ ] **Step 6: 문서** — 설계서 끝에 `## 구현 결과`(실제 바뀐 상수·결정: 예 `DEPART.lineA` 최종값, callout 위치 조정, 눈 확인에서 고친 것), CLAUDE.md "현재 상태"에 이 PR 번호·남은 확인. "진행 상황"의 다음 단계를 "정보 전달 2 설계(§8 목록)"로

- [ ] **Step 7: Commit·push·PR**

```bash
git add tests/e2e/charts.spec.ts docs/superpowers/specs/2026-10-04-dot-hierarchy-design.md CLAUDE.md
git commit -m "test(e2e): constellation lines, callouts, interval panel; docs

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push -u origin feat/dot-hierarchy
gh pr create --title "점 위계와 별자리 선 — 차트가 한눈에 읽히게" --body "설계 docs/superpowers/specs/2026-10-04-dot-hierarchy-design.md, 계획 docs/superpowers/plans/2026-10-04-dot-hierarchy.md

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

CI 통과 뒤 사용자에게 PR 주소 + Vercel 미리보기 주소(`gh pr checks <번호>`의 Vercel 줄)와 "④ FINDINGS 두 차트, ⑤ 예측 구간(마우스 올려 보기), ③ 모델 구조 2단계, ② 걸러내기, ⑤ 검증 설계"를 어디서 보면 되는지 함께 준다.
