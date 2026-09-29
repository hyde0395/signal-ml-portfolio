# 계획 5-3b: 차트 직접 만지기 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ④ 차트 1(출발일 점 그래프)·2(구간별 벌떼)·4(불확실성 구름)를 마우스·손가락·키보드로 짚어 볼 수 있게 한다 — 짚은 항목이 밝아지고 작은 표시 상자에 값이 나온다. 5-2에서 미룬 "차트 → 지형 → 다른 차트로 갈 때 점이 튐"도 고친다.

**Architecture:** 배치 함수(`src/charts/layouts.ts`)가 점마다 "강조 번호"(`hl`, 지금의 와플 그룹 번호 `waffle`를 일반화한 것)와 짚을 항목 목록(`items`: 항목마다 가로 위치·세로 위치·번호·표시할 값)을 함께 돌려준다. 그림 판(`ChartStage`) 위에 투명한 조작 층(`role="slider"`)을 두고, 포인터·키보드 위치를 가장 가까운 항목으로 바꿔 저장소(`registry.setFocus`)에 알린다. 2D 그림(`draw2d.ts`)과 3D 셰이더는 이미 와플 강조에 쓰는 "번호가 같으면 강조, 다르면 흐리게" 규칙을 그대로 쓴다(정점 속성 추가 없음). 강조 색·흐림 정도만 차트마다 다르게(`layout.focusTone`·`focusDim`, 셰이더 유니폼 2개).

**Tech Stack:** React(클라이언트 컴포넌트) · three.js 셰이더 · Vitest · Playwright(+axe)

**설계:** `docs/superpowers/specs/2026-09-25-page-restructure-design.md` §4.1 "차트 직접 만지기"(표 — 차트 1은 계획 6-4에서 점 그래프로 바뀌었으므로 "가장 가까운 출발일 원" = "가장 가까운 출발일 점 뭉치"). 5-3a 구현 결과 절 다음에 결과를 적는다.

## 모든 작업 공통 규칙

- 브랜치 `plan-5-3b-touch`(main에서 새로 만든다). main에 직접 커밋하지 않는다.
- **코드 주석은 한국어**. GLSL 템플릿 문자열 안에는 주석을 넣지 않는다(`shaders.ts`의 JS 주석 묶음에).
- 커밋 메시지 끝 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. 커밋 이메일은 저장소 설정 그대로.
- 문구 3개 언어 키 일치, 문구에 숫자 직접 기입 금지(자리표시 `{v.…}`는 된다 — 데모 `strip.valuetext`처럼).
- 초기 JS ≤ 150KB(`ChartStage`는 초기 청크에 있다 — 조작 코드는 작게, 무거운 계산은 이미 import()로 불러오는 `@/charts/build` 쪽에), 3D 청크 ≤ 250KB(지금 244.8KB).
- e2e 전에 `npm run build`. 3D 눈 확인은 헤드 있는 크로미움을 화면 밖에 띄워 실제 GPU로(`chromium.launch({ headless: false, args: ['--window-position=-2400,0'] })`), 임시 스크립트는 세션 스크래치 폴더에서 `NODE_PATH="$PWD/node_modules" node …`.
- **다른 작업(계획 6-5, 첫 화면 → ① 전환)이 별도 작업 폴더에서 동시에 `src/three/TerrainScene.tsx`·`scenes.ts`를 고친다.** 이 계획은 `TerrainScene.tsx`의 차트 슬롯·강조 부분(아래 Task 2·5에 적은 줄)만 고치고, 장면 선택·카메라 계산은 건드리지 않는다.

## 조작 규칙(설계 §4.1을 구체화)

| 차트 | 항목 | 처음 상태 | 표시 상자 |
|---|---|---|---|
| 1 출발일 | 출발일 180개(점 뭉치) | 없음(짚을 때만) | `{v.date}` 출발일(요일) · 평균 대비 `{v.pct}` · 공휴일이면 이름 |
| 2 구간별 벌떼 | 구간 8개 | **가장 싼 구간**(평균 가장 낮은 구간)에 세로선 | 구간 이름 · 같은 편 평균보다 `{v.pct}` · 관측 `{v.n}`건 |
| 4 불확실성 구름 | 출발일(예측 있는 날) | 없음 | `{v.date}` 출발일 · 예측가 `{v.price}` · 범위 `{v.lo}`~`{v.hi}` |

