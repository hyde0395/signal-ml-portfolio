# 계획 5-3a: 배경 점이 마우스에 반응 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 모든 3D 장면에서 배경 점이 마우스 포인터 주위로 살짝 비켜나고(차트 장면은 약하게), 휴대폰은 누른 곳에서 물결이 한 번 퍼진다.

**Architecture:** 설계(2026-09-25 §4.1 "점이 마우스에 반응")는 포인터를 장면 평면에 투영하라고 했지만, 이 계획은 **화면 공간(NDC)에서 민다**. 점의 화면 위치(`gl_Position`)를 구한 뒤 포인터와의 거리로 바깥쪽 이동량을 더한다. 지형(xz 평면)·지도·차트(z=0 평면)·공항처럼 장면마다 평면이 달라도 식 하나로 되고, 3D 청크 여유(약 6KB)를 거의 쓰지 않는다. 이동량 식은 순수 모듈(`pointerField.ts`)에 두어 단위 테스트하고, 셰이더에는 같은 상수를 문자열로 넣는다(`pointStyle.ts`·`FOCUS_DIM`과 같은 방식). 점마다 상태를 두지 않으므로 "제자리로 돌아오기"는 포인터 세기(`uPointerOn`)와 위치(`uPointer`)를 부드럽게 따라가게 해서 만든다.

**Tech Stack:** three.js 셰이더(React Three Fiber) · Vitest · Playwright

**설계:** `docs/superpowers/specs/2026-09-25-page-restructure-design.md` §4.1 (5-3은 a 점 반응 → b 차트 만지기 → c 와플 SHAP 벌떼 세 계획으로 나눠 진행, 2026-09-29)

## 모든 작업 공통 규칙

- 브랜치 `plan-5-3-interaction`(이미 있음, main 위). main에 직접 커밋하지 않는다.
- **코드 주석은 한국어**. 새 파일은 맨 위에 무엇을 하는 파일인지 한두 줄, 이유가 드러나지 않는 로직에는 "왜". 한 줄씩 옮겨 적는 주석은 달지 않는다. **GLSL 템플릿 문자열 안에는 주석을 넣지 않는다** — 압축되지 않고 3D 청크에 그대로 실린다. 셰이더 설명은 `shaders.ts`에서 `export const vertexShader` 위 JS 주석 묶음에 적는다(지금 파일이 그렇게 되어 있다).
- 커밋 이메일은 저장소 설정(noreply) 그대로, 메시지 끝에 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- e2e는 `out/`을 띄워 돈다 — e2e 전에 `npm run build`.
- 3D 청크 250KB(gzip) 이하(`npm run size`, 지금 243.9KB). 초기 JS 150KB 이하. three는 초기 청크에서 import 금지.

## 파일 지도

| 파일 | 할 일 |
|---|---|
| `src/three/pointerField.ts` (새) | 밀기·물결 상수와 순수 함수(`pushAmount`, `rippleAmount`, `toNdc`) |
| `tests/unit/pointer-field.test.ts` (새) | 위 테스트 |
| `src/three/shaders.ts` | 유니폼 4개, `gl_Position` 뒤 화면 공간 이동, 설명 주석 |
| `src/three/TerrainPoints.tsx` | 포인터 듣기(창 전체), 유니폼 갱신 |
| `tests/e2e/terrain.spec.ts` | 마우스를 움직여도 3D가 켜진 채 오류 없음(연기 검사) |
| 설계 문서 `2026-09-25-page-restructure-design.md`, `CLAUDE.md` | 구현 결과 기록 |

---

### Task 1: 밀기·물결 순수 함수

**Files:** Create `src/three/pointerField.ts`, Test `tests/unit/pointer-field.test.ts`

모양(설계 §4.1): 반경 안의 점을 포인터 반대쪽으로 민다. 가운데에서 가장 세게, 반경 끝에서 0(부드럽게). 차트 장면은 세기를 줄인다. 물결: 누른 곳에서 고리가 퍼져 나가며 고리 근처 점을 바깥으로 밀고, 시간이 지나면 사라진다.
단위: "정사각 화면 단위" — NDC y(−1..1)와 같은 크기로, x는 화면 비율(가로/세로)을 곱해 맞춘다. 그래야 가로로 긴 화면에서도 밀리는 영역이 원이다.

