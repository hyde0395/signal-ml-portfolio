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
  curve: number;    // 예약 곡선 레이어(kind 3) 보이기 — 3-2(insight)에서만 1
};

const base = { assemble: 1, map: 0, noise: 1, removed: 0, drop: 0, curve: 0 };

export const SCENES: Record<SceneKey, SceneState> = {
  // 첫 화면: 비스듬히 내려다본 전경. 처음엔 assemble이 0에서 시작해 신호가 떠오른다(TerrainPoints 초기값).
  hero: { ...base, camera: [6, 9, 20], target: [0, 0.5, 0] },
  about: { ...base, camera: [-14, 7, 16], target: [0, 0.5, 0], noise: 0.6 },
  // 3-1: 위에서 내려다본 한·일 지도와 노선 궤적. 데스크톱은 왼쪽에 600px 글 카드가 얹히므로
  // 카메라·목표점을 함께 x=-4.5로 옮겨(같은 방향을 보되 옆으로 이동) 지도 전체가 카드 오른쪽에 오게 한다
  problem: { ...base, camera: [-4.5, 16, 7], target: [-4.5, 0, 0], map: 1 },
  // 3-2: 출발일 축(z)을 따라 옆에서 본 시점 → 예약 시점(x)별 가격 %가 거의 그대로 높이로 읽힌다.
  // camera.x와 target.x를 같게 두면 회전 없이 옆으로만 밀 수 있어 U자 모양이 비뚤어지지 않는다.
  // 처음 26에서는 점이 뭉쳐 밀도만 보이고 높이 차가 안 읽혀 15로 붙였다가, 곡선이 프레임 밖으로 나가
  // 22로 다시 늘렸다(아래 "카메라" 설명). target.y는 실측 평균(-11%~+1%대)에 맞춤.
  // 잡음(칸×노선×등급 평균, 2만4천여 개)이 신호(칸 평균, 2천여 개) 위에 겹쳐 골짜기를 가려 noise를 0.22로 낮춤.
  // curve: 1 — 예약 곡선(kind 3, z=+10.5)은 지형(z 최대 10)보다 카메라 쪽에 있어 이 장면에서만
  // 밝게 켜면 지형 바로 앞을 가로지르는 U자 선으로 보인다(라운드 3 결함 B).
  // 카메라: 곡선은 dtd 0~90만 있어 x가 [-1.8, 8](데이터 x=((147-dtd)/147-0.5)*16)에 몰려 있다.
  // 기존 거리(15)로는 곡선 쪽으로 화면이 꽉 차 대부분 프레임 밖으로 나갔다(라운드 3 1차 시도에서
  // 실측 확인). 거리를 22로 늘리고 target.x를 곡선 쪽으로(3) 옮겨 카드를 피하면서 곡선 전체가
  // 들어오게 했다.
  insight: { ...base, camera: [3, 2.2, 22], target: [3, 0.4, 0], noise: 0.22, curve: 1 },
  // 3-3: 제거 레이어가 높이 떠 있다가 떨어진다(drop은 sceneFor가 진행도로 채움)
  bubble: { ...base, camera: [7, 9, 17], target: [0, 2.5, 0], removed: 1 },
  validation: { ...base, camera: [0, 22, 0.1], target: [0, 0, 0], noise: 0.5 },
  interval: { ...base, camera: [-12, 5, 12], target: [0, 0.5, 0] },
  limits: { ...base, camera: [0, 12, 26], target: [0, 0, 0], noise: 0.7 },
  stack: { ...base, camera: [0, 16, 30], target: [0, 0, 0], noise: 0.3 },
  contact: { ...base, camera: [0, 16, 30], target: [0, 0, 0], noise: 0.3 },
};

const PORTRAIT_DISTANCE = 1.6; // 세로 화면은 시야가 좁아 같은 구도를 담으려면 더 물러나야 한다

// 세로 화면 전용 카메라·목표점. problem은 데스크톱에서 왼쪽 글 카드를 피하려고 x를 -4.5로 밀었고,
// insight는 곡선 전체를 담으려고 x를 3으로, 거리를 22로 옮겼다(위 SCENES 주석 참고). 세로 화면은
// 수평 시야각이 훨씬 좁아 같은 값으로 밀면 지도·지형·곡선의 절반이 잘려 나가고, 글 카드도 아래쪽에
// 있어 옆으로 밀 필요가 없으므로 두 장면 모두 가운데로 되돌린 값을 따로 둔다.
const PORTRAIT_OVERRIDE: Partial<Record<SceneKey, { camera: SceneState['camera']; target: SceneState['target'] }>> = {
  problem: { camera: [0, 16, 7], target: [0, 0, 0] },
  // insight(세로): 예전 값([0,2,40], ×1.6 → 곡선에서 약 54 떨어짐)은 곡선이 화면 아래 글 카드 뒤에 작게
  // 묻혀 안 보였다(최종 리뷰 #3). 목표점을 곡선 한가운데(x 3.1 = dtd 0~90의 가운데, z 10.5)로 옮기고
  // 곡선까지 거리를 약 35로 줄였다: 세로 화면 수평 반화각이 약 9.3°(Pixel 7)라 35×tan 9.3° ≈ 5.7 →
  // x -2.6~8.8로 곡선 전체가 들어온다. 카메라를 목표점보다 높여(약 25° 내려다봄) 앞쪽에 있는 곡선은 아래로,
  // 뒤쪽 지형은 위로 갈라지게 했다(수평으로 보면 곡선이 지형 점과 겹쳐 안 읽혔다). 목표점 y를 낮춰
  // 곡선이 화면 위쪽(약 35~42% 높이)에 오게 해 아래 55%를 덮는 글 카드와 겹치지 않는다(Pixel 7 캡처로 확인).
  insight: { camera: [3.1, 6, 31], target: [3.1, -3.5, 10.5] },
};

export function sceneFor(key: SceneKey, progress: number, portrait: boolean): SceneState {
  const s = SCENES[key];
  const p = Math.min(1, Math.max(0, progress));
  const drop = key === 'bubble' ? smooth(clamp01((p - 0.2) / 0.6)) : 0; // 챕터 20~80% 구간에서 떨어진다
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
