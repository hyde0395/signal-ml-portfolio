// 3D 가능 여부: 스펙 §9.1 대체 화면 조건(움직임 줄이기, WebGL 없음, 메모리 2GB 이하).
// 프레임 저하에 따른 전환은 TerrainScene이 실행 중에 따로 판단한다.
import { FIGURE_KEYS, type FigureKey } from './figureKeys';

// ?capture=<장면>은 대체 이미지 캡처 스크립트 전용이다. 대체 이미지가 있는 다섯 장면 이름만 받는다.
// 왜: 틀린 값(?capture=bogus)이 그대로 장면 표를 찾으면 undefined로 3D가 죽어 페이지가 비었고,
// 아무 값이나 움직임 줄이기 설정을 건너뛰게 해서도 안 된다.
export function parseCapture(search: string): FigureKey | null {
  const v = new URLSearchParams(search).get('capture');
  return v !== null && (FIGURE_KEYS as readonly string[]).includes(v) ? (v as FigureKey) : null;
}
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
    forced: parseCapture(win.location.search) !== null, // 올바른 캡처 장면일 때만 강제로 3D
  };
}