- **마우스·펜**: 판 위에서 움직이면 가로 위치가 가장 가까운 항목. 판을 떠나면 차트 1·4는 강조 해제, 차트 2는 마지막 구간에 세로선이 남는다.
- **터치**: 가로로 8px 넘게 먼저 움직일 때만 짚기(세로 스크롤과 구분 — 데모 `DateStrip`의 `TOUCH_SLOP_PX`와 같은 규칙), 가볍게 누르면 그 자리 항목. 손을 떼도 마지막 항목 유지(다시 누르면 바뀜).
- **키보드**: 조작 층에 Tab 초점 → ←/→ 한 칸, Home/End 처음/끝. 차트 1·4는 초점을 받을 때 항목이 없으면 첫 항목부터.
- **화면 낭독기**: 조작 층이 `role="slider"`, `aria-valuemin/max/now`(항목 번호), `aria-valuetext`(표시 상자와 같은 문장), `aria-label`(차트 제목 + "값 살펴보기"). 판의 나머지(캔버스·이름표)는 지금처럼 `aria-hidden`.
- **강조 모양**: 차트 1·4 — 고른 출발일 점은 글자색(`TONE.text`), 나머지 × 0.45. 차트 2 — 고른 구간 점은 그대로 밝게, 나머지 × 0.45, 세로선(HTML 1px 선). 와플(③)은 지금처럼 호박색 · × 0.25.
- **3D 꺼짐·움직임 줄이기**: 2D 그림에서 똑같이 된다(이미 같은 배치·강조 규칙을 쓴다).
- 표시 상자는 HTML, 판 안에서 가장자리에 닿으면 안쪽으로 붙인다(판 밖으로 안 나감). 짚은 항목 위쪽 12px(자리가 없으면 아래).

---

### Task 1: 강조 번호 일반화 — `waffle` → `hl`, 차트마다 강조 색·흐림

**Files:** `src/charts/types.ts`, `src/charts/layouts.ts`, `src/charts/draw2d.ts`, `src/three/chartTargets.ts`, `src/three/TerrainPoints.tsx`, `src/three/shaders.ts`, `src/three/TerrainScene.tsx`(강조 줄 하나), `src/components/charts/ChartStage.tsx`(필드 이름), 테스트 `tests/unit/charts-*.test.ts`·`chart-targets.test.ts`

- [ ] **Step 1:** `ChartLayout.waffle` → `hl`(주석: "강조 번호 — 같은 번호끼리 함께 강조된다. ③ 와플 그룹, ④ 차트 1·4 출발일 번호, 차트 2 구간 번호. −1 = 강조와 무관(늘 그대로)"). `ChartLayout`에 `focusTone: number`(TONE)와 `focusDim: number`를 더한다. `Pts.add`의 마지막 인자 이름도 `hl`. 와플은 `focusTone = TONE.amber`, `focusDim = FOCUS_DIM`(0.25, 그대로). 나머지 배치는 이 Task에서는 `hl` 전부 −1, `focusTone = TONE.text`, `focusDim = 0.45`(상수 `CHART_FOCUS_DIM`을 `types.ts`에). `grep -rn "waffle" src tests`로 남은 곳을 모두 바꾼다(`aWaffle` 셰이더 속성 이름도 `aHl`로 — 셰이더·`TerrainPoints` 버퍼 이름·`slotBuffers` 반환 필드 `hl`).
- [ ] **Step 2:** `draw2d.ts`: `FOCUS_DIM`·`TONE.amber` 대신 `layout.focusDim`·`layout.focusTone` 사용.
- [ ] **Step 3:** 셰이더: 유니폼 `uFocusTone`(float)·`uFocusDim`(float) 추가, 강조 식을 `if (abs(aHl - uFocus) < 0.5) chartCol = toneColor(uFocusTone); else chartA *= uFocusDim;`로(와플에서 쓰던 문자열 상수 `FOCUS_DIM` 대신 유니폼). `TerrainPoints`: 유니폼 기본값(`uFocusTone` 2 = 호박, `uFocusDim` 0.25), `ChartSlots`에 `focusTone`·`focusDim` 필드, 매 프레임 넣기.
- [ ] **Step 4:** `TerrainScene.tsx`: `slots.current.focus = chartKey === 'features' ? getFocus('features') : -1;` → `slots.current.focus = chartKey ? getFocus(chartKey) : -1;` 그리고 `slots.current.focusTone`·`focusDim`을 지금 차트 배치(`entry.layout`)에서(차트가 아니면 기본값). (이 줄 외에는 건드리지 않는다.)
- [ ] **Step 5:** 테스트 이름·기대값을 새 이름에 맞추고 `npm run typecheck && npm test && npm run build && npm run size`. ③ 와플 강조 e2e(`charts.spec` "와플 그룹에 마우스를 올리면…")가 그대로 통과해야 한다 — `npx playwright test tests/e2e/charts.spec.ts --reporter=line`.
- [ ] **Step 6:** 커밋 `refactor(charts): generalize the waffle focus into a per-point highlight key with per-chart tone and dim`.

