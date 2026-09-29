# 계획 6-4: 지도 가는 실선 + 출발일 점 그래프 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ② 한·일 지도를 같은 간격의 작은 점으로 된 가는 실선(해안선·노선)으로 바꾸고, ④ 차트 1(출발일)을 달력에서 "시간 흐름 점 그래프 + 요일 평균"으로 바꾼다.

**Architecture:** 지도는 점 구름을 만들 때(`src/three/data.ts buildPointCloud`) 해안선을 세계 좌표에서 같은 간격으로 다시 뽑아 앞쪽 점부터 해안선 → 노선 순서로 배정하고, 남는 점은 기존 `aRoute` 속성을 −1로 두어 셰이더가 지도 장면에서 숨긴다(정점 속성 한계 때문에 새 속성 없음). 지도 장면의 알파·크기·모이기는 종류와 상관없이 고르게(상수는 `pointStyle.ts`). 차트 1은 순수 배치 함수 `departLayout`(`src/charts/layouts.ts`)이 점·이름표를 만들고, 2D 대체 그림과 3D 점이 그대로 같이 쓴다(지금 구조). 이름표 공휴일은 `charts.json`의 `labels`(추출 스크립트)를 4개로 늘린다.

**Tech Stack:** Next.js 정적 export · three.js 셰이더 · Vitest · Playwright · Python(추출 스크립트, 항공권 저장소)

**설계:** `docs/superpowers/specs/2026-09-29-map-and-depart-chart-design.md` · 시안 `docs/superpowers/mockups/2026-09-29-map-calendar/map-calendar.html`(지도 C, 차트 3)

## 모든 작업 공통 규칙

- 브랜치 `plan-6-4-map-calendar`(이미 있음). main에 직접 커밋하지 않는다.
- **코드 주석은 한국어**(새 파일 맨 위 한두 줄, 이유가 드러나지 않는 로직에 "왜"). **GLSL 템플릿 문자열 안에는 주석을 넣지 않는다** — `shaders.ts`의 `export const vertexShader` 위 JS 주석 묶음에 적는다.
- 커밋 이메일은 저장소 설정 그대로, 메시지 끝에 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- e2e는 `out/`을 띄워 돈다 — e2e 전에 `npm run build`. 초기 JS ≤ 150KB, 3D 청크 ≤ 250KB(지금 244.6KB).
- 문구에 숫자를 직접 쓰지 않는다(`tests/unit`이 3개 언어를 검사). 세 언어 키가 같아야 한다.
- 3D 눈 확인은 헤드리스 swiftshader가 몇 초 뒤 3D를 끄므로, 헤드 있는 크로미움을 화면 밖에 띄워(`chromium.launch({ headless: false, args: ['--window-position=-2400,0'] })`) 실제 GPU로 본다. 임시 스크립트는 세션 스크래치 폴더에 두고 `NODE_PATH="$PWD/node_modules" node …`로 돌린다(커밋하지 않음).

## 파일 지도

| 파일 | 할 일 |
|---|---|
| `src/three/data.ts` | 해안선 다시 뽑기·노선 호·지도 배정(`aRoute` −1/0/1) |
| `tests/unit/three-data.test.ts` | 위 테스트 |
| `src/three/pointStyle.ts` · `tests/unit/point-style.test.ts` | 지도 점 알파·크기 상수 `MAP_POINT` |
| `src/three/shaders.ts` | 지도 장면: 안 쓰는 점 숨김, 고른 알파·크기, 끝까지 모이기, 노선 색 |
| `src/charts/layouts.ts` · `tests/unit/charts-layouts.test.ts` | `departLayout`(새) — `calendarLayout`·`CALENDAR` 대신 |
| `src/charts/build.ts` | 차트 1 배치를 `departLayout`으로, 문자열 |
| `src/components/sections/Charts.tsx` | 차트 1 블록에 `axis`·요일 평균 제목 문자열 |
| `content/{ko,en,ja}.json` | `charts.depart.axis`·`weekdays`·`body1`·`alt` 고침, 4번째 공휴일 이름 |
| `scripts/export_charts.py` · `public/data/charts.2026-09-22.json` | `TOP_LABELS` 3 → 4, 다시 추출 |
| `tests/e2e/charts.spec.ts` | 차트 1 이름표 개수 |
| `public/fallback/problem.webp` | 다시 캡처 |
| 설계 문서 · `CLAUDE.md` | 구현 결과 |

---

### Task 1: 지도 배정 — 같은 간격 해안선·노선, 안 쓰는 점 표시

**Files:** Modify `src/three/data.ts`, Test `tests/unit/three-data.test.ts`

지금(`buildPointCloud`): 모든 점이 지도 자리를 받는다 — 5개 중 1개는 노선의 임의 샘플, 나머지는 해안선 샘플(황금비 인덱스) + ±0.03 흔들기. `out.route[i]`는 0/1.
바꾼 뒤: 해안선을 세계 좌표 간격 `MAP_LINE.step`(0.035)으로 다시 뽑은 점 목록 C, 노선마다 `MAP_LINE.routePts`(170)개 호 점 목록 R을 만들고, **점 구름 앞쪽부터** C → R 순서로 자리를 준다. 나머지 점은 지도 자리를 자기 지형 자리로 두고 `route = −1`(지도에서 안 씀). 흔들기 없음.

