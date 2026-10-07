# 배경 표본 밀도 + TSS 반복 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 차트 배경 층(관측 표본)을 차트마다 정한 만큼 촘촘하게(표본 늘리고 점 작게) 하고, ⑤ 검증 설계 TSS 폴드 넘김을 반복시킨다.

**Architecture:** 표본 수는 파이썬 추출 상수(`scripts/export_charts.py`)와 구름 상수(`CLOUD.perDate`), 점 크기는 배치 함수 상수 객체(`SWARM`·`MODEL`·`FILTER`·`SPLIT`·`CLOUD`)만 바꾼다 — 3D와 2D가 같은 배치를 그리므로 둘 다 바뀐다. TSS 반복은 순수 타이머 `startSubs`에 `loopHoldMs`를 더하고 `ChartStage` prop으로 ⑤ 검증 설계 블록만 켠다.

**Tech Stack:** Next.js 정적 export, TypeScript, vitest, Playwright, Python(pandas) 추출 스크립트(`scripts/py.sh`).

**설계서:** `docs/superpowers/specs/2026-10-07-dot-density-design.md` (시안 `docs/superpowers/mockups/2026-10-07/`)

**브랜치:** `feat/dot-density` (이미 있음, 설계서 커밋 `21660a7`). 커밋은 `git add <경로>`로만(훅이 `git add -A`를 막는다). 커밋 메시지 끝:
```
Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

## 설계서에서 바로잡은 것(계획 작성 중 확인)

1. **휴대폰 3D 점 수**: 세로 화면은 잡음 점을 절반만 만든다(`TerrainScene.tsx` `noiseStride: isPortrait ? 2 : 1`). 점 구름 = 가로 28,176 / **세로 15,926**. 새 배치의 점 수(시안 데이터로 잼): U자 넓은 판 13,242·좁은 판(358px) 11,469, 모델 약 8,700, 걸러내기 약 8,150, 검증 설계 8,000 — 모두 15,926 아래. 점 수 한도 테스트는 **세로(stride 2) 점 구름**과 좁은 판·넓은 판 둘 다로 잰다(Task 4)
2. 3D 차트 점 크기 = 배치 `size` × 기기 픽셀 비율(`shaders.ts` `chartPx`) — 상수만 바꾸면 3D도 같은 크기
3. `tests/unit/charts-layouts.test.ts`의 `inside()`는 지름 ≥1.6을 검사한다 — 출발일·와플에만 쓰여 이번 변경과 무관(U자·모델·걸러내기·검증 설계에는 쓰지 않음). 새로 1.6 밑으로 내려가는 점이 이 검사에 걸리면 그 검사 대상이 맞는지 보고 알린다(검사를 지우지 않는다)

## 파일 구조

| 파일 | 바꿀 것 |
|---|---|
| `src/components/charts/subTimer.ts` | `loopHoldMs` 옵션 |
| `src/components/charts/ChartStage.tsx` | `subLoopMs` prop → `startSubs` |
| `src/components/sections/Charts.tsx` | ⑤ 검증 설계 블록에 `subLoopMs: SPLIT.loopHoldMs` |
| `src/charts/split.ts` | `SPLIT.loopHoldMs`, `dotWide`·`dotNarrow` |
| `src/charts/model.ts` | `MODEL.dotWide`·`dotNarrow` |
| `src/charts/filter.ts` | `FILTER.dotWide`·`dotNarrow` |
| `src/charts/layouts.ts` | `SWARM.dot`·`gap`, `CLOUD.perDate`·`coreSize`·`outerSize` |
| `scripts/export_charts.py` | 표본 상수 4개 |
| `public/data/charts.2026-09-22.json` | `npm run charts`로 다시 만듦(손 편집 금지) |
| `tests/unit/charts-subtimer.test.ts` | 반복 검사 |
| `tests/unit/charts-density.test.ts` (새) | 배경 점 크기·표본 수·3D 점 수 한도 |
| `tests/e2e/charts.spec.ts` | TSS 반복 e2e |
| 문서 | 설계서 "구현 결과", `CLAUDE.md`, `.claude/rules/visual-system.md` |

---

### Task 1: TSS 반복 — 타이머

**Files:**
- Modify: `src/components/charts/subTimer.ts`
- Test: `tests/unit/charts-subtimer.test.ts`

- [ ] **Step 1: 실패하는 테스트**

`tests/unit/charts-subtimer.test.ts`의 `make`를 `loopHoldMs`를 받게 바꾸고 검사 셋을 더한다(기존 검사는 그대로):

```ts
  const make = (count: number, reduced = false, loopHoldMs?: number) => {
    const seen: number[] = [];
    const t = startSubs({ count, ms: 1000, reduced, set: (n) => seen.push(n), setTimeout, clearTimeout, loopHoldMs });
    return { t, seen };
  };
