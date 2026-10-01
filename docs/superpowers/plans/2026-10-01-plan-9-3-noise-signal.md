# 계획 9-3: 머리말·① 배경 "잡음 → 신호" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 머리말·①의 물결 줄 배경을, 공항 불빛이 흩어진 뒤 잡음 밭이 되고 → 8구간 점이 하나씩 호박색으로 켜지고 → 점 선이 그어져 → U자 예약 곡선이 완성되는 연출로 바꾼다.

**Architecture:** 순수 모듈 `src/three/signal.ts`가 단계·스크롤 눈금·곡선 배치·점 배정을 맡고(단위 테스트), 셰이더가 화면 좌표(NDC)로 정한 잡음 밭·곡선을 고정 카메라로 월드에 올려 그린다. 비행기 시계(6-6)를 1 → 1.8로 늘려 신호 단계를 같은 최대 속도로 돌린다. 새 정점 속성 없이 `aWave` → `aField`, `aMeta.w` → 역할로 바꾼다.

**Tech Stack:** Next.js 16 정적 export · React Three Fiber · three ShaderMaterial(GLSL ES 1.0) · TypeScript · zod · vitest · Playwright

**Spec:** `docs/superpowers/specs/2026-10-01-noise-signal-design.md` (시안 `docs/superpowers/mockups/2026-10-01/noise-signal.html`)

## Global Constraints

- 작업 폴더: worktree `../signal-ml-portfolio-signal`, 브랜치 `plan-9-3-signal`. 커밋 이메일 `55799748+hyde0395@users.noreply.github.com`, 커밋 끝 빈 줄 + `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
- 다른 worktree(`-ticket` 연락처, `-demo` 데모 — `scenes.ts`의 `demo` 장면을 바꿨다)의 영역은 건드리지 않는다. `scenes.ts`는 `about`·`base`·`pickScene`·`sceneFor`만 고친다
- 한국어 주석: 파일 맨 위 한두 줄 + "왜". GLSL 문자열 안에는 `//` 주석 금지(3D 청크 크기) — 설명은 문자열 위 주석으로
- 문구에 숫자 금지, 수치는 데이터 파일에서. U자 값은 `terrain.json` `curve`에서 계산하고 테스트가 `charts.json`과 대조
- 초기 JS ≤ 150KB, 3D 청크 ≤ 280KB(`npm run size`). 이징은 expo.out
- e2e는 `tests/e2e/*.spec.ts` 전부, `E2E_PORT=<빈 포트>`, 워커 ≤ 2, 먼저 `uptime`

## Review Focus

1. 빠른 휠·옆 목차 점프: 시계가 1.8까지 최대 속도로 가고, 점프는 즉시(`data-handoff` 1.000, `data-signal` 1.000)
2. 3D가 ①이나 ②에서 켜진 경우: 장면 기본 `plane` 1.8 → U가 완성 상태
3. 대비: 머리말 글이 붙은 동안 잡음 밭 위에서 4.5:1(terrain.spec 화소 검사)
4. 정점 속성 수 그대로(셰이더 링크 실패 없음 — e2e 콘솔 오류 검사)
5. 세로 화면: U가 위쪽, 글은 아래

## File Structure

| 파일 | 할 일 | Task |
|---|---|---|
| `src/three/data.ts` · `tests/unit/three-data.test.ts` | `curve` 스키마, `bookingBins`, `buildWave` 지움 | 1, 3 |
| `src/three/signal.ts`(새) · `tests/unit/three-signal.test.ts`(새) | 단계·눈금·배치·배정 | 2, 3 |
| `tests/unit/three-wave.test.ts` | 지움(물결 줄 없어짐) | 3 |
| `src/three/plane.ts` · `tests/unit/plane.test.ts` | `runwayProgress` | 2 |
| `src/three/scenes.ts` · `tests/unit/three-scenes.test.ts` | `rows/soft` → `field`, `about` 카메라, `plane` 끝 1.8, 머리말 dim | 4 |
| `src/three/pointStyle.ts` · `tests/unit/point-style.test.ts` | `SOFT_POINT` 지움, `FIELD_POINT` | 4 |
| `src/three/shaders.ts` · `src/three/TerrainPoints.tsx` | 밭·곡선 그리기 | 5 |
| `src/three/TerrainScene.tsx` | yA·yB, `data-signal`, 시계 끝 | 6 |
| `src/components/sections/Intro.tsx` · `src/styles/globals.css` | 붙는 머리말, 글자 번짐 | 7 |
| `tests/e2e/airport.spec.ts` · `tests/e2e/terrain.spec.ts` | 전환 검사 자리, 신호 단계 | 8 |
| 설계 "구현 결과" · `CLAUDE.md` | 마무리 | 9 |