- [ ] **Step 1: 실패하는 테스트** — `tests/unit/three-data.test.ts`에 추가(파일의 기존 `terrain`·`map` 픽스처와 import를 쓴다; `resampleLines`·`MAP_LINE`을 import에 더한다):

```ts
describe('지도 가는 실선(계획 6-4)', () => {
  it('resampleLines: 0.5도 넘게 떨어진 점 사이는 이어 긋지 않고, 세계 좌표에서 같은 간격', () => {
    // 경도 0.1도 간격 두 점 + 멀리 떨어진 한 점(새 선)
    const pts = resampleLines([13000, 3800, 13010, 3800, 14000, 3800], 0.01);
    const gaps: number[] = [];
    for (let i = 1; i < pts.length; i++) gaps.push(Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    expect(pts.length).toBeGreaterThan(3);
    for (const g of gaps) expect(g).toBeLessThan(0.0101); // 첫 선 안에서는 간격 ≤ step, 두 선 사이 점프가 없다(두 번째 선은 점 하나라 뽑을 선분 없음)
  });
  // 픽스처 map의 해안선 두 점은 0.5도보다 멀어 새 규칙에서는 선이 끊긴다 — 가까운 점 세 개로 된 해안선을 따로 쓴다
  const lineMap: MapData = { ...map, coast: [13000, 3800, 13010, 3800, 13020, 3800] };
  it('앞쪽 점부터 해안선 → 노선, 나머지는 route = −1(지도에서 안 씀)이고 지도 자리 = 지형 자리', () => {
    const pc = buildPointCloud(terrain, lineMap, { noiseStride: 1 });
    const r = Array.from(pc.route);
    const firstRoute = r.indexOf(1), firstUnused = r.indexOf(-1);
    expect(r[0]).toBe(0);
    expect(firstRoute).toBeGreaterThan(0);
    if (firstUnused >= 0) {
      expect(firstUnused).toBeGreaterThan(firstRoute);
      for (let i = firstUnused; i < pc.count; i++) {
        expect(r[i]).toBe(-1);
        expect([pc.map[i * 3], pc.map[i * 3 + 1], pc.map[i * 3 + 2]]).toEqual([pc.terrain[i * 3], pc.terrain[i * 3 + 1], pc.terrain[i * 3 + 2]]);
      }
    }
  });
  it('해안선 점은 높이 0, 노선 점은 가운데가 가장 높다(호)', () => {
    const pc = buildPointCloud(terrain, lineMap, { noiseStride: 1 });
    const ys = (v: number) => Array.from(pc.route).map((x, i) => [x, pc.map[i * 3 + 1]] as const).filter(([x]) => x === v).map(([, y]) => y);
    expect(ys(0).every((y) => y === 0)).toBe(true);
    const ry = ys(1);
    expect(Math.max(...ry)).toBeGreaterThan(ry[0]);
  });
});
```

기존 테스트 중 "황금비로 해안선 전체를 덮는다"(계획 3 결함 A, `bigMap` 사용)는 새 방식에서 뜻이 바뀐다 — 그 테스트를 "해안선 점이 다시 뽑은 해안선 전체(처음·끝 가까이)를 덮는다"로 고친다: `bigMap`에서 route 0인 점들의 x 범위가 다시 뽑은 선의 x 범위와 거의 같은지(양 끝 오차 ≤ step). 픽스처 점 수가 적어(`terrain` 픽스처) 해안선 점이 모자라면 앞쪽부터 채울 만큼만 채우는 것이 맞다 — 그 경우 `route −1`이 없을 수 있어 두 번째 테스트는 `if`로 감싸 두었다.

- [ ] **Step 2: 실패 확인** — `npx vitest run tests/unit/three-data.test.ts` → 새 테스트 FAIL(`resampleLines` 없음).

- [ ] **Step 3: 구현** — `src/three/data.ts`:
  - `ROUTE_SHARE`·`GOLDEN_RATIO`(지도 배정에만 쓰였다면) 지우고, 상수 추가:

```ts
// 지도 가는 실선(설계 2026-09-29 §1): 해안선을 세계 좌표 step 간격으로 다시 뽑고(약 2,800점), 노선마다 routePts개 호.
// 흔들지 않는다 — 점 수가 해안선 샘플보다 많아 흔들어 겹겹이 쌓던 것이 굵고 흐릿한 띠로 보였다(사용자 지적 2026-09-29)
export const MAP_LINE = { step: 0.035, routePts: 170, breakDeg: 0.5 } as const;
```

  - 함수 추가(export — 테스트용):