- [ ] **Step 1: 실패하는 테스트**

```ts
// 배경 점 밀기·물결(설계 2026-09-25 §4.1, 계획 5-3a). 셰이더와 같은 식을 순수 함수로 검사한다
import { describe, expect, it } from 'vitest';
import { PUSH, RIPPLE, pushAmount, rippleAmount, toNdc } from '@/three/pointerField';

describe('pushAmount', () => {
  it('포인터 바로 위에서 가장 세고 반경 밖은 0', () => {
    expect(pushAmount(0)).toBeCloseTo(PUSH.strength, 6);
    expect(pushAmount(PUSH.radius)).toBe(0);
    expect(pushAmount(PUSH.radius * 2)).toBe(0);
  });
  it('멀어질수록 줄어든다', () => {
    expect(pushAmount(PUSH.radius * 0.25)).toBeGreaterThan(pushAmount(PUSH.radius * 0.5));
    expect(pushAmount(PUSH.radius * 0.5)).toBeGreaterThan(pushAmount(PUSH.radius * 0.75));
  });
  it('이동량은 반경보다 작다 — 점이 포인터를 넘어 반대편으로 튀지 않는다', () => {
    for (let d = 0; d <= PUSH.radius; d += PUSH.radius / 20) expect(pushAmount(d)).toBeLessThan(PUSH.radius);
  });
});

describe('rippleAmount', () => {
  it('고리 위(거리 = 속도 × 경과)에서 가장 세다', () => {
    const age = 0.3;
    const ring = RIPPLE.speed * age;
    expect(rippleAmount(ring, age)).toBeGreaterThan(rippleAmount(ring + RIPPLE.width, age));
    expect(rippleAmount(ring, age)).toBeGreaterThan(rippleAmount(ring - RIPPLE.width, age));
  });
  it('시간이 지나면 사라진다', () => {
    expect(rippleAmount(RIPPLE.speed * RIPPLE.life, RIPPLE.life)).toBe(0);
    expect(rippleAmount(0.1, -1)).toBe(0); // 물결이 없을 때(음수 경과)
  });
});

describe('toNdc', () => {
  it('화면 px → NDC(y는 위가 +)', () => {
    expect(toNdc(0, 0, 800, 600)).toEqual([-1, 1]);
    expect(toNdc(800, 600, 800, 600)).toEqual([1, -1]);
    expect(toNdc(400, 300, 800, 600)).toEqual([0, 0]);
  });
});
```

- [ ] **Step 2: 실패 확인** — `npx vitest run tests/unit/pointer-field.test.ts` → FAIL(모듈 없음)

- [ ] **Step 3: 구현** — `src/three/pointerField.ts`

