// 장면 표: 섹션·챕터마다 카메라 위치와 셰이더 uniform 목표값을 정한다.
// 캔버스는 이 값으로 "부드럽게 다가가기"만 하므로, 연출을 바꾸려면 이 표만 고치면 된다.
export type SceneKey = 'hero' | 'about' | 'problem' | 'insight' | 'bubble' | 'validation' | 'interval' | 'limits' | 'stack' | 'contact';

export type SceneState = {
  camera: [number, number, number];
  target: [number, number, number];
  assemble: number; // 0 = 흩어짐, 1 = 목표 모양
  map: number;      // 0 = 지형, 1 = 한·일 지도
  noise: number;    // 흐린 잡음 점의 불투명도 배율
  removed: number;  // 제거 레이어(9,387행) 보이기
  drop: number;     // 제거 레이어가 떨어진 정도
};

const base = { assemble: 1, map: 0, noise: 1, removed: 0, drop: 0 };

export const SCENES: Record<SceneKey, SceneState> = {
  // 첫 화면: 비스듬히 내려다본 전경. 처음엔 assemble이 0에서 시작해 신호가 떠오른다(TerrainPoints 초기값).
  hero: { ...base, camera: [6, 9, 20], target: [0, 0.5, 0] },
  about: { ...base, camera: [-14, 7, 16], target: [0, 0.5, 0], noise: 0.6 },
  // 3-1: 위에서 내려다본 한·일 지도와 노선 궤적
  problem: { ...base, camera: [0, 16, 7], target: [0, 0, 0], map: 1 },
  // 3-2: 앞쪽 낮은 시점 → 예약 시점 축(x)의 U자 골짜기와 출발일 축(z)의 공휴일 봉우리가 함께 보인다
  insight: { ...base, camera: [9, 3.5, 17], target: [0, 0.8, 0] },
  // 3-3: 제거 레이어가 높이 떠 있다가 떨어진다(drop은 sceneFor가 진행도로 채움)
  bubble: { ...base, camera: [7, 9, 17], target: [0, 2.5, 0], removed: 1 },
  validation: { ...base, camera: [0, 22, 0.1], target: [0, 0, 0], noise: 0.5 },
  interval: { ...base, camera: [-12, 5, 12], target: [0, 0.5, 0] },
  limits: { ...base, camera: [0, 12, 26], target: [0, 0, 0], noise: 0.7 },
  stack: { ...base, camera: [0, 16, 30], target: [0, 0, 0], noise: 0.3 },
  contact: { ...base, camera: [0, 16, 30], target: [0, 0, 0], noise: 0.3 },
};

const PORTRAIT_DISTANCE = 1.6; // 세로 화면은 시야가 좁아 같은 구도를 담으려면 더 물러나야 한다

export function sceneFor(key: SceneKey, progress: number, portrait: boolean): SceneState {
  const s = SCENES[key];
  const p = Math.min(1, Math.max(0, progress));
  const drop = key === 'bubble' ? smooth(clamp01((p - 0.2) / 0.6)) : 0; // 챕터 20~80% 구간에서 떨어진다
  const camera = portrait
    ? (s.camera.map((v, i) => s.target[i] + (v - s.target[i]) * PORTRAIT_DISTANCE) as SceneState['camera'])
    : s.camera;
  return { ...s, camera, drop };
}

function clamp01(v: number) { return Math.min(1, Math.max(0, v)); }
function smooth(v: number) { return v * v * (3 - 2 * v); }
