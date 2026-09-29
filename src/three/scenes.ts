// 장면 표: 섹션·블록마다 카메라 위치와 셰이더 uniform 목표값을 정한다.
// 캔버스는 이 값으로 "부드럽게 다가가기"만 하므로, 연출을 바꾸려면 이 표만 고치면 된다.
export type SceneKey = 'hero' | 'about' | 'problem' | 'dataBoard' | 'features' | 'chartDepart' | 'chartCurve'
  | 'bubble' | 'validation' | 'chartCloud' | 'limits' | 'demo' | 'contact';

export type SceneState = {
  camera: [number, number, number];
  target: [number, number, number];
  assemble: number; // 0 = 흩어짐, 1 = 목표 모양
  map: number;      // 0 = 지형, 1 = 한·일 지도
  noise: number;    // 흐린 잡음 점의 불투명도 배율
  removed: number;  // 제거 레이어(9,387행) 보이기
  drop: number;     // 제거 레이어가 떨어진 정도
  chart: number;    // 1 = 점이 그림 판 배치로 모인다(차트 장면). TerrainScene은 배치가 준비됐을 때만 1로 둔다
  slot: number;     // 차트 배치 두 벌(A=0, B=1) 중 보일 쪽. 장면 표에서는 0이고 TerrainScene이 정한다
  dim: number;      // 모든 지형·지도 점의 알파 배율
  shift: number;    // 차트 배치 전체의 세계 y 이동량. 장면 표에서는 0이고 TerrainScene이 판 위치로 정한다(chartShiftY)
  airport: number;  // 1 = 밤의 공항(첫 화면), 0 = 그 밖
  sway: number;     // 첫 화면 마우스 시차 크기(월드 단위)
  rows: number;     // 1 = 지형 점이 ① 물결 줄 배치(data.ts buildWave)로 모인다
  soft: number;     // 1 = 지형 점을 은은하게(크기·알파 배율 pointStyle SOFT_POINT) — ① 글 뒤 대비를 지킨다
  fov: number;      // 세로 화각(도). CameraRig가 이 값으로 옮겨 간다 — 첫 화면만 HERO_FOV, 나머지는 CHART_FOV
  follow?: boolean; // 전환 구간 안 — 점·카메라가 스크롤을 바짝 따라가게 감쇠를 빠르게
  // 전환이 마지막으로 움직인 시각 + 600ms(performance.now 기준). 휠 한 번에 y1(또는 y0)을 넘어가면 follow가
  // 바로 꺼져 남은 거리를 느린 감쇠로 한참 흘러가므로, 이 시각까지는 빠른 감쇠를 유지한다(followActive)
  followUntil?: number;
};

// 차트 장면 카메라: 원점을 정면(z축)에서 본다. 그림 판의 화면 px ↔ z=0 평면 좌표가 이 두 값으로 정해지므로
// (three/chartTargets.ts) TerrainScene의 Canvas 카메라 fov도 CHART_FOV를 쓴다
export const CHART_DISTANCE = 24;
export const CHART_FOV = 40;
// 첫 화면 공항만 화각 45°(설계 2026-09-29 §8): 시안 카메라(초점 거리 1.2·H → 세로 화각 약 45.2°)와 같은 원근이라야
// 활주로 불빛 간격·소실점이 시안과 겹친다. 차트 장면은 판 px ↔ 월드 대응이 CHART_FOV에 묶여 있어 건드리지 않고,
// ①~④의 다른 장면도 지금 구도(카메라 C 등 40°에서 고른 값)를 지키려고 40° 그대로 둔다
export const HERO_FOV = 45;
const CHART = { camera: [0, 0, CHART_DISTANCE] as SceneState['camera'], target: [0, 0, 0] as SceneState['target'], chart: 1, noise: 0 };

const base = { assemble: 1, map: 0, noise: 1, removed: 0, drop: 0, chart: 0, slot: 0, dim: 1, shift: 0, airport: 0, sway: 0, rows: 0, soft: 0, fov: CHART_FOV };