### Task 2: 짚을 항목 — 배치 함수가 `items`와 `hl`을 돌려준다

**Files:** `src/charts/types.ts`, `src/charts/layouts.ts`, `src/charts/build.ts`, `src/components/sections/Charts.tsx`, `content/{ko,en,ja}.json`, `tests/unit/charts-layouts.test.ts`

- [ ] **Step 1: 타입** — `types.ts`: `export type ChartItem = { key: number; x: number; y: number; text: string }`(x·y 정규화, text = 표시 상자·`aria-valuetext` 문장). `ChartLayout.items?: ChartItem[]`, `ChartLayout.initial?: number`(처음 강조 번호, 없으면 −1).
- [ ] **Step 2: 테스트 먼저** — `charts-layouts.test.ts`에:
  - `departLayout`: `items.length === dates.length`, `items[i].key === i`, `items` x가 오름차순, 출발일 뭉치 점의 `hl`이 출발일 번호, 기준선·요일 평균 점 `hl === −1`, `initial === −1`, 공휴일 출발일 항목 문장에 공휴일 이름(`h:…`)이 들어 있다.
  - `swarmLayout`: `items.length === 8`, 구간 점의 `hl` = 구간 번호, 선·마디 점 −1, `initial`이 평균이 가장 낮은 구간 번호.
  - `cloudLayout`: 예측 있는 날마다 항목 하나, 그날 점들(구름·예측가)의 `hl` = 날짜 번호, `initial === −1`.
  (문장은 배치 함수가 받는 문자열 함수로 만든다 — 테스트는 가짜 함수로 문장 조각이 들어가는지만 본다.)
- [ ] **Step 3: 구현** — 배치 함수의 문자열 인자에 `tip(v): string`를 더한다(차트마다 넘기는 값: 차트 1 `{ date, pct, holiday? }`, 차트 2 `{ bin, pct, n }`, 차트 4 `{ date, price, lo, hi }`). `departLayout`: 출발일 뭉치 점 `hl = i`, 항목 `{ key: i, x: cx/W, y: cy/H, text }`. `swarmLayout`: 구간 점 `hl = b`, 항목 x = 구간 가운데, y = 구간 평균 높이, `initial = 평균 최소 구간`. `cloudLayout`: 날짜 `i`의 점 `hl = i`, 항목 x = 날짜 x, y = 예측가 높이. 강조 색·흐림은 Task 1 값.
- [ ] **Step 4: 문구** — `content/*.json`의 `charts.depart.tip`·`charts.curve.tip`·`charts.band.tip`(자리표시), `charts.touch`(조작 층 이름 끝말, ko "값 살펴보기" / en "explore values" / ja "値を見る"). 예(ko):
  - depart.tip: `"{v.date} 출발 · 평균 대비 {v.pct}{v.holiday}"` (`holiday`는 있으면 `" · 성탄절"` 식으로 앞에 구분자를 붙여 넘긴다)
  - curve.tip: `"{v.bin}에 사면 같은 편 평균보다 {v.pct} · 관측 {v.n}건"`
  - band.tip: `"{v.date} 출발 · 예측가 {v.price} · 범위 {v.lo}~{v.hi}"`
  en·ja 같은 뜻, 담백하게. 날짜는 `Intl.DateTimeFormat(locale, { month:'short', day:'numeric', weekday:'short', timeZone:'UTC' })`, 금액은 기존 `money`(차트 4는 원 단위 — 기존 이름표와 같은 간략 표기), %는 기존 `signed`. `build.ts`에서 `interpolate(template, { v: {...} }, locale)`로 문장을 만든다(템플릿은 `ChartStrings.tip`으로 받는다 — `Charts.tsx`가 `t(\`charts.${b.id}.tip\`)`를 넘긴다. `t`가 `{v.…}` 자리표시를 채우려다 실패하면 데모 문구처럼 그대로 남기는 방식을 `src/lib/i18n.ts`에서 확인하고 따른다).