---

### Task 1: U자 8구간을 terrain.json에서

**Files:** Modify `src/three/data.ts`; Test `tests/unit/three-data.test.ts`

- [ ] Step 1: 실패하는 테스트 — `bookingBins(terrain.curve)`가 `charts.json` `curve.mean`을 뒤집은 값(왼쪽 = D-61~90)과 ±1(%×10 반올림) 안에서 같고, `BOOKING_BINS`가 `charts.json` `bins`를 뒤집은 것과 같다. 빈 구간은 0
- [ ] Step 2: `npx vitest run tests/unit/three-data.test.ts` → FAIL
- [ ] Step 3: `terrainSchema`에 `curve: z.object({ dtd, pct, n }).optional()`, `BOOKING_BINS = [[61,90],[46,60],[31,45],[22,30],[15,21],[8,14],[4,7],[1,3]]`, `bookingBins(curve)` = 구간마다 n 가중 평균 pct/10(%)
- [ ] Step 4: PASS → 커밋 `feat(3d): terrain 곡선에서 U자 8구간 계산`

### Task 2: 단계·스크롤 눈금(signal.ts, plane.ts)

**Files:** Create `src/three/signal.ts`, `tests/unit/three-signal.test.ts`; Modify `src/three/plane.ts`, `tests/unit/plane.test.ts`

- [ ] Step 1: 테스트 — `SIGNAL = { start: 1, end: 1.8 }`, `signalStage(p)`(1 → 0, 1.8 → 1, 밖은 자름), `binLit(q, i)`(q 0.25 전 0, 점마다 늦게, 0.12 뒤 1, expo.out), `lineHead(q)`(0.5 → 0, 0.83 → 1), `settle(q)`(0.82 전 0, 1에서 1). `runwayProgress(y, y0, yA, yB)`: yA 전은 `takeoffProgress(y, y0, yA)`와 같고, yA → yB는 1 → 1.8 선형, 그 뒤 1.8, 단조 증가
- [ ] Step 2: FAIL 확인
- [ ] Step 3: 구현(순수 함수, React·three 없음)
- [ ] Step 4: PASS → 커밋 `feat(3d): 잡음 → 신호 단계와 스크롤 눈금`

### Task 3: 곡선 배치·점 배정

**Files:** Modify `src/three/signal.ts`, `tests/unit/three-signal.test.ts`, `src/three/data.ts`; Delete `tests/unit/three-wave.test.ts`

- [ ] Step 1: 테스트 — `signalLayout(aspect, bins)`: 점 8개, 가로 화면은 x가 왼→오 증가·모두 NDC x ≥ 0.05(화면 오른쪽 반), 가장 낮은 점 = 가장 작은 값(구간 2), 가장 높은 점 = 구간 7, 세로 화면(aspect < 1)은 모두 위쪽(y > 0.1), 누적 호 길이 `arc`는 0에서 1까지 증가. `curvePoint(layout, s)`: s = arc[i]에서 점 i와 같다, 0·1은 양끝
- [ ] Step 2: 테스트 — `buildField({ kind, airStyle, target, lineCount, seed })`: 공항·비행기 점은 모두 역할 ≥ 1, 역할 1 점 수 + 8 = target(공항 점이 target보다 많으면 공항 점 수), 구간 역할 2..9가 하나씩이고 공항 점이 아님, 선 점 역할 10 + s(0..1, 고르게)가 lineCount개이고 밭 밖 점에서, 잡음 깊이 d ∈ [0,1], 같은 시드면 같은 결과
- [ ] Step 3: FAIL → 구현. `PointCloud`에서 `wave`·`waveHoliday` 지우고 `packMeta`는 w 자리에 역할 배열을 받는다(`packMeta(cloud, role)`). `buildWave`·`WAVE` 지움, `three-wave.test.ts` 지움(packMeta 검사는 three-data로 옮김)
- [ ] Step 4: PASS → 커밋 `feat(3d): 잡음 밭·U자 곡선 배치와 점 배정`

### Task 4: 장면 표