// 밤의 공항(설계 2026-09-28 §4.2): A = 터미널 창가(눈높이 약 42m), B = 땅 가까이(약 12m). 같은 방향을 본다.
// 값은 시안(mockups/2026-09-28/01-night-airport.html)의 카메라를 사이트 좌표(airport.ts K·z 뒤집기)와 fov 45°(HERO_FOV)로
// 옮긴 것. 방향(yaw 0.2)은 그대로, 목표점 y만 지평선이 시안과 같은 높이(A 39.8%, B 36.6% — B는 시안이 화면 중심을
// 0.33으로 올려 둔 것을 기울기로 옮겼다)에 오게 정했다(horizonFrac 단위 테스트). 40° 시절엔 y가 −0.321 / −0.85였다
export const AIRPORT_CAM = {
  a: { camera: [-1.2, 0.42, 1.6] as SceneState['camera'], target: [0.781, -0.4247, -8.174] as SceneState['target'] },
  b: { camera: [-1.2, 0.12, 1.6] as SceneState['camera'], target: [0.777, -0.9847, -8.154] as SceneState['target'] },
};

// 세로 화면 전용(Task 9 스크린샷으로 맞춘 값): 가로 시야가 좁아 활주로 소실점이 화면 오른쪽 밖으로 나간다.
// 목표점 x를 오른쪽으로 밀어 카메라가 같은 자리에서 소실점 쪽으로 살짝 돌아보게 한다(이름 쪽 불빛은 그대로 낮게 유지)
const PORTRAIT_HERO_TARGET_DX = 3.2;

export const SCENES: Record<SceneKey, SceneState> = {
  // 첫 화면: 밤의 공항. 진행도(내려앉기)는 sceneFor가 A→B로 보간(설계 2026-09-28 §4.2)
  hero: { ...base, camera: AIRPORT_CAM.a.camera, target: AIRPORT_CAM.a.target, airport: 1, sway: 0.06, noise: 0, fov: HERO_FOV },
  // ①: 카메라 C(설계 2026-09-29 §4·§6) — 앞쪽 대각선 높은 곳에서 물결 줄 전체를 넓게 내려다본다. 잡음은 숨기고
  // 점을 은은하게(soft) 둬서, 먼 쪽 흐린 점이 왼쪽 글 뒤를 지나가도 대비를 지킨다(시안 실측 8.4/5.5:1)
  about: { ...base, camera: [13, 9, 15], target: [1, 0, 2], noise: 0, rows: 1, soft: 1 },
  // ② 화면 1: 위에서 내려다본 한·일 지도와 노선 궤적. 데스크톱은 왼쪽에 글 카드가 얹히므로
  // 카메라·목표점을 함께 x=-4.5로 옮겨(같은 방향을 보되 옆으로 이동) 지도 전체가 카드 오른쪽에 오게 한다
  problem: { ...base, camera: [-4.5, 16, 7], target: [-4.5, 0, 0], map: 1 },
  // ② 화면 2: 같은 지도를 멀리서 내려다보고 점을 흐리게 한다. 판 없는 보드의 작은 글자가 지도 점과 섞이지
  // 않게 하는 것이 이 장면의 목적이다(설계 §3.2, 2026-09-27)
  dataBoard: { ...base, camera: [0, 30, 14], target: [0, 0, 0], map: 1, dim: 0.32 }, // 0.16은 지도가 너무 흐려 보여 올림(2026-09-29 시안 B 선택)
  features: { ...base, ...CHART },
  chartDepart: { ...base, ...CHART },
  chartCurve: { ...base, ...CHART },
  // 차트 3: 제거 레이어가 높이 떠 있다가 떨어진다(drop은 sceneFor가 진행도로 채움)
  bubble: { ...base, camera: [2, 9, 17], target: [-5, 2.5, 0], removed: 1 },
  validation: { ...base, camera: [-5, 22, 0.1], target: [-5, 0, 0], noise: 0.5 },
  chartCloud: { ...base, ...CHART },
  limits: { ...base, camera: [-5, 12, 26], target: [-5, 0, 0], noise: 0.7 },
  // 데모·연락처: 조작 화면이 주인공이라 지형은 멀리 물러나 잡음을 줄이고 흐리게 둔다(글 뒤 판이 없다)
  demo: { ...base, camera: [-5, 16, 30], target: [-5, 0, 0], noise: 0.3, dim: 0.45 },
  contact: { ...base, camera: [-5, 16, 30], target: [-5, 0, 0], noise: 0.3, dim: 0.45 },
};