```ts
// 평평한 [경도×100, 위도×100, …] 목록 → 이어진 선분끼리 나눠(점 사이가 breakDeg보다 멀면 새 선 — 섬·대륙이 선으로
// 이어지지 않게) 세계 좌표(x, z)에서 step 간격으로 다시 뽑은 점들
export function resampleLines(flat: number[], step: number): [number, number][] {
  const pts = pairs(flat);
  const out: [number, number][] = [];
  let carry = 0;
  for (let i = 0; i + 1 < pts.length; i++) {
    const [a, b] = [pts[i], pts[i + 1]];
    if (Math.hypot(a[0] - b[0], a[1] - b[1]) > MAP_LINE.breakDeg) { carry = 0; continue; }
    const [ax, az] = mapPosition(a[0], a[1]), [bx, bz] = mapPosition(b[0], b[1]);
    const len = Math.hypot(bx - ax, bz - az);
    let t = carry;
    for (; t < len; t += step) out.push([round(ax + ((bx - ax) * t) / len), round(az + ((bz - az) * t) / len)]);
    carry = t - len;
  }
  return out;
}
```

  (주의: 테스트의 `gaps` 기대는 `step` 이하 — 선분 경계를 넘을 때 `carry`로 간격을 이어 가므로 같은 선 안에서는 간격이 `step`에 가깝다. 꺾이는 곳은 직선 거리가 조금 짧을 수 있다 — 그래서 "이하".)

  - `buildPointCloud`의 지도 부분을 바꾼다: 반복 전에

```ts
  const coastPts = resampleLines(m.coast, MAP_LINE.step);
  const routePts: [number, number, number][] = [];
  for (const r of m.routes) {
    const line = pairs(r.pts);
    for (let k = 0; k < MAP_LINE.routePts; k++) {
      const f = k / (MAP_LINE.routePts - 1);
      const [lon, lat] = line[Math.min(line.length - 1, Math.round(f * (line.length - 1)))];
      const [x, zz] = mapPosition(lon, lat);
      routePts.push([x, round(Math.sin(f * Math.PI) * ROUTE_ARC_HEIGHT), zz]);
    }
  }
```

  반복 안의 지도 코드(노선/해안선 `if … else`, `jitter`)를 다음으로:

```ts
    // 지도 자리: 앞쪽 점부터 해안선 → 노선. 남는 점은 지도 장면에서 숨긴다(route −1, 자리는 지형 그대로 — 셰이더가
    // 알파 0으로). 신호·잡음을 가리지 않는다 — 지도에서는 모든 점을 같은 밝기로 그린다(pointStyle MAP_POINT)
    if (i < coastPts.length) {
      out.map.set([coastPts[i][0], 0, coastPts[i][1]], i * 3);
    } else if (i < coastPts.length + routePts.length) {
      out.map.set(routePts[i - coastPts.length], i * 3);
      out.route[i] = 1;
    } else {
      out.map.set(out.terrain.subarray(i * 3, i * 3 + 3), i * 3);
      out.route[i] = -1;
    }
```

  (`rand`는 흩어짐 좌표에 계속 쓰인다 — 지우지 않는다. `jitter`만 지운다. 흩어짐 좌표의 난수 소비 순서가 바뀌어 캡처 이미지가 달라지는 것은 괜찮다 — Task 5에서 다시 캡처한다.)
  - `PointCloud.route` 주석을 "1 노선, 0 해안선, −1 지도에서 안 씀"으로.

- [ ] **Step 4: 통과 확인** — `npx vitest run tests/unit/three-data.test.ts`, `npm run typecheck && npm test`.

- [ ] **Step 5: 커밋**

