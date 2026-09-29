# 계획 6-5: 첫 화면 → ① 스크롤에 묶인 전환 + 넓은 지형 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 첫 화면에서 ① PROJECT로 내려갈 때 공항 불빛이 스크롤한 만큼 지형 자리로 날아가고 카메라도 함께 움직이게 하며, ①의 지형을 높은 시점에서 넓고 은은하게 보이게 한다.

**Architecture:** 장면 목표 상태를 정하는 `TerrainScene.update()`에 "전환 구간" 계산을 더한다 — 스크롤 위치로 진행도 `h`를 구하고, 구간 안이면 `sceneFor('hero', 1)`과 `sceneFor('about', 0)`을 `h`로 섞은 상태(순수 함수 `blendScenes`, `scenes.ts`)를 목표로 둔다. 구간 안에서는 목표 상태의 `follow` 표시로 `TerrainPoints`·`CameraRig`가 감쇠를 빠르게 해 스크롤을 바짝 따라간다. ① 카메라(`SCENES.about`, 세로 화면 `PORTRAIT_OVERRIDE.about`)는 실제 화면 후보 중 사용자가 고른 값으로 바꾼다.

**Tech Stack:** React Three Fiber · Vitest · Playwright

**설계:** `docs/superpowers/specs/2026-09-29-hero-project-handoff-design.md`

## 공통 규칙

- **작업 폴더**: 이 계획은 다른 계획(5-3b)과 동시에 진행한다 — git worktree(브랜치 `plan-6-5-handoff`, main에서)에서 작업한다. 5-3b는 `TerrainScene.tsx`의 차트 강조·슬롯 줄을 고친다 — 이 계획은 장면 선택·목표 상태 부분만 고치고 그 줄들은 건드리지 않는다(나중 병합 충돌 최소화).
- 코드 주석 한국어. GLSL 문자열 안 주석 금지. 커밋 끝 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. 3D 청크 ≤ 250KB(지금 244.8KB — 5-3b가 조금 늘릴 수 있다; 이 계획은 셰이더를 거의 안 건드린다).
- 3D 눈 확인: 헤드 있는 크로미움 화면 밖 실제 GPU(`chromium.launch({ headless: false, args: ['--window-position=-2400,0'] })`), 스크립트는 세션 스크래치 폴더, `NODE_PATH="$PWD/node_modules" node …`. worktree에서는 `npm ci`가 필요할 수 있다(또는 원래 폴더의 `node_modules`를 APFS 복제 `cp -Rc` — 심볼릭 링크는 Turbopack이 거부한다).

---

### Task 1: ① 카메라 후보 찍기 → 사용자 선택

- [ ] `SCENES.about`(지금 `camera [-19, 7, 16]`, `target [-5, 0.5, 0]`, `noise 0.6`)을 바꿔 가며(빌드 → 실제 GPU 1280×720·390×844 캡처, ①을 읽는 위치로 스크롤) 후보 3개를 만든다. 방향: 앞쪽 가운데 높은 곳에서 멀리 내려다봐 지형이 화면 가로 대부분에 깔리고, 밝은 가까운 쪽은 오른쪽·위, 글(왼쪽) 뒤에는 먼 쪽만.
  - 참고 좌표: 지형은 x −8 ~ 8(왼쪽 = 먼 예약 시점), z −10 ~ 10(출발일), 높이 = %×0.04. 거리 흐림은 카메라~목표점 거리 기준(`DEPTH_FADE`).
  - 예: A `camera [2, 13, 22] target [2, 0, −2]`(높이 내려다봄), B `camera [4, 8, 24] target [3, 1, −4]`(낮게 멀리), C `camera [-2, 16, 18] target [1, 0, −1]`(더 위에서). 값은 출발점일 뿐 — 화면을 보고 조정.
  - 후보마다 `terrain.spec`의 화소 대비 검사가 ① 제목·본문에 통과하는지 확인(`npx playwright test tests/e2e/terrain.spec.ts -g "화소 검사"`).
- [ ] 캡처(후보별 데스크톱·휴대폰, 지금 값도 같이)를 스크래치 폴더에 두고 경로·관찰·대비 결과를 보고한다. **여기서 멈추고 컨트롤러의 선택을 기다린다**(커밋하지 않음 — 후보 값은 되돌린다).

