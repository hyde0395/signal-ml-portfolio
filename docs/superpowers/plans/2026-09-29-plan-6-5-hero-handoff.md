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

### Task 1: ① 카메라 후보 찍기 → 사용자 선택 ✅ (카메라 C, 물결 줄 C — 설계 §4·§6)

### Task 2: 섞기 함수와 전환 진행도(순수)

**Files:** `src/three/scenes.ts`, `tests/unit/three-scenes.test.ts`

- [ ] 테스트 먼저: `blendScenes(a, b, h)` — h 0이면 a, 1이면 b, 가운데는 숫자 필드(카메라·목표점 각 성분, `airport`, `noise`, `dim`, `assemble`, `map`, `removed`, `drop`, `sway`, 그리고 Task 4의 `rows`)를 선형으로 섞는다. `chart`는 둘 다 0이어야 한다(차트 장면이 오면 던진다). `handoffProgress(scrollY, y0, y1)` — `y0` 이하 0, `y1` 이상 1, 사이 smoothstep, `y1 <= y0`이면 0.
- [ ] 구현 + `SceneState`에 `follow?: boolean`(전환 구간 안 — 점·카메라가 스크롤을 바짝 따라가게 감쇠를 빠르게). 커밋 `feat(3d): blend two scene states; handoff progress (pure)`.

### Task 3: SIGNAL 설명 화면(머리말)

**Files:** `src/components/sections/Intro.tsx`(새), `src/components/HomePage.tsx`, `src/styles/globals.css`, `content/{ko,en,ja}.json`, 테스트(`tests/unit/content.test.ts` 키 일치·숫자 금지는 자동, e2e `site.spec.ts`)

- [ ] 첫 화면과 ① 사이에 `<section id="intro" className="intro wrap" aria-labelledby="intro-h">` 한 화면(높이 약 100svh — 전환 구간이 이 화면을 지나는 동안 일어난다). 섹션 목록(`sections.ts`)·옆 목차·번호에는 넣지 않는다(머리말). `data-scene`은 두지 않는다(전환 구간은 Task 4가 스크롤 위치로 계산 — 활성 장면은 지금처럼 `hero`에서 `about`으로).
- [ ] 문구(설계 §5, 사용자 선택 A): 큰 두 줄 `intro.line1` "가격은 매일 흔들립니다." · `intro.line2` "대부분은 잡음이고, 그 안에 몇 개의 신호가 있습니다." + 작은 한 줄 `intro.note` "점 하나는 실제로 수집한 가격 하나입니다." 영·일은 같은 톤으로 담백하게(설명조·광고조 금지). 제목 요소는 `<h2 id="intro-h">`에 두 줄(시각적으로 줄바꿈), 작은 줄은 `<p>`.
- [ ] 모양: 글은 화면 가운데 또는 왼쪽(①과 같은 글 열), 제목 글꼴(Space Grotesk 계열이면 한글은 Pretendard로 대체 — 기존 제목 규칙 따름), 리빌 연출(`data-reveal`)은 기존 섹션 제목과 같게. 판 없음. 글 뒤 대비 4.5:1 — 전환 중 점이 글 뒤를 지나가므로 `terrain.spec` 화소 검사에 `#intro-h`·`.intro-note`를 추가한다.
- [ ] 3D 꺼짐·움직임 줄이기: 글만 보인다(대체 이미지 흐름 확인 — `ChapterFigure`가 필요하면 `hero` 그림을 쓰지 않고 없이 둔다).
- [ ] 커밋 `feat(intro): SIGNAL prologue screen between the hero and ①`.

### Task 4: 전환 연결과 빠른 감쇠

**Files:** `src/three/TerrainScene.tsx`(장면 목표 계산 부분만), `src/three/TerrainPoints.tsx`, `src/three/CameraRig.tsx`, `src/three/AirportExtras.tsx`(필요하면)