```bash
git add src/three/data.ts tests/unit/three-data.test.ts
git commit -m "feat(3d): map targets — evenly resampled coastline and route arcs, spare points marked unused

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: 셰이더 — 지도 장면을 가는 실선으로

**Files:** Modify `src/three/pointStyle.ts`, `tests/unit/point-style.test.ts`, `src/three/shaders.ts`

- [ ] **Step 1: 상수** — `src/three/pointStyle.ts`에 추가(+ `point-style.test.ts`에 값 고정 테스트 한 개: `expect(MAP_POINT).toEqual({ coastAlpha: 0.8, routeAlpha: 0.9, size: 0.55 })`):

```ts
// 지도 장면(설계 2026-09-29 §1): 종류(신호·잡음)와 상관없이 같은 알파·크기 — 선 굵기가 고르게. size는 지형 크기 배율
export const MAP_POINT = { coastAlpha: 0.8, routeAlpha: 0.9, size: 0.55 } as const;
```

- [ ] **Step 2: 정점 셰이더** — `shaders.ts` import에 `MAP_POINT`를 더하고(`./pointStyle`), 템플릿에서:
  1. `float gather = aKind > 0.5 && aKind < 1.5 ? uAssemble * 0.9 : uAssemble;` →
     `float gather = mix(aKind > 0.5 && aKind < 1.5 ? uAssemble * 0.9 : uAssemble, uAssemble, uMap);`
  2. `float size = …;` 줄 다음에 `size = mix(size, ${f(MAP_POINT.size)}, uMap);`
  3. `float a = …;` 줄 다음에:
     ```glsl
    float onMap = step(-0.5, aRoute);
    a = mix(a, onMap * mix(${f(MAP_POINT.coastAlpha)}, ${f(MAP_POINT.routeAlpha)}, max(aRoute, 0.0)), uMap);
     ```
  4. `terrainCol`의 `aRoute * uMap` → `max(aRoute, 0.0) * uMap`.
  (변수 이름 `onMap`이 겹치지 않는지 확인. 제거 레이어(kind 2)는 지도에서 `aRoute`가 −1이 아니면 해안선으로 그려질 수 있다 — Task 1 배정이 점 구름 앞쪽부터라 제거 레이어(맨 뒤)는 대개 −1이다. 눈 확인에서 본다.)
- [ ] **Step 3: 설명 주석** — `export const vertexShader` 위 JS 주석 묶음에 추가:

```ts
// 지도 장면(설계 2026-09-29 §1, 계획 6-4): aRoute = 1 노선, 0 해안선, −1 지도에 안 쓰는 점(알파 0으로 숨김 — 새 속성을
// 더하지 않으려고 기존 aRoute에 담았다, 정점 속성 16개 한계). 지도에서는 종류와 상관없이 같은 알파·크기(MAP_POINT)로
// 그리고, 잡음 점도 끝까지 모인다 — 덜 모인 잡음 점이 해안선 둘레에 뿌옇게 남았었다
```

- [ ] **Step 4: 검사·눈 확인** — `npm run typecheck && npm test && npm run build && npm run size`(3D ≤ 250KB). 헤드 있는 크로미움(1280×720, 390×844)으로 ② 화면 1(`.data-intro`로 스크롤)·화면 2(`.data-board`)를 찍고 시안 C와 비교: 해안선이 고른 점선/가는 선, 둘레의 뿌연 점 없음, 노선 3개가 가는 호, 공항 자리. ① → ② 전환 도중 한 장(안 쓰는 점이 사라지며 옮겨 감). 너무 가늘거나 흐리면 `MAP_POINT`·`MAP_LINE.step`만 조정하고 값·이유를 보고.
- [ ] **Step 5: 커밋**

```bash
git add src/three/pointStyle.ts tests/unit/point-style.test.ts src/three/shaders.ts
git commit -m "feat(3d): thin-line map — uniform alpha and size, spare points hidden, noise fully gathered

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: 차트 1 배치 — 시간 흐름 점 그래프 + 요일 평균

**Files:** Modify `src/charts/layouts.ts`, `tests/unit/charts-layouts.test.ts`, `src/charts/build.ts`, `src/components/sections/Charts.tsx`, `content/{ko,en,ja}.json`

배치(판 크기 w×h px, 정규화 좌표로 돌려준다 — 기존 배치 함수들과 같은 형식):
- 넓은 판(`w ≥ DEPART.wideMinPx` 560): 점 그래프 영역 x ∈ [0.06w, 0.74w], 요일 평균 영역 x ∈ [0.78w, w]. 좁은 판: 점 그래프 x ∈ [0.1w, w], y ∈ [0, 0.68h]; 요일 평균 y ∈ [0.74h, h] 한 줄 7칸.
- 점 그래프: 가로 = 날짜(첫 출발일 ~ 마지막, 실제 날짜 비례), 세로 = % (범위 `DEPART.lo` −30 ~ `DEPART.hi` 75, 밖은 끝에 붙인다). 위·아래 여백은 영역 높이의 0.08·0.14(아래는 월 이름 자리).
- 출발일 하나 = 점 `DEPART.perDate`(12)개 해바라기 배치(반지름 넓은 판 4px, 좁은 판 2.4px), 점 지름 1.8px, 알파 0.8, `group` = 출발일 번호. 색: `holiday[i] && pct ≥ DEPART.hotPct(25)`면 호박색, 아니면 파랑.
- 0% 기준선: 점 그래프 영역 폭을 따라 6px 간격 점(지름 1.6, 알파 0.28, 글자색 TONE.text).
- 이름표(text): 눈금 +50·+25·0·−25 (`tick`, 영역 왼쪽, `align: 'end'`), 월 이름(`month`, 아래, 달이 바뀌는 첫 출발일 x, 가운데), 세로축 이름(`axis`, 영역 왼쪽 위 — 문자열 `s.axis`), 공휴일 이름(`holiday`, `labels`마다 그 출발일 뭉치 바로 위 = 뭉치 y − 반지름 − 10px, 가운데).
- 요일 평균: 출발일을 요일(월=0 … 일=6, UTC)로 묶은 평균 %. 넓은 판 — 7줄, 줄마다 0을 가운데 둔 가로 점 줄(0에서 평균까지 3px 간격 점, 지름 2.2, 알파 0.85, 평균 > `DEPART.hotWeekday`(15)면 호박색), 요일 이름(`tick`, 줄 왼쪽, `end`), 값(`tick`, 줄 끝 바깥, 부호 문자열 `s.pct`), 제목(`axis`, 위 — `s.weekdayTitle`). 가로 범위 −25 ~ +25(밖은 끝). 0 세로선: 영역 가운데 세로로 4px 간격 점(알파 0.28). 좁은 판 — 7칸 가로로, 칸마다 요일 이름(아래), 값(위), 평균 위치에 점 뭉치 하나(5점) — 세로 범위 −25 ~ +25, 0 가로선.