```ts
// 배경 점이 포인터에 반응하는 모양(설계 2026-09-25 §4.1, 계획 5-3a). 셰이더(shaders.ts)는 이 값을 문자열로
// 박아 넣고, 단위 테스트는 같은 식을 순수 함수로 검사한다(pointStyle.ts와 같은 방식).
// 거리·이동량 단위는 "정사각 화면 단위": NDC y(−1..1) 크기에 x는 화면 비율을 곱해 맞춘 값 — 가로로 긴 화면에서도
// 밀리는 영역이 타원이 아니라 원이 되게 한다.

// radius: 영향 반경(화면 높이의 약 9%). strength: 포인터 바로 위 점의 이동량. chartScale: 차트 장면에서 곱할 값 —
// 차트는 점 위치가 곧 데이터라 모양이 읽히도록 덜 민다
export const PUSH = { radius: 0.18, strength: 0.045, chartScale: 0.3 } as const;
// 휴대폰 물결: speed(단위/초)로 퍼지는 고리, 고리 두께 width, 세기 amp, life초 뒤 사라짐
export const RIPPLE = { speed: 1.6, width: 0.12, amp: 0.05, life: 0.9 } as const;

const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

// 포인터에서 거리 d인 점을 바깥으로 미는 양. 가운데 가장 세고 반경에서 0(두 번 부드럽게 줄여 가장자리가 튀지 않게)
export function pushAmount(d: number): number {
  const k = 1 - smooth(0, PUSH.radius, d);
  return PUSH.strength * k * k;
}

// 누른 곳에서 age초 지난 물결이 거리 d인 점을 미는 양. 고리(거리 = speed·age) 근처만, 시간에 따라 줄어든다
export function rippleAmount(d: number, age: number): number {
  if (age < 0 || age >= RIPPLE.life) return 0;
  const ring = RIPPLE.speed * age;
  const band = 1 - smooth(0, RIPPLE.width, Math.abs(d - ring));
  return RIPPLE.amp * band * (1 - age / RIPPLE.life);
}

// 화면 px(clientX·Y) → NDC. 화면은 아래로 +, NDC는 위로 +
export function toNdc(x: number, y: number, vw: number, vh: number): [number, number] {
  return [(x / vw) * 2 - 1 + 0, 1 - (y / vh) * 2 + 0]; // + 0: -0을 0으로
}
```

- [ ] **Step 4: 통과 확인** — `npx vitest run tests/unit/pointer-field.test.ts` → PASS(6개). `npm run typecheck`.

- [ ] **Step 5: 커밋**

```bash
git add src/three/pointerField.ts tests/unit/pointer-field.test.ts
git commit -m "feat(3d): pointer push and ripple shape (pure)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: 셰이더 — 화면 공간에서 밀기·물결

**Files:** Modify `src/three/shaders.ts`, `src/three/TerrainPoints.tsx`(유니폼 기본값만)

- [ ] **Step 1: 유니폼 선언** — 정점 셰이더 템플릿의 `uniform float uFocusDist;` 바로 다음 줄에 (주석 없이) 추가:

```glsl
  uniform vec2 uPointer;
  uniform float uPointerOn;
  uniform float uAspect;
  uniform vec3 uRipple;
```

- [ ] **Step 2: 설명 주석** — `export const vertexShader` 위 JS 주석 묶음의 유니폼 설명 목록에 네 줄을 더한다(기존 목록 형식을 따른다):

```ts
// - uPointer: 포인터 위치(NDC). TerrainPoints가 부드럽게 따라가게 넣는다 — 점마다 상태가 없어서, 포인터가 움직이면
//   밀린 자리가 함께 옮겨 가며 지나간 자리의 점이 제자리로 돌아온다
// - uPointerOn: 밀기 세기 0..1. 마우스가 창 안에서 움직이면 1, 창을 나가거나 터치·캡처면 0(부드럽게)
// - uAspect: 화면 가로/세로 — 밀기 영역을 원으로 만든다(pointerField.ts의 "정사각 화면 단위")
// - uRipple: 휴대폰 물결 (x, y = 누른 곳 NDC, z = 누른 뒤 흐른 초, 없으면 음수)
```

그리고 `gl_Position` 관련 설명 자리(파일의 기존 설명 순서에 맞는 곳)에 추가:

```ts
// 포인터 밀기·물결(설계 2026-09-25 §4.1, 계획 5-3a): 장면 평면에 투영하지 않고 화면 공간(NDC)에서 민다.
// 지형(xz)·지도·차트(z=0)·공항처럼 장면마다 평면이 달라도 식 하나로 되고, 셰이더가 짧다(3D 청크 여유).
// 식·상수는 pointerField.ts와 같다(단위 테스트). 차트 장면은 uChart만큼 PUSH.chartScale로 줄인다.
// 이동은 w를 곱해 클립 좌표에 더한다 — 원근 나눗셈 뒤 화면에서 정확히 그만큼 옮겨진다
```

- [ ] **Step 3: 이동 코드** — 파일 맨 위 import에 `import { PUSH, RIPPLE } from './pointerField';`를 더하고(`glslFloat as f`는 이미 import돼 있다), 정점 셰이더의 `gl_Position = projectionMatrix * mv;` 바로 다음 줄에 추가:

```glsl
    vec2 ndc = gl_Position.xy / gl_Position.w;
    vec2 dv = (ndc - uPointer) * vec2(uAspect, 1.0);
    float dp = length(dv);
    float kp = 1.0 - smoothstep(0.0, ${f(PUSH.radius)}, dp);
    float push = ${f(PUSH.strength)} * kp * kp * uPointerOn * mix(1.0, ${f(PUSH.chartScale)}, uChart);
    vec2 dr = (ndc - uRipple.xy) * vec2(uAspect, 1.0);
    float drl = length(dr);
    float rip = 0.0;
    if (uRipple.z >= 0.0 && uRipple.z < ${f(RIPPLE.life)}) {
      rip = ${f(RIPPLE.amp)} * (1.0 - smoothstep(0.0, ${f(RIPPLE.width)}, abs(drl - ${f(RIPPLE.speed)} * uRipple.z))) * (1.0 - uRipple.z / ${f(RIPPLE.life)});
    }
    vec2 off = (dp > 1e-4 ? dv / dp * push : vec2(0.0)) + (drl > 1e-4 ? dr / drl * rip : vec2(0.0));
    gl_Position.xy += off / vec2(uAspect, 1.0) * gl_Position.w;