const PORTRAIT_DISTANCE = 1.6; // 세로 화면은 시야가 좁아 같은 구도를 담으려면 더 물러나야 한다

// 세로 화면 전용 카메라·목표점. 데스크톱은 왼쪽 글을 피하려고 x를 옮겼지만(problem −4.5, 글 쪽 장면 −5),
// 세로 화면은 글이 아래쪽에 있어 옆으로 밀 필요가 없고 그대로 밀면 지형·지도 절반이 잘린다.
// 대신(휴대폰은 글이 화면 아래쪽) 글 쪽 장면은 카메라·목표점의 y를 함께 내려 지형이 화면 위쪽
// 절반에서 보이게 한다 — 카메라−목표점 벡터(거리·각도)는 그대로라 세로 화면 1.6배 검사에 안 걸린다.
// validation만 예외: 카메라가 거의 수직으로 내려다보므로(camera [0,22,0.1] → 거의 z=0.1, target z=0)
// y를 내려도 점이 화면에서 옆으로 옮겨지지 않고 그냥 살짝 확대(약 9%)될 뿐이라 y 이동을 빼고 원래 값을 쓴다
const PORTRAIT_OVERRIDE: Partial<Record<SceneKey, { camera: SceneState['camera']; target: SceneState['target'] }>> = {
  problem: { camera: [0, 16, 7], target: [0, 0, 0] },
  // ①: 카메라−목표점 벡터가 데스크톱과 다르다(세로 화면에서 물결 줄이 화면 위쪽에 넓게 깔리도록 시안에서 따로 고른 값).
  // 1.6배 물러남은 이 값 위에 그대로 적용된다(시안이 본 모습과 같게)
  about: { camera: [11, 6, 15], target: [3, -3, 2] },
  // bubble: 목표점을 데스크톱에서 3만큼만 내리면(다른 장면과 같은 폭) −0.5에 그친다 — 데스크톱 목표점 y가
  // 이미 2.5로 높기 때문(제거 레이어가 높이 뜬 모습을 보여주려고). 그 −0.5는 화면 중앙 바로 아래라, 문단이
  // 바닥에 붙는 세로 화면에서 제거 레이어가 떨어지는 도중(uDrop 중간값, 아직 알파가 남아 있다)의 점이
  // 문단 뒤를 지나가며 대비 화소 검사를 깼다(e2e 5회 반복 모두 p99 1.3~1.4:1로 실패, 2026-09-28).
  // limits·demo·contact처럼 목표점을 −3까지 내려 문단 영역을 완전히 벗어나게 한다(벡터는 그대로 유지)
  bubble: { camera: [7, 3.5, 17], target: [0, -3, 0] },
  validation: { camera: [0, 22, 0.1], target: [0, 0, 0] },
  limits: { camera: [0, 9, 26], target: [0, -3, 0] },
  demo: { camera: [0, 13, 30], target: [0, -3, 0] },
  contact: { camera: [0, 13, 30], target: [0, -3, 0] },
};

export function isChartScene(key: SceneKey): boolean {
  return SCENES[key].chart === 1;
}

export function sceneFor(key: SceneKey, progress: number, portrait: boolean): SceneState {
  const s = SCENES[key];
  const p = Math.min(1, Math.max(0, progress));
  if (key === 'hero') {
    // 공항: 진행도 = 내려앉은 정도(TerrainScene이 스크롤로 계산). 세로 화면은 같은 방향에서 조금 물러나 넓게 본다
    const e = smooth(p);
    const lerp3 = (u: number[], v: number[]) => u.map((x, i) => x + (v[i] - x) * e) as [number, number, number];
    let camera = lerp3(AIRPORT_CAM.a.camera, AIRPORT_CAM.b.camera);
    let target = lerp3(AIRPORT_CAM.a.target, AIRPORT_CAM.b.target);
    if (portrait) {
      target = target.map((v, i) => (i === 0 ? v + PORTRAIT_HERO_TARGET_DX : v)) as [number, number, number];
      camera = camera.map((v, i) => target[i] + (v - target[i]) * 1.25) as [number, number, number];
    }
    return { ...s, camera, target, drop: 0 };
  }
  const drop = key === 'bubble' ? smooth(clamp01((p - 0.2) / 0.6)) : 0; // 블록 20~80% 구간에서 떨어진다
  // 차트 장면은 세로 화면에서도 카메라를 옮기지 않는다 — 판 위치와 점 좌표의 대응이 카메라 거리에 묶여 있고,
  // 판 크기 자체가 세로 화면에 맞춰져 있다
  if (s.chart === 1) return { ...s, drop };
  const override = portrait ? PORTRAIT_OVERRIDE[key] : undefined;
  const baseCamera = override?.camera ?? s.camera;
  const target = override?.target ?? s.target;
  const camera = portrait
    ? (baseCamera.map((v, i) => target[i] + (v - target[i]) * PORTRAIT_DISTANCE) as SceneState['camera'])
    : s.camera;
  return { ...s, camera, target, drop };
}