- [ ] **Step 1: 실패하는 테스트** — `tests/unit/charts-layouts.test.ts`의 `calendarLayout` describe를 지우고 import의 `calendarLayout` → `departLayout, DEPART`로, 픽스처 `charts`는 그대로 쓰되 다음 describe를 넣는다(`calS`는 새 문자열로):

```ts
const depS = { month: (iso: string) => `m${iso.slice(5, 7)}`, weekday: (i: number) => `w${i}`, holiday: (c: string) => `h:${c}`, pct: (v: number) => `${v}%`, axis: 'AX', weekdayTitle: 'WT' };

describe('departLayout', () => {
  const L = departLayout(charts, { w: 1080, h: 414 }, depS);
  const dateIdx = Array.from(L.group).filter((g) => g >= 0);
  const PER = DEPART.perDate;
  const centerOf = (d: number) => {
    let x = 0, y = 0, n = 0;
    for (let i = 0; i < L.n; i++) if (L.group[i] === d) { x += L.x[i]; y += L.y[i]; n++; }
    return [x / n, y / n, n] as const;
  };
  it('출발일마다 perDate개 점, group = 출발일 번호', () => {
    for (let d = 0; d < dates.length; d++) expect(centerOf(d)[2]).toBe(PER);
    expect(dateIdx.length).toBe(dates.length * PER);
  });
  it('가로는 날짜 순서, 세로는 비쌀수록 위', () => {
    expect(centerOf(1)[0]).toBeGreaterThan(centerOf(0)[0]);
    expect(centerOf(13)[1]).toBeLessThan(centerOf(0)[1]); // 픽스처 pct는 번호가 클수록 크다
  });
  it('호박색 = 공휴일이면서 +25% 이상', () => {
    for (let i = 0; i < L.n; i++) if (L.group[i] >= 0) {
      const d = L.group[i];
      expect(L.tone[i] === TONE.amber).toBe(charts.depart.holiday[d] !== null && charts.depart.pct[d] / 10 >= DEPART.hotPct);
    }
  });
  it('공휴일 이름표는 그 출발일 뭉치 바로 위', () => {
    const h = L.labels.filter((l): l is Extract<ChartLabel, { type: 'text' }> => l.type === 'text' && l.cls === 'holiday');
    expect(h.map((l) => l.text)).toEqual(['h:kr_hangul_day']);
    const [cx, cy] = centerOf(9);
    expect(Math.abs(h[0].x - cx)).toBeLessThan(0.01);
    expect(h[0].y).toBeLessThan(cy);
    expect((cy - h[0].y) * 414).toBeLessThan(30);
  });
  it('요일 평균: 이름 7개와 값 7개, 제목·세로축 이름', () => {
    const t = L.labels.filter((l): l is Extract<ChartLabel, { type: 'text' }> => l.type === 'text');
    for (let k = 0; k < 7; k++) expect(t.some((l) => l.text === `w${k}`)).toBe(true);
    expect(t.some((l) => l.text === 'WT')).toBe(true);
    expect(t.some((l) => l.text === 'AX')).toBe(true);
    expect(t.filter((l) => l.cls === 'month').length).toBeGreaterThan(0);
  });
  it('와플 번호는 모두 −1', () => expect(Array.from(L.waffle).every((v) => v === -1)).toBe(true));
  it('판 안, 지름 1.6px 이상(넓은 판·좁은 판)', () => { inside(L); inside(departLayout(charts, { w: 340, h: 380 }, depS)); });
});
```

  (`ChartLabel` import가 없으면 더한다. 픽스처 `dates`는 파일 위쪽에 이미 있다 — 요일이 7개 모두 나오지 않으면 요일 평균 이름 검사는 "데이터가 있는 요일만"이 아니라 7개 모두 이름을 둔다는 규칙이므로 그대로 통과해야 한다: 데이터 없는 요일은 값 없이 이름만(값 이름표 생략), 점 없음.)

- [ ] **Step 2: 실패 확인** — `npx vitest run tests/unit/charts-layouts.test.ts` → FAIL.

- [ ] **Step 3: 구현** — `src/charts/layouts.ts`에서 `CALENDAR`·`calendarLayout`을 지우고 다음을 넣는다(`Pts`, `clamp01`, `utc`, `DAY`, `GOLDEN_ANGLE` 재사용):