```

(변수 이름 `ndc`, `dv`, `dp`, `kp`, `push`, `dr`, `drl`, `rip`, `off`가 이 셰이더의 다른 이름과 겹치지 않는지 확인한다. 겹치면 이름만 바꾼다. 아래쪽의 숨은 점 처리(`vAlpha < 0.003`이면 `gl_Position`을 화면 밖으로)는 그대로 두면 이 이동보다 나중에 덮어쓰므로 문제없다.)

- [ ] **Step 3b: 유니폼 기본값** — 셰이더가 선언한 유니폼은 재질에도 있어야 한다(없으면 0으로 읽혀 `uRipple.z = 0`이 "지금 막 누른 물결"이 된다). `src/three/TerrainPoints.tsx`의 `uniforms` 객체에서 `uFocusDist` 다음에:

```ts
    // 포인터 밀기·물결(계획 5-3a). 처음엔 꺼짐(uPointerOn 0), 물결 없음(음수)
    uPointer: { value: new THREE.Vector2(0, 0) },
    uPointerOn: { value: 0 },
    uAspect: { value: 1 },
    uRipple: { value: new THREE.Vector3(0, 0, -1) },
```

- [ ] **Step 4: 타입·빌드·용량** — `npm run typecheck && npm test && npm run build && npm run size`. 3D 청크 ≤ 250KB(0.5KB 안팎 늘어난다). 이 시점에는 값이 기본값이라 화면이 전과 같아야 한다.

- [ ] **Step 5: 커밋**

```bash
git add src/three/shaders.ts src/three/TerrainPoints.tsx
git commit -m "feat(3d): shader pushes points away from the pointer in screen space; touch ripple

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

(이 커밋만으로는 값이 기본값이라 화면이 바뀌지 않는다 — Task 3에서 값을 넣는다.)

---

### Task 3: 포인터 듣기와 유니폼 갱신

**Files:** Modify `src/three/TerrainPoints.tsx`

규칙:
- 마우스·펜(`pointerType !== 'touch'`)이 창 안에서 움직이면 위치를 기록하고 세기 목표 1. 창을 나가면(`document`의 `pointerleave`… 실제로는 `window`의 `mouseout`에서 `relatedTarget === null`) 또는 탭이 숨으면 목표 0.
- 터치: `pointerdown`(pointerType `touch`)마다 그 자리에서 물결을 시작한다(누른 순간의 시각 기록). 터치로는 밀기를 켜지 않는다(계속 밀면 스크롤을 방해한다 — 설계 §4.1).
- 캡처 모드(`instant`)면 모두 끈다(대체 이미지가 매번 같아야 한다).
- 위치는 빠르게(DAMP 10), 세기는 0.4초 남짓으로(DAMP 6) 부드럽게 따라간다. "튕김 없음"(expo.out 느낌) — `THREE.MathUtils.damp`는 지수 감쇠라 넘치지 않는다.