```

```ts
  it('loopHoldMs를 주면 마지막에서 그만큼 머문 뒤 0으로 돌아가 다시 올라간다', () => {
    const { seen } = make(3, false, 2500);
    vi.advanceTimersByTime(2000);
    expect(seen).toEqual([0, 1, 2]);
    vi.advanceTimersByTime(2499);
    expect(seen).toEqual([0, 1, 2]);
    vi.advanceTimersByTime(1);
    expect(seen).toEqual([0, 1, 2, 0]);
    vi.advanceTimersByTime(2000);
    expect(seen).toEqual([0, 1, 2, 0, 1, 2]);
  });
  it('반복 중 stop하면 멈춘다', () => {
    const { t, seen } = make(3, false, 2500);
    vi.advanceTimersByTime(3000);
    t.stop();
    vi.advanceTimersByTime(20_000);
    expect(seen).toEqual([0, 1, 2]);
  });
  it('움직임 줄이기면 loopHoldMs가 있어도 마지막에 머문다', () => {
    const { seen } = make(5, true, 2500);
    vi.advanceTimersByTime(20_000);
    expect(seen).toEqual([4]);
  });
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/unit/charts-subtimer.test.ts`
Expected: 새 검사 1개 FAIL(0으로 돌아가지 않음). 타입 오류(`loopHoldMs` 없음)는 vitest가 무시하므로 동작으로 실패한다.

- [ ] **Step 3: 구현**

`src/components/charts/subTimer.ts` 전체:

```ts
// 그림 판의 작은 단계(sub) 타이머(계획 8-1): 한 단계 안에서 sub를 0 → count−1로 일정 간격마다 올리고 마지막에서 멈춘다.
// loopHoldMs를 주면 마지막에서 그만큼 머문 뒤 0으로 돌아가 반복한다(⑤ 검증 설계 TSS, 설계 2026-10-07 §5).
// React와 떼어 둔 순수 모듈이라 가짜 시계로 시험한다. 판이 화면 밖으로 나가면 stop, 다시 들어오면 restart(0부터).
export function startSubs(o: {
  count: number; ms: number; reduced: boolean; set(n: number): void;
  setTimeout: typeof setTimeout; clearTimeout: typeof clearTimeout;
  loopHoldMs?: number;
}): { restart(): void; stop(): void } {
  const last = Math.max(0, o.count - 1);
  let n = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const stop = () => { if (timer !== undefined) o.clearTimeout(timer); timer = undefined; };
  const tick = () => {
    n = n >= last ? 0 : n + 1;
    o.set(n);
    if (n < last) timer = o.setTimeout(tick, o.ms);
    else timer = o.loopHoldMs !== undefined ? o.setTimeout(tick, o.loopHoldMs) : undefined;
  };
  const restart = () => {
    stop();
    // 움직임 줄이기: 넘어가는 모습 없이 마지막 모습만(TSS 5/5, 걸러내기는 떨어진 뒤) — 반복도 하지 않는다
    if (o.reduced || last === 0) { n = last; o.set(n); return; }
    n = 0;
    o.set(0);
    timer = o.setTimeout(tick, o.ms);
  };
  restart();
  return { restart, stop };
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run tests/unit/charts-subtimer.test.ts`
Expected: 7 passed

- [ ] **Step 5: 커밋**

```bash
git add src/components/charts/subTimer.ts tests/unit/charts-subtimer.test.ts
git commit -m "feat(charts): sub 타이머 반복 옵션(loopHoldMs)"
```

### Task 2: TSS 반복 — 판에 연결

**Files:**
- Modify: `src/charts/split.ts:15` (`SPLIT`)
- Modify: `src/components/charts/ChartStage.tsx` (Props, 단계 effect)
- Modify: `src/components/sections/Charts.tsx` (`Block` 타입, `VALIDATION_BLOCKS`, `<ChartStage>` props)

- [ ] **Step 1: 상수**

`src/charts/split.ts`의 `SPLIT`에 `loopHoldMs: 2400`을 더하고 위 주석 끝에 한 줄:

```ts
// loopHoldMs: TSS 마지막 폴드에서 머무는 시간 — 그 뒤 폴드 1로 돌아가 반복(설계 2026-10-07 §5)
export const SPLIT = { stages: 3, subs: [1, 1, 5], subMs: 1200, loopHoldMs: 2400, wideMinPx: 820, jitterPx: 1.6, seed: 5, unusedA: 0.2, trainA: 0.4 } as const;
```

(Task 3에서 `dotWide`·`dotNarrow`를 더 넣는다.)

- [ ] **Step 2: ChartStage**

`Props`에 `subLoopMs?: number`를 더하고(`subs?: readonly number[]; subMs?: number; subLoopMs?: number;`), 함수 인자에 `subLoopMs`를 받는다. Props 위 주석에 한 줄: `// subLoopMs: 주면 마지막 sub에서 그만큼 머문 뒤 처음으로 돌아가 반복(⑤ 검증 설계 TSS)`.

단계 effect의 `startSubs` 호출에 `loopHoldMs: subLoopMs`를 넘기고, 의존 배열에 `subLoopMs`를 더한다:

```tsx
      else timer = startSubs({ count, ms: subMs, reduced: false, set, loopHoldMs: subLoopMs, setTimeout: window.setTimeout.bind(window) as typeof setTimeout, clearTimeout: window.clearTimeout.bind(window) });
```
```tsx
  }, [step, subsKey, subMs, subLoopMs]);
```

파일 머리 주석 12줄의 "마지막에서 멈춘다" 뒤에 "(subLoopMs를 주면 반복 — ⑤ TSS)"를 더한다.

- [ ] **Step 3: Charts.tsx**

`Block`의 stage 변형에 `subLoopMs?: number`를 더한다:

```ts
  | (Common & { kind: 'stage'; chart: ChartKey; axis?: true; stages?: number; subs?: readonly number[]; subMs?: number; subLoopMs?: number })
```

`VALIDATION_BLOCKS`의 검증 설계 블록:

```ts
  // 세 평가 방식이 데이터를 나누는 점 그림(계획 8-1) — TSS 칸은 폴드가 저절로 넘어가고 마지막에서 머문 뒤 반복한다(설계 2026-10-07 §5).
  // 판 위 수치는 점수판(정보 전달 2 §5)
  { kind: 'stage', id: 'validation', chart: 'chartSplit', code: 'validation', paras: 3, axis: true,
    stages: SPLIT.stages, subs: SPLIT.subs, subMs: SPLIT.subMs, subLoopMs: SPLIT.loopHoldMs },
```

`<ChartStage>`에 `subMs={b.subMs}` 다음 줄로 `subLoopMs={b.subLoopMs}`.

- [ ] **Step 4: 타입·단위 테스트**

Run: `npx tsc --noEmit && npx vitest run`
Expected: 오류 없음, 모두 통과

- [ ] **Step 5: 커밋**

```bash
git add src/charts/split.ts src/components/charts/ChartStage.tsx src/components/sections/Charts.tsx
git commit -m "feat(charts): ⑤ 검증 설계 TSS 폴드 반복(마지막 2.4초 머묾)"
```

### Task 3: 배경 점 크기 상수

**Files:**
- Modify: `src/charts/layouts.ts` (`SWARM` 241줄 근처, `CLOUD` 336줄 근처)
- Modify: `src/charts/model.ts` (`MODEL`, `const dot`)
- Modify: `src/charts/filter.ts` (`FILTER`, `const dot`)
- Modify: `src/charts/split.ts` (`SPLIT`, `const dot`)
- Create: `tests/unit/charts-density.test.ts`

- [ ] **Step 1: 실패하는 테스트**

`tests/unit/charts-density.test.ts`:

```ts
// 배경 표본 밀도(설계 2026-10-07 §2): 배경 층 점 크기 = 상수, 구름 출발일당 점 수. 수치는 설계 표 그대로
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { ChartsData } from '@/charts/data';
import { filterLayout, FILTER } from '@/charts/filter';
import { CLOUD, SWARM } from '@/charts/layouts';
import { MODEL, modelLayout } from '@/charts/model';
import { SPLIT, splitLayout } from '@/charts/split';
import { facts } from '@/lib/facts';

const charts = JSON.parse(readFileSync(`public/data/charts.${facts.dataVersion}.json`, 'utf8')) as ChartsData;
const WIDE = { w: 1100, h: 520 }, NARROW = { w: 358, h: 360 };
const sizes = (L: { n: number; size: Float32Array; alpha: Float32Array }) => new Set(Array.from({ length: L.n }, (_, i) => L.size[i]));

describe('배경 점 크기 상수(설계 표)', () => {
  it('U자 벌떼 1.5 · 간격 0.3', () => { expect(SWARM.dot).toBe(1.5); expect(SWARM.gap).toBe(0.3); });
  it('구름 출발일마다 60, 가운데 층 2.1 · 바깥 1.7', () => {
    expect(CLOUD.perDate).toBe(60); expect(CLOUD.coreSize).toBe(2.1); expect(CLOUD.outerSize).toBe(1.7);
  });
  it('모델 1.55/1.2, 걸러내기 1.9/1.45, 검증 설계 1.9/1.4', () => {
    expect([MODEL.dotWide, MODEL.dotNarrow]).toEqual([1.55, 1.2]);
    expect([FILTER.dotWide, FILTER.dotNarrow]).toEqual([1.9, 1.45]);
    expect([SPLIT.dotWide, SPLIT.dotNarrow]).toEqual([1.9, 1.4]);
  });
});

describe('배치가 상수를 쓴다', () => {
  const texts = { month: () => '', pct: () => '', axis: '', axisResid: '', line: '' };
  it('모델 관측 점 = dotWide(넓은 판)·dotNarrow(좁은 판)', () => {
    expect(sizes(modelLayout(charts, WIDE, 0, texts)).has(Math.fround(MODEL.dotWide))).toBe(true);
    expect(sizes(modelLayout(charts, NARROW, 0, texts)).has(Math.fround(MODEL.dotNarrow))).toBe(true);
  });
  const fTexts = { axisX: '', axisY: '', box: '', rowsRaw: '', rowsKept: '', rules: ['', '', ''] as [string, string, string], counts: ['', '', ''] as [string, string, string], minutes: String, pct: String };
  it('걸러내기 점 = dotWide·dotNarrow', () => {
    expect(sizes(filterLayout(charts, WIDE, 0, 0, fTexts)).has(Math.fround(FILTER.dotWide))).toBe(true);
    expect(sizes(filterLayout(charts, NARROW, 0, 0, fTexts)).has(Math.fround(FILTER.dotNarrow))).toBe(true);
  });
  const empty = { name: '', r2: '', mae: '', tag: '' };
  const sTexts = { month: () => '', axisX: '', axisY: '', legend: ['', '', ''] as [string, string, string], methods: [empty, empty, empty] as const };
  it('검증 설계 점 = dotWide·dotNarrow', () => {
    expect(sizes(splitLayout(charts, WIDE, 2, 0, sTexts)).has(Math.fround(SPLIT.dotWide))).toBe(true);
    expect(sizes(splitLayout(charts, NARROW, 2, 0, sTexts)).has(Math.fround(SPLIT.dotNarrow))).toBe(true);
  });
});
```

`FilterTexts`·`SplitTexts`·`ModelTexts`의 실제 필드는 각 파일의 타입 정의를 보고 맞춘다(위 객체는 지금 코드 기준 — `filter.ts` `FilterTexts`, `split.ts` `SplitTexts`, `model.ts` `ModelTexts`). 타입이 안 맞으면 테스트 객체를 고치고 배치 코드는 건드리지 않는다.

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/unit/charts-density.test.ts`
Expected: FAIL(상수 값·`dotWide` 없음)

- [ ] **Step 3: 구현**

`src/charts/layouts.ts` `SWARM`: `dot: 2.4, gap: 0.5` → `dot: 1.5, gap: 0.3`. 위 주석에 한 줄: `// dot·gap: 배경 표본 밀도(설계 2026-10-07) — 표본 16,000을 칸이 네모로 꽉 차지 않게 작은 점으로(지금 2.4·0.5에서)`.

`CLOUD`: `perDate: 30` → `60`, `coreSize: 2.5` → `2.1`, `outerSize: 2` → `1.7`. 위 주석에 한 줄: `// perDate·coreSize·outerSize: 배경 표본 밀도(설계 2026-10-07) — 점 두 배, 조금 작게`.

`src/charts/model.ts` `MODEL`에 `dotWide: 1.55, dotNarrow: 1.2`를 더하고, `modelLayout`의 `const dot = wide ? 2.2 : 1.7;` → `const dot = wide ? MODEL.dotWide : MODEL.dotNarrow;`. `MODEL` 위 주석에 한 줄: `// dotWide/dotNarrow: 관측·잔차 점 지름(넓은 판/좁은 판) — 출발일마다 48개로 늘리며 작게(설계 2026-10-07)`.

`src/charts/filter.ts` `FILTER`에 `dotWide: 1.9, dotNarrow: 1.45`, `const dot = wide ? FILTER.dotWide : FILTER.dotNarrow;`. 같은 형식의 주석 한 줄(표본 8,000).

`src/charts/split.ts` `SPLIT`에 `dotWide: 1.9, dotNarrow: 1.4`, `const dot = wide ? SPLIT.dotWide : SPLIT.dotNarrow;`. 같은 형식의 주석 한 줄(표본 8,000).

- [ ] **Step 4: 전체 단위 테스트**

Run: `npx vitest run`
Expected: 새 파일 통과. 기존 검사가 옛 값(예: `CLOUD.perDate` 30 가정, 점 간격 `SWARM.dot + SWARM.gap`)에 묶여 실패하면, 상수를 참조하도록 고친 검사인지 확인한다 — 검사가 이미 상수를 참조하면 통과해야 한다. 값이 숫자로 박힌 검사만 새 값으로 고친다. 지름 ≥1.6 검사(`inside`)에 걸리면 멈추고 보고한다(파일 구조 앞 "바로잡은 것" 3).

- [ ] **Step 5: 커밋**

```bash
git add src/charts/layouts.ts src/charts/model.ts src/charts/filter.ts src/charts/split.ts tests/unit/charts-density.test.ts
git commit -m "feat(charts): 배경 점 크기 상수화·작게(U자 1.5, 모델 1.55, 걸러내기·검증 1.9, 구름 60점)"
```

(기존 테스트를 고쳤으면 그 파일도 `git add`.)

### Task 4: 표본 데이터 다시 만들기 + 3D 점 수 한도

**Files:**
- Modify: `scripts/export_charts.py:40-52`
- Regenerate: `public/data/charts.2026-09-22.json`
- Modify: `tests/unit/charts-density.test.ts`

- [ ] **Step 1: 실패하는 테스트(점 수 한도·표본 수)**

`tests/unit/charts-density.test.ts` 끝에 더한다(import에 `buildLayout`, `buildPointCloud`·`terrainSchema`·`mapSchema`, `CLOUD` 이미 있음):

```ts
import { buildLayout } from '@/charts/build';
import { buildPointCloud, mapSchema, terrainSchema } from '@/three/data';
```

```ts
describe('표본 수(설계 §3)', () => {
  it('U자 16,000 · 걸러내기·검증 설계 8,000', () => {
    expect(charts.curve.sample.pct).toHaveLength(16_000);
    expect(charts.filter!.pct).toHaveLength(8_000);
    expect(charts.split!.fetch).toHaveLength(8_000);
  });
  it('모델 관측은 출발일마다 최대 48개, 48개인 날이 있다', () => {
    const per = new Map<number, number>();
    for (const d of charts.model!.obs.date) per.set(d, (per.get(d) ?? 0) + 1);
    expect(Math.max(...per.values())).toBe(48);
  });
});

// 3D는 차트 점마다 지형 점 하나를 배정하고 모자라면 남은 점을 버린다(chartTargets.ts assignPoints) — 별·선 점은 표본 뒤에
// 더해지므로 버려지면 결론 층이 사라진다. 세로 화면은 잡음 점을 절반만 만들어(noiseStride 2) 그쪽이 더 작다
describe('3D 점 수 한도(설계 §4)', () => {
  const rd = (f: string) => JSON.parse(readFileSync(`public/data/${f}`, 'utf8'));
  const terrain = terrainSchema.parse(rd(`terrain.${facts.dataVersion}.json`));
  const map = mapSchema.parse(rd('map.v1.json'));
  const pool = buildPointCloud(terrain, map, { noiseStride: 2, seed: 7 }).count;
  const cloud = JSON.parse(readFileSync(`public/data/demo.${facts.dataVersion}.json`, 'utf8'));
  const S = { locale: 'ko' as const, holidays: {} };
  const cases: [string, number, number][] = [['chartCurve', 0, 0], ['chartModel', 0, 0], ['chartFilter', 2, 1], ['chartSplit', 2, 4]];
  for (const size of [WIDE, NARROW]) for (const [key, step, sub] of cases) {
    it(`${key} ${size.w}px: 점 수 ≤ 세로 화면 점 구름`, () => {
      const L = buildLayout(key as never, { charts }, size, S, -1, step, sub);
      expect(L.n).toBeLessThanOrEqual(pool);
    });
  }
  it('구름(⑤ 차트 4)도 한도 안', async () => {
    const { loadCloud } = await import('@/charts/data');
    const cd = await loadCloud(facts.dataVersion, (async () => ({ ok: true, json: async () => cloud })) as never);
    expect(buildLayout('chartCloud', { cloud: cd }, WIDE, S).n).toBeLessThanOrEqual(pool);
  });
});
```

`loadCloud`의 fetcher 모양은 `src/charts/data.ts` `getJson`을 보고 맞춘다(`ok`·`json()`을 쓰는지). `map.v1.json` 이름은 `public/data/`에 있는 파일 그대로.

Run: `npx vitest run tests/unit/charts-density.test.ts`
Expected: 표본 수 검사 FAIL(지금 4,000/12), 점 수 한도는 지금 데이터로 PASS

- [ ] **Step 2: 추출 상수**

`scripts/export_charts.py`:

```python
SAMPLE_SIZE = 16000           # 차트 2 관측 점 개수(고정) — 배경 표본 밀도(설계 2026-10-07): 점을 작게 해 칸 모양이 남는다
```
```python
MODEL_PER_DATE = 48           # 출발일마다 관측 점 개수 — 배경 표본 밀도(설계 2026-10-07, 지금 12에서 4배)
```
```python
FILTER_SAMPLE = 8000          # ② 걸러내기 점 개수(계획 8-1, 설계 2026-10-07에서 두 배) — 실제 비율 그대로라 규칙 ②는 20여 개뿐이다(부풀리지 않는다)
SPLIT_SAMPLE = 8000           # ⑤ 검증 설계 점 개수(설계 2026-10-07에서 두 배)
```

`MODEL_PER_DATE`의 옛 주석 "차트 1의 출발일 뭉치와 같은 12개"는 지운다.

- [ ] **Step 3: 파이썬 테스트**

Run: `sh scripts/py.sh -m pytest scripts/tests -q`
Expected: 통과. 표본 수를 숫자로 박은 검사가 있으면 상수를 참조하도록 고친다.

- [ ] **Step 4: 데이터 다시 만들기**

Run: `npm run charts`
Expected: 마지막 줄에 `표본 16000개, gzip <약 90,000>B` (150KB 넘으면 스크립트가 멈춘다 — 멈추면 보고). 출력의 gzip 값을 기록한다.

그 뒤 `git diff --stat data/facts.json` — **변경 없음**이어야 한다(`refresh_derived`가 쓰는 값은 표본이 아니라 구간 평균·출발일 %). 바뀌었으면 멈추고 diff를 보고한다.

- [ ] **Step 5: 통과 확인**

Run: `npx vitest run`
Expected: 모두 통과(점 수 한도 포함)

- [ ] **Step 6: 커밋**

```bash
git add scripts/export_charts.py public/data/charts.2026-09-22.json tests/unit/charts-density.test.ts
git commit -m "feat(data): 배경 표본 늘림(U자 16,000, 모델 출발일당 48, 걸러내기·검증 8,000) + 3D 점 수 한도 검사"
```

(파이썬 테스트를 고쳤으면 그 파일도.)

### Task 5: e2e — TSS 반복

**Files:**
- Modify: `tests/e2e/charts.spec.ts` (파일 끝, "③ 모델 구조 저절로 넘김" describe 뒤)

- [ ] **Step 1: 검사 추가**

```ts
test.describe('⑤ 검증 설계 TSS 반복(설계 2026-10-07 §5)', () => {
  test.use({ reducedMotion: 'no-preference' });
  test('폴드 5에 닿은 뒤 다시 폴드 1로 돌아온다', async ({ page }) => {
    await page.goto('/');
    const block = page.locator('.chart-block[data-scene="chartSplit"]');
    await block.evaluate((el) => { const r = el.getBoundingClientRect(); window.scrollTo(0, window.scrollY + r.top + (r.height - window.innerHeight) * 0.8); });
    const stage = block.locator('.chart-stage');
    await expect(stage).toHaveAttribute('data-stage', '2', { timeout: 10_000 });
    // 1.2초 × 4 = 4.8초에 폴드 5, 2.4초 머문 뒤 폴드 1
    await expect(stage).toHaveAttribute('data-sub', '4', { timeout: 8_000 });
    await expect(stage).toHaveAttribute('data-sub', '0', { timeout: 5_000 });
    await expect(stage).toHaveAttribute('data-sub', '1', { timeout: 3_000 });
  });
});
```

움직임 줄이기 쪽 기존 검사("TSS는 바로 FOLD 5 / 5")는 그대로 둔다 — 반복하지 않는다는 검사가 된다.

- [ ] **Step 2: 실행**

Run: `npx playwright test tests/e2e/charts.spec.ts -g "TSS 반복" --project=desktop`
Expected: 1 passed. (무거운 브라우저 테스트는 한 번에 하나 — `testing` 규칙)

- [ ] **Step 3: 커밋**

```bash
git add tests/e2e/charts.spec.ts
git commit -m "test(e2e): ⑤ TSS 폴드 반복"
```

### Task 6: 전체 검사 + 눈 확인 + 문서

**Files:**
- Modify: `docs/superpowers/specs/2026-10-07-dot-density-design.md` ("구현 결과")
- Modify: `CLAUDE.md` ("현재 상태"·"다음 할 일")
- Modify: `.claude/rules/visual-system.md` (점 컨셉 절에 밀도 한 줄, 페이지 구성 5번 TSS 반복)

- [ ] **Step 1: 전체 검사**

Run: `npx tsc --noEmit && npx vitest run && npm run build && npm run size`
Expected: 모두 통과, 초기 JS gzip ≤150KB(데이터는 따로 받으므로 변화 거의 없음)

Run: `npx playwright test tests/e2e/charts.spec.ts --project=desktop` 그다음 `--project=mobile`
Expected: 통과. 실패하면 점 개수·크기를 숫자로 가정한 검사인지 보고 상수 참조로 고친다

- [ ] **Step 2: 눈 확인(컨트롤러가 직접)**

빌드 결과를 로컬로 띄우고(`npx serve out -l 4199`) 1440×900·1024×768·390×844에서 ④ U자·③ 모델(3단계)·⑤ 구름·② 걸러내기·⑤ 검증 설계를 캡처한다 — 움직임 줄이기(2D)와 기본(3D 켜짐) 둘 다. 볼 것:
- 결론 층(별·선·기준 가격 선·이름표)이 배경보다 먼저 보이는가
- 3D에서 배경이 너무 밝아 결론 층을 가리지 않는가 — 그러면 그 차트의 배경 알파만 낮춘다(`SWARM.sampleA`·모델 관측 알파·`FILTER.keptA`·`SPLIT.trainA`·`CLOUD.coreA/outerA`), 바꾼 값은 "구현 결과"에 적는다
- 휴대폰 390에서 점이 너무 작아 사라지지 않는가
- TSS가 반복되는가(3D 켜짐에서 호박색만 옮겨 가는지)

- [ ] **Step 3: 문서**

설계서 "구현 결과"에: 실제 gzip 값, 3D·2D 눈 확인 결과, 바꾼 알파(있으면), 고친 기존 테스트.

`.claude/rules/visual-system.md`:
- "점 컨셉" 절 끝에: `- **배경 표본 밀도(2026-10-07)**: U자 표본 16,000·점 1.5, 모델 관측 출발일당 48·1.55, 구름 출발일당 60, 걸러내기·검증 설계 8,000·1.9 — 표본을 늘리면 점을 작게 해 칸·띠 모양이 남게. 3D 점 수는 세로 화면 점 구름(약 15,900) 아래(단위 테스트)`
- 페이지 구성 5번의 "TSS는 폴드가 1.2초마다 저절로" → "TSS는 폴드가 1.2초마다 저절로, 마지막에서 2.4초 머문 뒤 반복"

`CLAUDE.md` "현재 상태"에 한 줄(브랜치·PR 번호는 PR을 연 뒤), "다음 할 일" 1번의 점 가독성 항목을 이번 작업 결과로 바꾼다.

- [ ] **Step 4: 커밋**

```bash
git add docs/superpowers/specs/2026-10-07-dot-density-design.md CLAUDE.md .claude/rules/visual-system.md
git commit -m "docs: 배경 표본 밀도·TSS 반복 구현 결과"
```

그 뒤 `ship-pr` 스킬로 PR → CI → Vercel 미리보기 링크와 함께 사용자 확인.