```ts
// ④ 차트 1 출발일(설계 2026-09-29 §2, 시안 3): 시간 흐름 점 그래프 + 요일 평균. 가로 = 출발일(실제 날짜 비례), 세로 = 노선·등급
// 평균 대비 %. 출발일 하나 = 점 뭉치 하나(3D에서는 그 출발일의 배경 점이 모인다, group). 막대·줄기 선은 쓰지 않는다 —
// 점을 쌓은 막대는 사용자가 "별로"(2026-09-25), 줄기 선은 시안에서 지저분했다. 호박색은 공휴일 무렵이면서 +25% 이상인
// 날만 — 공휴일 ±3일을 모두 칠하면 강조가 흐려졌다(사용자 지적 2026-09-29). 오른쪽(휴대폰은 아래)은 요일 평균
export const DEPART = { perDate: 12, wideMinPx: 560, lo: -30, hi: 75, hotPct: 25, hotWeekday: 15, weekLo: -25, weekHi: 25 } as const;

export function departLayout(
  d: ChartsData, size: PlotSize,
  s: { month(iso: string): string; weekday(i: number): string; holiday(code: string): string; pct(v: number): string; axis: string; weekdayTitle: string },
): ChartLayout {
  const wide = size.w >= DEPART.wideMinPx;
  const W = size.w, H = size.h;
  // 점 그래프 영역(px)
  const gx0 = W * (wide ? 0.06 : 0.1), gx1 = W * (wide ? 0.74 : 1), gy0 = 0, gy1 = H * (wide ? 1 : 0.68);
  const top = gy0 + (gy1 - gy0) * 0.08, bottom = gy1 - (gy1 - gy0) * 0.14;
  const t0 = utc(d.dates[0]), t1 = utc(d.dates[d.dates.length - 1]);
  const X = (iso: string) => gx0 + (gx1 - gx0 - 8) * ((utc(iso) - t0) / Math.max(1, t1 - t0)) + 4;
  const Y = (v: number) => top + (bottom - top) * (1 - (Math.min(DEPART.hi, Math.max(DEPART.lo, v)) - DEPART.lo) / (DEPART.hi - DEPART.lo));
  const r = wide ? 4 : 2.4;
  const p = new Pts();
  const labels: ChartLabel[] = [];
  // 0% 기준선
  for (let x = gx0; x <= gx1; x += 6) p.add(x / W, Y(0) / H, 1.6, 0.28, TONE.text);
  d.dates.forEach((iso, i) => {
    const v = d.depart.pct[i] / 10;
    const hot = d.depart.holiday[i] !== null && v >= DEPART.hotPct;
    const cx = X(iso), cy = Y(v);
    for (let k = 0; k < DEPART.perDate; k++) {
      const rho = r * Math.sqrt((k + 0.5) / DEPART.perDate), th = k * GOLDEN_ANGLE;
      p.add((cx + rho * Math.cos(th)) / W, (cy + rho * Math.sin(th)) / H, 1.8, 0.8, hot ? TONE.amber : TONE.dot, i);
    }
  });
  for (const v of [50, 25, 0, -25]) labels.push({ type: 'text', x: (gx0 - 6) / W, y: Y(v) / H, text: s.pct(v), align: 'end', cls: 'tick' });
  labels.push({ type: 'text', x: gx0 / W, y: (top * 0.35) / H, text: s.axis, align: 'start', cls: 'axis' });
  let lastMonth = '';
  d.dates.forEach((iso) => {
    if (iso.slice(0, 7) === lastMonth) return;
    lastMonth = iso.slice(0, 7);
    labels.push({ type: 'text', x: X(iso) / W, y: (bottom + (gy1 - bottom) * 0.6) / H, text: s.month(iso), align: 'center', cls: 'month' });
  });
  d.labels.forEach((l) => {
    const i = d.dates.indexOf(l.date);
    if (i < 0) return;
    labels.push({ type: 'text', x: X(l.date) / W, y: (Y(d.depart.pct[i] / 10) - r - 10) / H, text: s.holiday(l.code), align: 'center', cls: 'holiday' });
  });

  // 요일 평균(월=0 … 일=6)
  const sum = Array(7).fill(0), cnt = Array(7).fill(0);
  d.dates.forEach((iso, i) => { const k = (new Date(utc(iso)).getUTCDay() + 6) % 7; sum[k] += d.depart.pct[i] / 10; cnt[k]++; });
  const avg = sum.map((v, k) => (cnt[k] ? v / cnt[k] : null));
  const clampW = (v: number) => Math.min(DEPART.weekHi, Math.max(DEPART.weekLo, v));
  if (wide) {
    const sx0 = W * 0.78 + 24, sx1 = W - 44, sy0 = H * 0.12, sy1 = H * 0.9;
    const SX = (v: number) => sx0 + (sx1 - sx0) * ((clampW(v) - DEPART.weekLo) / (DEPART.weekHi - DEPART.weekLo));
    const rowH = (sy1 - sy0) / 7;
    labels.push({ type: 'text', x: (W * 0.78) / W, y: (sy0 * 0.45) / H, text: s.weekdayTitle, align: 'start', cls: 'axis' });
    for (let y = sy0; y <= sy1; y += 4) p.add(SX(0) / W, y / H, 1.6, 0.28, TONE.text);
    avg.forEach((a, k) => {
      const y = sy0 + rowH * (k + 0.5);
      labels.push({ type: 'text', x: (sx0 - 8) / W, y: y / H, text: s.weekday(k), align: 'end', cls: 'tick' });
      if (a === null) return;
      const tone = a > DEPART.hotWeekday ? TONE.amber : TONE.dot;
      const x0 = SX(0), x1 = SX(a), n = Math.max(1, Math.round(Math.abs(x1 - x0) / 3));
      for (let j = 1; j <= n; j++) p.add((x0 + ((x1 - x0) * j) / n) / W, y / H, 2.2, 0.85, tone);
      labels.push({ type: 'text', x: (x1 + (a >= 0 ? 6 : -6)) / W, y: y / H, text: s.pct(Math.round(a)), align: a >= 0 ? 'start' : 'end', cls: 'tick' });
    });
  } else {
    const sy0 = H * 0.74, sy1 = H * 0.96, colW = (W * 0.9) / 7, sx0 = W * 0.1;
    const SY = (v: number) => sy0 + 14 + (sy1 - sy0 - 28) * (1 - (clampW(v) - DEPART.weekLo) / (DEPART.weekHi - DEPART.weekLo));
    labels.push({ type: 'text', x: 0, y: (sy0 - 4) / H, text: s.weekdayTitle, align: 'start', cls: 'axis' });
    for (let x = sx0; x <= W; x += 5) p.add(x / W, SY(0) / H, 1.6, 0.28, TONE.text);
    avg.forEach((a, k) => {
      const cx = sx0 + colW * (k + 0.5);
      labels.push({ type: 'text', x: cx / W, y: sy1 / H, text: s.weekday(k), align: 'center', cls: 'tick' });
      if (a === null) return;
      const tone = a > DEPART.hotWeekday ? TONE.amber : TONE.dot;
      for (let j = 0; j < 5; j++) { const rho = 2.4 * Math.sqrt((j + 0.5) / 5), th = j * GOLDEN_ANGLE; p.add((cx + rho * Math.cos(th)) / W, (SY(a) + rho * Math.sin(th)) / H, 1.8, 0.9, tone); }
      labels.push({ type: 'text', x: cx / W, y: (SY(a) - 10) / H, text: s.pct(Math.round(a)), align: 'center', cls: 'tick' });
    });
  }
  return p.done(labels);
}
```

  (좌표가 판 밖(0..1)으로 나가면 테스트가 잡는다 — 나가면 여백 숫자만 조정. 기존 이름표 CSS(`.chart-label.tick/.axis/.month/.holiday`)를 그대로 쓴다.)