### Task 2: 섞기 함수와 전환 진행도(순수)

**Files:** `src/three/scenes.ts`, `tests/unit/three-scenes.test.ts`

- [ ] 테스트 먼저: `blendScenes(a, b, h)` — h 0이면 a, 1이면 b, 가운데는 숫자 필드(카메라·목표점 각 성분, `airport`, `noise`, `dim`, `assemble`, `map`, `removed`, `drop`, `sway`)를 선형으로 섞는다. `chart`는 둘 다 0이어야 한다(차트 장면은 섞지 않는다 — 인자로 차트 장면이 오면 던진다). `handoffProgress(scrollY, y0, y1)` — `y0` 이하 0, `y1` 이상 1, 사이 smoothstep, `y1 <= y0`이면 0.
- [ ] 구현 + `SceneState`에 `follow?: boolean` 추가(주석: 전환 구간 안 — 점·카메라가 스크롤을 바짝 따라가게 감쇠를 빠르게). 커밋 `feat(3d): blend two scene states; handoff progress (pure)`.

### Task 3: 전환 연결과 빠른 감쇠

**Files:** `src/three/TerrainScene.tsx`(장면 목표 계산 부분만), `src/three/TerrainPoints.tsx`, `src/three/CameraRig.tsx`

- [ ] `TerrainScene.update()`: 차트가 아닌 장면이고 `html.hero-runway`가 붙어 있을 때(3D가 맨 위에서 켜진 경우만 — 설계 §2.1), `y0 = 0.9 × innerHeight`, `y1 = (#project의 문서 위치) − 0.2 × innerHeight`, `h = handoffProgress(scrollY, y0, y1)`. `0 < h < 1`이면 목표 = `{ ...blendScenes(sceneFor('hero', 1, portrait), sceneFor('about', 0, portrait), h), follow: true }`, `parallax`는 `h < 0.5`일 때만. `h`가 0이면 지금처럼(첫 화면), 1 이상이면 지금처럼(활성 장면). `data-active-scene`은 지금처럼 활성 장면 이름.
- [ ] `TerrainPoints`: `step`의 감쇠 상수를 `t.follow ? DAMP * 4 : DAMP`로. `CameraRig`: `1.8` → `t.follow ? 7 : 1.8`(위치·목표점 모두). 공항 곁가지 `AirportExtras`가 `target.airport`를 어떻게 따라가는지 확인하고, 같은 `follow` 규칙이 필요하면 맞춘다.
- [ ] 눈 확인(실제 GPU): 스크롤 60·75·90·100% 캡처(설계 비교와 같은 위치) — 불빛이 지형 자리로 옮겨 가는 도중이 보이는지, 위로 되돌리면 거꾸로 가는지, 끊김·튐 없음. 빠르게 휠해도 이상 없음.
- [ ] 커밋 `feat(3d): hero → project handoff follows the scroll`.

### Task 4: 고른 ① 카메라 적용

- [ ] Task 1에서 고른 값을 `SCENES.about`(·`PORTRAIT_OVERRIDE.about`)에 넣는다. `three-scenes.test.ts`에 값이 바뀌어 깨지는 테스트가 있으면 새 값에 맞춘다. 대비 화소 검사·`terrain.spec` 전체 통과. 대체 이미지는 `hero`·`problem`·`bubble`뿐이라 다시 찍을 필요 없음(확인만).
- [ ] 커밋 `feat(3d): wide, soft terrain view for ① PROJECT`.

### Task 5: 검사·기록

- [ ] `npm run typecheck && npm test && npm run build && npm run size && npm run e2e`.
- [ ] 설계 문서에 `## 구현 결과 (계획 6-5)`: 전환 구간 값, 감쇠 배율, 고른 카메라 값(데스크톱·휴대폰), 대비 검사 결과, 눈 확인. `CLAUDE.md` 현재 상태 표에 6-5 줄(PR 대기)과 페이지 구성의 첫 화면 설명에 "스크롤한 만큼 불빛이 지형으로" 한 줄.
- [ ] 커밋 `chore: record plan 6-5`.