- [ ] `TerrainScene.update()`: 차트가 아닌 장면이고 `html.hero-runway`가 붙어 있을 때만, `y0 = 0.9 × innerHeight`(내려앉기 끝), `y1 = (#project의 문서 위치) − 0.2 × innerHeight`, `h = handoffProgress(scrollY, y0, y1)`. `0 < h < 1`이면 목표 = `{ ...blendScenes(sceneFor('hero', 1, portrait), sceneFor('about', 0, portrait), h), follow: true }`, `parallax`는 `h < 0.5`일 때만. `h`가 0이면 지금처럼(첫 화면), 1이면 지금처럼(활성 장면). 설명 화면이 `y0`~`y1` 사이에 있으므로 전환은 설명 글이 떠 있는 동안 일어난다 — 실제로 그런지 확인하고, 아니면 `y0`·`y1` 정의를 설명 화면 위·아래 끝에 맞춘다.
- [ ] `TerrainPoints`: `step` 감쇠를 `t.follow ? DAMP * 4 : DAMP`. `CameraRig`: `t.follow ? 7 : 1.8`. `AirportExtras`가 `airport` 값을 따라 함께 사라지는지 확인하고 필요하면 같은 규칙.
- [ ] 눈 확인(실제 GPU): 설명 화면 진입·가운데·끝, ① 도착 캡처 — 불빛이 지형 자리로 옮겨 가는 도중이 보이는지, 위로 되돌리면 거꾸로 가는지, 빠른 휠에 튐 없음.
- [ ] 커밋 `feat(3d): hero → project handoff follows the scroll through the intro`.

### Task 5: ① 카메라 C + 물결 줄

**Files:** `src/three/scenes.ts`, `src/three/data.ts`(또는 점 구름 만드는 곳), `src/three/TerrainPoints.tsx`, `src/three/shaders.ts`, 테스트

- [ ] 설계 §6 그대로: `SCENES.about` = 카메라 C(`camera [13, 9, 15]`, `target [1, 0, 2]`), `PORTRAIT_OVERRIDE.about` = `camera [11, 6, 15]`, `target [3, -3, 2]`(세로 1.6배 물러남 규칙 뒤에 적용되는지 확인), `rows: 1`, `noise: 0`, 크기 0.75배·알파 0.6배(장면 값으로 — 새 필드가 필요하면 `blendScenes`에도).
- [ ] 물결 줄 목표 위치 `buildWave`(순수 함수로 — 단위 테스트: 점 2,070개가 30×69 칸에 하나씩, 정렬 규칙, 호박색 줄 규칙이 지금 데이터에서 세 줄(검토 2026-09-29: 줄 묶음을 줄에 놓인 점으로 고친 뒤), 높이 식). 셰이더에 `aWave`·`uRows`. **정점 속성 16개 한계** — `aKind`·`aHoliday`·`aRoute`·물결 공휴일을 vec4 `aMeta`로 묶는다(다른 곳에서 이 속성들을 읽는 코드 모두 확인). 시안 코드 `docs/superpowers/mockups/2026-09-29-about-wave/about-wave-mock.diff`를 참고하되 쿼리 스위치는 빼고 정식으로.
- [ ] 대비: `terrain.spec` 화소 검사(①·설명 화면) 통과. 3D 청크 ≤ 250KB.
- [ ] 커밋 `feat(3d): wide camera and a soft wave of per-date rows for ①`.

### Task 5c: 첫 화면 공항을 시안과 똑같이 (설계 §8) — Task 5b보다 먼저

**Files:** `src/three/TerrainScene.tsx`(DPR 한 줄), `src/three/shaders.ts`, `src/three/AirportExtras.tsx`, `src/three/pointStyle.ts`, `src/three/scenes.ts`(화각이 장면 값이면), `src/styles/globals.css`(하늘·비네트), 테스트