- [ ] **Step 4: 연결** — `src/charts/build.ts`: import의 `calendarLayout` → `departLayout`, `ChartStrings`에 `weekdayTitle?: string` 추가, `case 'chartDepart'`를:

```ts
    case 'chartDepart': {
      const wd = new Intl.DateTimeFormat(s.locale, { weekday: 'short', timeZone: 'UTC' });
      const mo = new Intl.DateTimeFormat(s.locale, { month: 'short', timeZone: 'UTC' });
      return departLayout(loaded.charts!, size, {
        weekday: (i) => wd.format(new Date(MONDAY + i * 86_400_000)),
        month: (iso) => mo.format(new Date(`${iso}T00:00:00Z`)),
        holiday, pct: signed, axis: s.axis ?? '', weekdayTitle: s.weekdayTitle ?? '',
      });
    }
```

  `src/components/sections/Charts.tsx`: `BLOCKS`의 depart 항목에 `axis: true`를 더하고, `strings`에 `weekdayTitle: b.id === 'depart' ? t('charts.depart.weekdays') : undefined`를 더한다.
  `content/{ko,en,ja}.json`의 `charts.depart`에 키 추가: `axis` — ko "평균 대비" / en "vs. average" / ja "平均比", `weekdays` — ko "요일 평균" / en "By weekday" / ja "曜日平均". 그리고 `body1`·`alt`를 새 그림에 맞게(숫자 없이):
  - ko body1: "가격을 더 크게 흔드는 것은 언제 사느냐보다 언제 떠나느냐였습니다. 점 하나가 출발일 하나이고, 위로 갈수록 노선·등급 평균보다 비쌉니다. 오른쪽은 요일별 평균입니다. 공휴일 무렵(호박색)과 일요일 출발이 가장 비쌉니다."
  - ko alt: "출발일별 가격 점 그래프. 가로는 출발일, 세로는 노선·등급 평균 대비 가격이고, 오른쪽에 요일별 평균이 있습니다. 성탄절·신정·설날 무렵이 가장 높이 솟고, 요일 중에는 일요일이 가장 비쌉니다."
  - en·ja: 같은 뜻, 담백한 문장(기존 en·ja 문장의 어조를 따른다). 공휴일 이름은 기존 이름표 번역과 맞춘다.