- [ ] **Step 5:** `npx vitest run tests/unit/charts-layouts.test.ts && npm run typecheck && npm test`(키 일치·숫자 금지 포함). 커밋 `feat(charts): layouts expose touchable items and highlight keys`.

### Task 3: 조작 층 — 포인터·터치·키보드·표시 상자

**Files:** `src/components/charts/ChartStage.tsx`, `src/styles/globals.css`, `tests/e2e/charts.spec.ts`

- [ ] **Step 1: e2e 먼저**(`tests/e2e/charts.spec.ts`, 3D 꺼짐 describe 안 — 2D에서 확실히 재기 위해 `reducedMotion: 'reduce'`):
  - 차트 1: 판 위 가운데로 마우스를 옮기면 `.chart-tip`이 보이고 문장에 "평균 대비"(ko)가 들어 있다. 조작 층(`[role="slider"]`)의 `aria-valuetext`가 표시 상자 문장과 같다. 판을 떠나면 `.chart-tip`이 숨는다.
  - 차트 2: 처음부터 세로선(`.chart-cursor`)과 표시 상자가 보이고 `aria-valuenow`가 가장 싼 구간. 조작 층에 초점 → `ArrowRight` → `aria-valuenow`가 1 커진다, `End` → 7, `Home` → 0.
  - 차트 4: 키보드 `Tab`으로 조작 층에 초점 → `ArrowRight` 두 번 → `aria-valuenow` 1(첫 항목 0에서 시작), 표시 상자에 "예측가".
  - axe: 조작 층이 있는 상태로 위반 없음(기존 axe 테스트가 그대로 통과).
  - 휴대폰(모바일 프로젝트): 차트 1을 가볍게 누르면 표시 상자가 보인다(`page.touchscreen.tap`).
- [ ] **Step 2: 구현**(`ChartStage.tsx`):
  - 판(`.chart-plot`) 안, 캔버스·이름표 위에 조작 층 `<div className="chart-touch" role="slider" tabIndex={0} …>`를 둔다(`items`가 있는 차트만). 루트 `.chart-stage`의 `aria-hidden`을 떼고, 대신 캔버스와 `.chart-labels`에 `aria-hidden="true"`를 단다(와플 그룹 이름표는 계속 숨김 — 5-3c에서 다룬다).
  - 상태: `sel`(강조 번호, 처음 `layout.initial ?? −1`). 바뀌면 `registry.setFocus(chartKey, sel)` + `paint.current(sel)`(와플처럼). 와플의 기존 `focus` 상태와 합친다(와플도 `sel` 하나로 — 그룹 이름표 마우스 올리기가 `setSel(gi)`).
  - 포인터: `pointermove`(마우스·펜) → 판 기준 x → `items`에서 x가 가장 가까운 항목(이진 탐색 또는 선형 — 항목 ≤ 180). `pointerleave` → 차트 1·4는 −1, 차트 2는 그대로. 터치: `DateStrip`과 같은 규칙(누른 자리 기억, 가로 8px 넘으면 끌기로 확정 + `setPointerCapture`, 가로로 끌지 않고 떼면 탭 = 그 자리 항목, `pointercancel`이면 아무것도). CSS `touch-action: pan-y`.
  - 키보드: ←/→(↑/↓도 같은 방향), Home/End, 항목 번호 순서로 이동, `preventDefault`. 차트 1·4에서 `sel === −1`인데 → 누르면 첫 항목.
  - 표시 상자 `.chart-tip`(`aria-hidden`, 문장 = `items[sel].text`): 위치 = 항목 x·y, 위쪽 12px, 판 안에 들어오게 좌우 끝을 자른다(상자 폭을 재서 `left`를 조정 — `useLayoutEffect`). 차트 2는 세로선 `.chart-cursor`(판 위에서 아래까지 1px, 글자색 알파 0.5)를 항목 x에.
  - `aria-valuenow = sel < 0 ? 0 : sel`, `aria-valuemin 0`, `aria-valuemax items.length − 1`, `aria-valuetext = sel < 0 ? undefined : items[sel].text`, `aria-label = 차트 제목 + " · " + charts.touch`(제목은 `Charts.tsx`가 넘긴다 — `ChartStage` props에 `label` 추가).
  - 판의 `pointer-events`: `.chart-stage`는 지금 `none`이다 — `.chart-touch`만 `auto`(와플 그룹 이름표처럼).