**Files:** Modify `src/three/scenes.ts`, `tests/unit/three-scenes.test.ts`, `src/three/pointStyle.ts`, `tests/unit/point-style.test.ts`

- [ ] Step 1: 테스트 고치기 — `about` = 카메라 `[0,0,24]`·목표점 원점·`field 1`·`dim 0.6`, 세로 화면도 같은 카메라(밭이 화면 비율을 따른다), `field`는 about만 1, 장면 기본 `plane` = `SIGNAL.end`(hero 0), `pickScene` 머리말(활성 없음)·hero 활성일 때 h 1이면 `{ ...about, dim: 1 }`, ①(about 활성)이면 about 그대로
- [ ] Step 2: FAIL → 구현(`rows`·`soft` → `field`, `SOFT_POINT` 지우고 `FIELD_POINT` 상수: 크기·알파·떨림·가라앉음 값)
- [ ] Step 3: PASS → 커밋 `feat(3d): ① 장면을 잡음 밭으로`

### Task 5: 셰이더·점 구름

**Files:** Modify `src/three/shaders.ts`, `src/three/TerrainPoints.tsx`

- [ ] Step 1: 셰이더 — `aWave` → `aField`, uniform `uField`·`uSig`·`uCurve[8]`·`uArc[8]`·`uHalf`·`uPxY`. 역할 풀기, `fieldWorld(ndc, z)`, `curveAt(s)`(Catmull-Rom, TS `curvePoint`와 같은 식), 잡음 떨림·반짝임·가라앉음, 구간 켜짐·미끄러짐, 선 나타남, 번짐(`vShape.z = -2` → 넓은 부드러운 번짐)
- [ ] Step 2: TerrainPoints — 역할·밭 버퍼(`buildField`)로 `aMeta`·`aField`, `uSig = signalStage(감쇠된 p)`, 창 비율이 바뀌면 `signalLayout`으로 `uCurve`·`uArc`·`uHalf`, `uPxY = 2 / 높이`
- [ ] Step 3: `npx tsc --noEmit` · `npx vitest run` 통과 → 커밋 `feat(3d): 잡음 밭과 점 선 U자를 셰이더로`

### Task 6: 시계를 신호 단계까지

**Files:** Modify `src/three/TerrainScene.tsx`

- [ ] Step 1: yA = `#intro` 윗변 + 0.25·화면, yB = `#intro` 아랫변 − 화면(없거나 뒤집히면 yA). 목표 = `runwayProgress`, ②~면 시계 = `SIGNAL.end`. `data-signal` 적기·지우기
- [ ] Step 2: tsc·vitest → 커밋 `feat(3d): 비행기 시계를 신호 단계까지 늘림`

### Task 7: 붙는 머리말·글자 번짐

**Files:** Modify `src/components/sections/Intro.tsx`, `src/styles/globals.css`

- [ ] Step 1: `<div className="intro-pin">`로 글 상자를 감싼다. `html.hero-runway .intro { min-height: 230svh }`, `.intro-pin { position: sticky; top: 0; min-height: 100svh; display: flex; … }`. 세로 화면(767px 이하) 3D 켜짐: 아래 정렬
- [ ] Step 2: `html[data-3d="on"]` 머리말·① 글에 `text-shadow: 0 0 18px #02040a, 0 0 6px #02040a`
- [ ] Step 3: 커밋 `feat(intro): 신호 단계 동안 머리말 글을 화면에 붙인다`

### Task 8: e2e

**Files:** Modify `tests/e2e/airport.spec.ts`, `tests/e2e/terrain.spec.ts`

- [ ] Step 1: 전환 도중 검사 자리를 y0·yA 가운데로, ①에 오면 `data-signal` 1.000, 맨 위로 되돌리면 0.000. 옆 목차 점프 1초 안에 `data-signal` 1.000
- [ ] Step 2: 대비 검사: 머리말이 붙은 동안(신호 단계 가운데)도 `#intro-h`·`.intro-note`
- [ ] Step 3: build → `E2E_PORT=… npx playwright test --workers=2` 전부 → 커밋

### Task 9: 눈 확인·마무리

- [ ] 실제 GPU(헤드 있는 크로미움, 화면 밖) 1440×900·390×844, 맨 위 → 이륙 → 머리말 → ① → ② 캡처 + 모아 보기, 시안과 비교·다듬기, fps
- [ ] 설계 "구현 결과", `CLAUDE.md`(페이지 구성 머리말·①, 현재 상태), push, PR, CI