- [ ] **Step 5: 검사** — `npx vitest run tests/unit/charts-layouts.test.ts`, `npm run typecheck && npm test`(문구 키 일치·숫자 금지 테스트 포함).
- [ ] **Step 6: 커밋**

```bash
git add src/charts/layouts.ts src/charts/build.ts src/components/sections/Charts.tsx content tests/unit/charts-layouts.test.ts
git commit -m "feat(charts): departure chart as a dot timeline with weekday averages

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: 공휴일 이름표 4개로 — 다시 추출

**Files:** Modify `scripts/export_charts.py`, `public/data/charts.2026-09-22.json`, (필요하면) `content/{ko,en,ja}.json`

- [ ] **Step 1:** `scripts/export_charts.py`의 `TOP_LABELS = 3` → `4`, 주석에 이유("점 그래프에서 봉우리 위에 이름을 붙이므로 한글날·추석 무렵까지 — 설계 2026-09-29 §2").
- [ ] **Step 2:** 항공권 저장소 iCloud 워밍(그 저장소 CLAUDE.md의 `find … | xargs … cat > /dev/null`, 이미 워밍돼 있으면 금방 끝난다) 뒤 `npm run charts`. 바뀐 것이 `labels`에 한 개 더해진 것뿐인지 `git diff --stat public/data`·`jq '.labels'`로 확인(다른 값이 바뀌었다면 이유를 보고 — 원본 CSV가 같으면 같아야 한다). `npm run pytest`.
- [ ] **Step 3:** `npx vitest run tests/unit/charts-content.test.ts` — 새 공휴일 코드의 이름이 `charts.holidays`에 없으면 실패한다. 3개 언어 `charts.holidays`에 이름을 더한다(`demo.holidays`에 같은 코드의 이름이 있으면 그것과 맞춘다).
- [ ] **Step 4: 커밋**

```bash
git add scripts/export_charts.py public/data content
git commit -m "data: label four holiday peaks on the departure chart

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: e2e·눈 확인·대체 이미지·기록

**Files:** `tests/e2e/charts.spec.ts`, `public/fallback/problem.webp`, 설계 문서, `CLAUDE.md`

- [ ] **Step 1: e2e** — `tests/e2e/charts.spec.ts`의 "이름표 개수" 테스트: `['chartDepart', '.chart-label.tick', 7]` → 새 배치의 tick 개수(눈금 4 + 요일 이름 7 + 요일 값(데이터 있는 요일 수, 실제 데이터는 7) = **18**)로, 테스트 이름의 "달력 요일 7"도 "출발일 눈금·요일 18"로. `npm run build && npx playwright test tests/e2e/charts.spec.ts tests/e2e/terrain.spec.ts --reporter=line`.
- [ ] **Step 2: 눈 확인(실제 GPU)** — 차트 1을 1280×720·390×844에서 3D 켜짐과 움직임 줄이기(2D)로 찍어 시안 3과 비교: 봉우리 위 이름표 4개가 점 바로 위, 요일 평균(일 호박색), 이름표·점이 판 밖으로 나가거나 겹치지 않음, 3D 점이 2D 그림과 같은 자리. 지도 화면 1·2도 한 번 더.
- [ ] **Step 3: 대체 이미지** — `npm run build && npm run fallbacks`(지도 `problem.webp`가 바뀐다; `hero`·`bubble`은 흩어짐 난수 순서 변화로 조금 달라질 수 있다 — 열어서 이상 없는지만 확인) → `npm run build`.
- [ ] **Step 4: 전체 검사** — `npm run typecheck && npm test && npm run build && npm run size && npm run e2e`. 알려진 흔들림(CLAUDE.md: `board.spec` "화면에 들어오면…", `terrain.spec` 화소 대비)은 한 번 다시 돌려 본다.
- [ ] **Step 5: 기록** — 설계 문서 `2026-09-29-map-and-depart-chart-design.md` 끝(§4 앞)에 `## 구현 결과 (계획 6-4)`: 해안선 점 수(데스크톱·휴대폰), 최종 `MAP_LINE`·`MAP_POINT`·`DEPART` 값과 조정 이유, 4번째 공휴일 이름, 눈 확인 결과, 검사 숫자. `CLAUDE.md`: 현재 상태 표에 `| 6-4 지도·출발일 | 지도 가는 실선, 차트 1 점 그래프 + 요일 평균 | \`2026-09-29-plan-6-4-map-depart.md\` | ✅ (PR 대기) |`, 5-3a 줄 상태 `✅ PR #10 (2026-09-29 병합·배포)`, 페이지 구성의 차트 1 설명(`출발일 점 달력` → `출발일 점 그래프 + 요일 평균`), 다음 할 일에서 5-3b가 새 차트 1 위에서 한다고 한 줄.
- [ ] **Step 6: 커밋**

```bash
git add tests/e2e/charts.spec.ts public/fallback docs/superpowers/specs/2026-09-29-map-and-depart-chart-design.md CLAUDE.md
git commit -m "chore: e2e counts, recapture fallbacks, record plan 6-4

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