- [ ] **Step 3: CSS** — `.chart-touch { position:absolute; inset:0; cursor: crosshair; touch-action: pan-y; }`, 초점 링은 기존 `:focus-visible`(호박색)이 판 테두리로 보이게 `outline-offset: -2px`. `.chart-tip`(작은 판 — 이 사이트의 "판 없음" 원칙과 부딪히지 않게 아주 작게: `font: 500 11px var(--font-mono)`, 배경 `rgba(2,4,10,.85)`, 테두리 `var(--line)`, 둥근 4px, 안쪽 여백 4px 8px, `pointer-events: none`, 줄바꿈 없음). `.chart-cursor { position:absolute; top:0; bottom:0; width:1px; background: rgba(238,243,255,.5); pointer-events:none }`. 움직임 줄이기: 전환 없음.
- [ ] **Step 4:** `npm run build && npx playwright test tests/e2e/charts.spec.ts tests/e2e/site.spec.ts --reporter=line`. 눈 확인(실제 GPU, 3D 켜짐): 차트 1·2·4에 마우스를 올려 캡처 — 3D 점도 같이 강조되는지, 표시 상자가 판 안.
- [ ] **Step 5:** 커밋 `feat(charts): touch layer — hover, drag, keyboard and a value tip on charts 1, 2 and 4`.

### Task 4: 5-2에서 미룬 슬롯 튐

**Files:** `src/three/TerrainScene.tsx`(차트 슬롯 부분만), 테스트

- [ ] **Step 1: 원인** — 차트 A에서 지형 장면으로 나가면 `chartState.key`가 null이 된다. `uChart`가 1 → 0으로 줄어드는 동안(아직 A가 보이는 중) 차트 B로 들어오면 "지형에서 들어옴"으로 보고 **지금 보이는 슬롯**에 B를 써서 A의 점이 B 자리로 튄다.
- [ ] **Step 2: 고침** — 마지막으로 슬롯에 쓴 차트 키를 따로 둔다(`lastWritten = { key, slot }`, 지형으로 나가도 지우지 않는다). 새 차트가 `lastWritten.key`와 다르면 반대 슬롯에 쓴다. 같은 차트가 다시 배치(창 크기)되면 지금 슬롯. 순수 함수로 빼서(`chartTargets.ts`에 `pickSlot(last: { key: ChartKey | null; slot: 0|1 }, next: ChartKey): 0|1`) 단위 테스트: A→(지형)→B는 반대 슬롯, A→(지형)→A는 같은 슬롯, 처음(null)은 0.
- [ ] **Step 3:** "빠르게 스크롤해 차트를 벗어날 때 잠깐 번짐"은 재현을 시도해 본다(실제 GPU, 차트 1 → 차트 2를 빠르게 휠). 재현되면 원인과 함께 보고(고치지 못하면 기록만), 안 되면 "재현 안 됨"으로 기록.
- [ ] **Step 4:** 테스트·빌드, 커밋 `fix(3d): chart → terrain → other chart writes the hidden slot (no jump)`.

### Task 5: 전체 검사·기록

- [ ] `npm run typecheck && npm test && npm run build && npm run size && npm run e2e`(알려진 흔들림은 CLAUDE.md 참고, 한 번 더 돌려 본다).
- [ ] 설계 문서 `2026-09-25-page-restructure-design.md`의 `## 구현 결과 (계획 5-3a)` 다음에 `## 구현 결과 (계획 5-3b)`: 강조 번호 일반화, 조작 규칙 최종, 표시 상자 모양, 접근성 구조 변경(루트 aria-hidden → 캔버스·이름표), 슬롯 튐 원인·수정, 번짐 재현 결과, 검사 숫자.
- [ ] `CLAUDE.md`: 현재 상태 표에 5-3b 줄(PR 대기), 다음 할 일 1번의 b를 완료로, 남은 것 c(와플 SHAP 벌떼). 5-2에서 미룬 작은 것 줄 정리.
- [ ] 커밋 `chore: record plan 5-3b`.