- [ ] 설계 §8 목록을 모두 넣는다(필름 입자 제외). 시안 코드(`01-night-airport.html`)와 비교 diff를 참고해 값은 그대로.
- [ ] 화각 45°: 첫 화면 구도가 바뀐다 — 첫 화면 글·SCROLL 표시·메타 줄과 겹치지 않는지, 휴대폰 세로 값도 확인. 차트 장면 카메라(차트 판 px ↔ 월드 좌표)가 화각에 의존하면 차트 장면은 건드리지 않는다.
- [ ] 대비: 하늘·비네트가 바뀌므로 `terrain.spec` 화소 검사 전체(첫 화면·머리말·①) 통과.
- [ ] 대체 이미지 첫 화면(`hero.webp`)을 다시 찍는다(`npm run fallbacks`) — OG 이미지는 그대로.
- [ ] 실제 GPU로 시안과 나란히 캡처(데스크톱 1440×900 레티나, 휴대폰 390×844) — 활주로 확대 포함.
- [ ] 커밋 `feat(3d): the night airport matches the mockup (crisp cores, wet reflections, sky, DPR 2 on desktop)`.

### Task 5b: 이륙하는 점 비행기 (설계 §7, 시안 A)

**Files:** `src/three/data.ts`(또는 공항 배정 `assignAirport`가 있는 곳), `src/three/shaders.ts`, `src/three/TerrainPoints.tsx`, `src/three/TerrainScene.tsx`(장면 목표 부분만, 필요하면), `src/three/AirportExtras.tsx`(착륙 비행기 끄기), 테스트

- [ ] 비행기 모양(점 약 230개: 동체·날개·엔진·수평·수직 꼬리) 좌표를 코드로 만드는 순수 함수 + 단위 테스트(점 수, 대칭, 크기). 시안 `takeoff.html`의 모양·크기(대형기 약 75m 상당, 사이트 좌표로 환산)를 따른다.
- [ ] 첫 화면에서 숨은 잡음 점 중 그만큼을 비행기 점으로 배정(공항 불빛 점은 건드리지 않음), 기존 속성에 값 넣기 — 속성 수를 늘리지 않는다.
- [ ] 이륙 경로: 스크롤 진행(첫 화면 내려앉기 + Task 4 전환 진행도)에 묶인 순수 함수 `planePose(p)` → 위치·자세(단위 테스트: 0에서 활주로 끝에 정지, 이륙 시점 뒤 고도 증가, 되돌리면 같은 자세). JS에서 매 프레임 `uPlane` 행렬, `uPlaneGo`(흩어짐). 흩어진 점은 자기 지형(물결) 자리로 간다.
- [ ] 글과 겹치지 않음: e2e(3D 켜짐)로 설명 글·① 제목이 보이는 스크롤 위치들에서 비행기 점(흩어지기 전)의 화면 위치가 글 상자와 겹치지 않음을 확인하는 방법이 어렵다면, 실제 GPU 캡처 격자로 눈 확인하고 기록.
- [ ] 움직임 줄이기·3D 꺼짐: 대체 이미지 첫 화면에는 서 있는 비행기만(다시 찍을지 확인 — `npm run fallbacks`).
- [ ] 3D 청크 ≤ 280KB. 커밋 `feat(3d): a dot plane takes off as you scroll and scatters into the terrain`.

### Task 6: 검사·기록

- [ ] `npm run typecheck && npm test && npm run build && npm run size && npm run e2e`. 대체 이미지는 `hero`·`problem`·`bubble`뿐 — 다시 찍을 필요 있는지 확인.
- [ ] 설계 문서에 `## 구현 결과 (계획 6-5)`. `CLAUDE.md` 현재 상태 표에 6-5 줄(PR 대기), 페이지 구성에 설명 화면 한 줄, 다음 할 일에서 6-5 항목 정리(커버리지 그래프는 하지 않기로 함).
- [ ] 커밋 `chore: record plan 6-5`.