- [ ] **Step 1: 유니폼** — Task 2 Step 3b에서 이미 넣었다. 건너뛴다.

- [ ] **Step 2: 듣기** — 파일 위쪽 import에 `import { toNdc } from './pointerField';`를 더하고, 컴포넌트 안(geometry `useEffect` 다음)에:

```ts
  // 포인터(계획 5-3a): 캔버스는 pointer-events: none이라 창 전체에서 듣는다(CameraRig와 같은 이유)
  const pointer = useRef({ x: 0, y: 0, on: 0, rippleAt: -1, rx: 0, ry: 0 });
  useEffect(() => {
    if (instant) return;
    const p = pointer.current;
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return; // 터치로 계속 밀면 스크롤을 방해한다 — 물결만(설계 §4.1)
      [p.x, p.y] = toNdc(e.clientX, e.clientY, window.innerWidth, window.innerHeight);
      p.on = 1;
    };
    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') return;
      [p.rx, p.ry] = toNdc(e.clientX, e.clientY, window.innerWidth, window.innerHeight);
      p.rippleAt = performance.now();
    };
    // 창 밖으로 나가면(relatedTarget 없음) 밀기를 끈다 — 창 가장자리에 멈춘 채 점이 계속 비켜 있지 않게
    const onOut = (e: MouseEvent) => { if (!e.relatedTarget) p.on = 0; };
    const onHide = () => { if (document.hidden) p.on = 0; };
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onDown, { passive: true });
    window.addEventListener('mouseout', onOut);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('mouseout', onOut);
      document.removeEventListener('visibilitychange', onHide);
    };
  }, [instant]);
```

(`useRef`는 이미 import돼 있다.)

- [ ] **Step 3: 매 프레임** — `useFrame` 안, `u.uWave.value = …` 줄 다음에:

```ts
    // 포인터: 위치는 빠르게, 세기는 천천히 따라간다 — 점마다 상태가 없으므로 이 부드러움이 "비켰다가 제자리로"를 만든다
    const p = pointer.current;
    u.uAspect.value = state.size.width / Math.max(1, state.size.height);
    const pv = u.uPointer.value as THREE.Vector2;
    if (u.uPointerOn.value < 0.01 && p.on) pv.set(p.x, p.y); // 막 켜질 때는 그 자리에서 시작(화면을 가로질러 날아오지 않게)
    pv.x = THREE.MathUtils.damp(pv.x, p.x, 10, delta);
    pv.y = THREE.MathUtils.damp(pv.y, p.y, 10, delta);
    u.uPointerOn.value = instant ? 0 : THREE.MathUtils.damp(u.uPointerOn.value, p.on, 6, delta);
    const rv = u.uRipple.value as THREE.Vector3;
    rv.set(p.rx, p.ry, instant || p.rippleAt < 0 ? -1 : (performance.now() - p.rippleAt) / 1000);
```

- [ ] **Step 4: 검사** — `npm run typecheck && npm test && npm run build && npm run size`(3D 청크 ≤ 250KB).

