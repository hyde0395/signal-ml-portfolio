// 3D 가능 여부: 스펙 §9.1 대체 화면 조건(움직임 줄이기, WebGL 없음, 메모리 2GB 이하).
// 프레임 저하에 따른 전환은 TerrainScene이 실행 중에 따로 판단한다.
export type Env = { reducedMotion: boolean; webgl: boolean; deviceMemory: number | undefined; forced: boolean };

export function canRender3D(env: Env): boolean {
  if (!env.webgl) return false;
  if (env.forced) return true; // 캡처 스크립트: 움직임 줄이기 설정과 무관하게 장면을 찍어야 한다
  if (env.reducedMotion) return false;
  if (env.deviceMemory !== undefined && env.deviceMemory <= 2) return false;
  return true;
}

export function detectEnv(win: Window): Env {
  let webgl = false;
  try {
    const c = win.document.createElement('canvas');
    webgl = !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { /* WebGL 생성이 막힌 환경 */ }

  let reducedMotion = false;
  try {
    reducedMotion = win.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    // matchMedia가 없거나 실패하면 안전 쪽(3D 미실행)으로 기울인다
    reducedMotion = true;
  }

  return {
    reducedMotion,
    webgl,
    // deviceMemory는 크롬 계열에만 있다. 없으면 undefined로 두고 3D를 허용한다.
    deviceMemory: (win.navigator as Navigator & { deviceMemory?: number }).deviceMemory,
    forced: new URLSearchParams(win.location.search).has('capture'),
  };
}
