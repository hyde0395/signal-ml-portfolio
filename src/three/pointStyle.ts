// 배경 점의 밝기·크기와 거리 흐림 상수(설계 2026-09-28 첫 화면 다듬기 §2.2, 시안 D).
// 셰이더(shaders.ts)는 이 값을 문자열로 박아 넣고, 단위 테스트는 같은 값을 순수 함수로 검사한다
// — WebGL 결과는 단위 테스트로 잴 수 없어서 식만 따로 뺐다(와플 FOCUS_DIM과 같은 방식).

export const POINT = { signalAlpha: 0.8, noiseAlpha: 0.117, signalSize: 0.9, noiseSize: 0.6 } as const;

// 지도 장면(설계 2026-09-29 §1): 종류(신호·잡음)와 상관없이 같은 알파·크기 — 선 굵기가 고르게. size는 지형 크기 배율
export const MAP_POINT = { coastAlpha: 0.8, routeAlpha: 0.9, size: 0.55 } as const;

// ① 물결 줄의 은은한 점(설계 2026-09-29 §6): 장면 값 soft(0..1)만큼 지형 점 크기·알파에 곱한다.
// 원래 밝기면 카메라 C에서 글 뒤 대비가 데스크톱 3.6/2.7:1로 실패했고, 이 값에서 8.4/5.5:1(시안 실측)
export const SOFT_POINT = { size: 0.75, alpha: 0.6 } as const;

// 거리 흐림: 카메라~점 거리 d가 카메라~장면 목표점 거리 dT보다 멀수록 흐리게.
// dT 기준이라 멀리 물러난 장면(검증·데모·연락처)에서도 전체가 한꺼번에 어두워지지 않는다.
// base는 ① 장면(dT ≈ 22.2)에서 시안 D(1.25 − (d − 14)/18)와 같아지도록 맞춘 값이다
export const DEPTH_FADE = { base: 0.79, span: 18, min: 0.22 } as const;

export function depthFade(d: number, dT: number): number {
  return Math.min(1, Math.max(DEPTH_FADE.min, DEPTH_FADE.base - (d - dT) / DEPTH_FADE.span));
}

// GLSL은 1을 int로 읽어 float과 섞으면 컴파일 오류가 난다 — 늘 소수점을 붙여 넣는다
export function glslFloat(n: number): string {
  return n.toFixed(3);
}
