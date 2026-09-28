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
};

// 차트 장면 카메라: 원점을 정면(z축)에서 본다. 그림 판의 화면 px ↔ z=0 평면 좌표가 이 두 값으로 정해지므로
// (three/chartTargets.ts) TerrainScene의 Canvas 카메라 fov도 CHART_FOV를 쓴다
export const CHART_DISTANCE = 24;
export const CHART_FOV = 40;
const CHART = { camera: [0, 0, CHART_DISTANCE] as SceneState['camera'], target: [0, 0, 0] as SceneState['target'], chart: 1, noise: 0 };

const base = { assemble: 1, map: 0, noise: 1, removed: 0, drop: 0, chart: 0, slot: 0, dim: 1, shift: 0 };

export const SCENES: Record<SceneKey, SceneState> = {
  // 첫 화면: 비스듬히 내려다본 전경. 처음엔 assemble이 0에서 시작해 신호가 떠오른다(TerrainPoints 초기값).
  // 글 쪽 장면(설계 2026-09-28 §2.1)은 카메라·목표점을 함께 x −5로 옮겨 점을 오른쪽에 둔다 — 글 뒤 판을 없앴다
  // 대비 화소 검사 실패(Step 7)로 hero만 x −6.5까지 더 옮겼다 — 첫 화면은 대체 이미지 위 비네트도 같이 받는
  // 유일한 장면이라 다른 글 쪽 장면보다 점이 더 멀리 있어야 글자가 배경 점과 안 겹친다
  hero: { ...base, camera: [-0.5, 9, 20], target: [-6.5, 0.5, 0] },
  about: { ...base, camera: [-19, 7, 16], target: [-5, 0.5, 0], noise: 0.6 },
  // ② 화면 1: 위에서 내려다본 한·일 지도와 노선 궤적. 데스크톱은 왼쪽에 글 카드가 얹히므로
  // 카메라·목표점을 함께 x=-4.5로 옮겨(같은 방향을 보되 옆으로 이동) 지도 전체가 카드 오른쪽에 오게 한다
  problem: { ...base, camera: [-4.5, 16, 7], target: [-4.5, 0, 0], map: 1 },
  // ② 화면 2: 같은 지도를 멀리서 내려다보고 점을 흐리게 한다. 판 없는 보드의 작은 글자가 지도 점과 섞이지
  // 않게 하는 것이 이 장면의 목적이다(설계 §3.2, 2026-09-27)
  dataBoard: { ...base, camera: [0, 30, 14], target: [0, 0, 0], map: 1, dim: 0.16 },
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
// 세로 화면은 글이 아래쪽에 있어 옆으로 밀 필요가 없고 그대로 밀면 지형·지도 절반이 잘린다
const PORTRAIT_OVERRIDE: Partial<Record<SceneKey, { camera: SceneState['camera']; target: SceneState['target'] }>> = {
  problem: { camera: [0, 16, 7], target: [0, 0, 0] },
  hero: { camera: [6, 9, 20], target: [0, 0.5, 0] },
  about: { camera: [-14, 7, 16], target: [0, 0.5, 0] },
  bubble: { camera: [7, 9, 17], target: [0, 2.5, 0] },
  validation: { camera: [0, 22, 0.1], target: [0, 0, 0] },
  limits: { camera: [0, 12, 26], target: [0, 0, 0] },
  demo: { camera: [0, 16, 30], target: [0, 0, 0] },
  contact: { camera: [0, 16, 30], target: [0, 0, 0] },
};

export function isChartScene(key: SceneKey): boolean {
  return SCENES[key].chart === 1;
}

export function sceneFor(key: SceneKey, progress: number, portrait: boolean): SceneState {
  const s = SCENES[key];
  const p = Math.min(1, Math.max(0, progress));
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