- [ ] **Step 5: 눈 확인(실제 GPU 권장)** — 소프트웨어 렌더러(헤드리스 swiftshader)는 fps가 낮아 3D가 몇 초 뒤 꺼진다. 가능하면 Playwright를 headed(`headless: false`, 창을 화면 밖 `--window-position=-2000,0`)로 띄워 실제 GPU로 본다. `out/`을 4173에 띄운 뒤:
  - 1280×720, `/`에서 3D가 켜지면 `#project`로 스크롤, 1.5초 뒤 마우스를 지형 위(예: 900, 350)로 옮기고 0.5초 뒤 캡처 → 포인터 주위에 둥근 빈 자리. 이어서 마우스를 점이 없는 먼 곳(예: 60, 650 — 왼쪽 아래 글 옆)으로 옮기고 1초 뒤 캡처 → 첫 캡처의 빈 자리가 다시 채워져 있다(비켰던 점이 제자리로).
  - 차트 장면(`[data-scene="chartDepart"]`로 스크롤, 판이 고정된 뒤) 같은 방법 → 비켜나는 양이 눈에 띄게 작고 달력 모양이 유지된다.
  - 휴대폰 크기(390×844, `hasTouch: true`) `page.touchscreen.tap(195, 400)` 직후 0.15초·0.4초 캡처 → 고리 모양으로 퍼진 흔적.
  - 캡처 경로와 관찰을 보고한다. 너무 약하거나 세면 `PUSH`·`RIPPLE` 상수만 조정하고 Task 1 테스트는 상수 기준이라 그대로 통과해야 한다. 조정했다면 값과 이유를 보고.

- [ ] **Step 6: 커밋**

```bash
git add src/three/TerrainPoints.tsx
git commit -m "feat(3d): points react to the mouse in every scene; ripple on touch

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: 연기 검사 e2e와 기록

**Files:** Modify `tests/e2e/terrain.spec.ts`, 설계 문서, `CLAUDE.md`

- [ ] **Step 1: e2e** — `tests/e2e/terrain.spec.ts`의 기존 테스트 형식을 따라(파일을 먼저 읽는다) 한 개 추가: 3D가 켜진 뒤(`html[data-3d="on"]`, 소프트웨어 렌더러에서 꺼지는 환경이면 기존 테스트처럼 `test.skip`) 마우스를 판 위 몇 곳으로 움직이고(`page.mouse.move`, steps 5) 0.5초 기다린 뒤, `pageerror`가 없고 `data-3d`가 여전히 `on`인지 본다. 이름: `'마우스를 움직여도 3D가 켜진 채 오류가 없다(점 밀기)'`.

```bash
npm run build && npx playwright test tests/e2e/terrain.spec.ts --reporter=line
```

- [ ] **Step 2: 전체 검사** — `npm run typecheck && npm test && npm run build && npm run size && npm run e2e`. `board.spec` "화면에 들어오면 넘어가고…"는 main에서도 가끔 흔들린다 — 실패하면 한 번 다시 돌린다.

- [ ] **Step 3: 설계 문서** — `docs/superpowers/specs/2026-09-25-page-restructure-design.md`의 `## 구현 결과 (계획 5-2)` 절 다음, `## 9. 범위 밖` 앞에 `## 구현 결과 (계획 5-3a)`를 더한다: 화면 공간 방식(설계 §4.1의 "장면 평면 투영"에서 바꾼 이유), 최종 `PUSH`·`RIPPLE` 값, 터치는 물결만, 캡처 모드 끔, 3D 청크 크기, 눈 확인 결과, 검사 숫자. 그리고 5-3을 a/b/c 세 계획으로 나눴다는 한 줄.

- [ ] **Step 4: CLAUDE.md** — "현재 상태" 표에 `| 5-3a 점 반응 | 배경 점이 마우스 주위로 비켜남(차트는 약하게), 휴대폰은 누른 곳 물결 | \`2026-09-29-plan-5-3a-pointer.md\` | ✅ (PR 대기) |`. "다음 세션에서 할 일" 1번(계획 5-3)의 "점이 마우스에 반응" 줄을 지우고, 5-3을 a(점 반응, 이번)·b(차트 만지기 + 5-2 검토에서 미룬 슬롯 튐·번짐)·c(와플 SHAP 벌떼 — 추출 가능 확인: 모델 입력 33개 그대로, `booster.predict(pred_contribs=True)`, 모델 로드 약 17초) 세 계획으로 나눴다고 적는다.

- [ ] **Step 5: 커밋**

```bash
git add tests/e2e/terrain.spec.ts docs/superpowers/specs/2026-09-25-page-restructure-design.md CLAUDE.md
git commit -m "test: pointer smoke e2e; record plan 5-3a

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