function clamp01(v: number) { return Math.min(1, Math.max(0, v)); }
function smooth(v: number) { return v * v * (3 - 2 * v); }

// 두 장면 상태를 h(0~1)로 섞는다. 숫자 필드(카메라·목표점은 성분별)는 선형 보간이고, 한쪽에만 있는 숫자는 0으로 본다.
// 숫자가 아닌 필드는 보간할 수 없어 h >= 0.5면 b, 아니면 a 값을 쓴다.
// 차트 장면은 점 배치가 다른 경로(chartTargets)라 섞을 수 없어 던진다. follow·followUntil은 호출자가 정하므로 결과에 넣지 않는다
// (followUntil은 시각이라 섞으면 의미 없는 값이 된다)
export function blendScenes(a: SceneState, b: SceneState, h: number): SceneState {
  if (a.chart !== 0 || b.chart !== 0) throw new Error('blendScenes: 차트 장면은 섞을 수 없다');
  const ra = a as unknown as Record<string, unknown>, rb = b as unknown as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of new Set([...Object.keys(ra), ...Object.keys(rb)])) {
    if (k === 'follow' || k === 'followUntil') continue;
    const x = ra[k], y = rb[k];
    if (Array.isArray(x) && Array.isArray(y) && x.every(isNum) && y.every(isNum)) {
      out[k] = x.map((v, i) => v * (1 - h) + y[i] * h);
    } else if ((isNum(x) || x === undefined) && (isNum(y) || y === undefined)) {
      out[k] = (x ?? 0) * (1 - h) + (y ?? 0) * h; // v+(w-v)*h 꼴은 h=1에서 부동소수 오차로 b와 어긋난다
    } else {
      out[k] = h >= 0.5 ? y : x;
    }
  }
  return out as SceneState;
}

// 빠른 감쇠를 쓸지: 전환 구간 안이거나, 전환이 움직인 직후(followUntil 전). 점·카메라·곁가지가 같은 판정을 써야
// 서로 따로 놀지 않는다
export function followActive(t: Pick<SceneState, 'follow' | 'followUntil'> | null | undefined, now: number): boolean {
  return !!t && (!!t.follow || now < (t.followUntil ?? 0));
}

// 스크롤 y가 y0~y1 사이일 때의 전환 진행도(0~1, smoothstep). 구간이 비었거나 뒤집히면 0
export function handoffProgress(scrollY: number, y0: number, y1: number): number {
  if (y1 <= y0) return 0;
  return smooth(clamp01((scrollY - y0) / (y1 - y0)));
}

// 기울지 않은(roll 0, lookAt) 카메라에서 먼 지평선이 화면 위에서 몇 할 높이에 오는지(0 = 맨 위, 1 = 맨 아래).
// 하늘 그라데이션(globals.css .backdrop::before)의 지평선 줄을 3D 지평선에 맞출 때 쓴다(CameraRig가 --hz로 적는다)
export function horizonFrac(camera: readonly number[], target: readonly number[], fovDeg: number): number {
  const dx = target[0] - camera[0], dy = target[1] - camera[1], dz = target[2] - camera[2];
  const down = -dy / Math.hypot(dx, dz); // 내려다보는 기울기의 tan
  return 0.5 - down / (2 * Math.tan((fovDeg * Math.PI) / 360));
}

function isNum(v: unknown): v is number { return typeof v === 'number'; }
