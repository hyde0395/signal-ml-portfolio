// 배경 점의 밝기·크기와 거리 흐림 상수(설계 2026-09-28 첫 화면 다듬기 §2.2, 시안 D).
// 셰이더(shaders.ts)는 이 값을 문자열로 박아 넣고, 단위 테스트는 같은 값을 순수 함수로 검사한다
// — WebGL 결과는 단위 테스트로 잴 수 없어서 식만 따로 뺐다(와플 FOCUS_DIM과 같은 방식).

export const POINT = { signalAlpha: 0.8, noiseAlpha: 0.117, signalSize: 0.9, noiseSize: 0.6 } as const;

// 지도 장면(설계 2026-09-29 §1): 종류(신호·잡음)와 상관없이 같은 알파·크기 — 선 굵기가 고르게. size는 지형 크기 배율
export const MAP_POINT = { coastAlpha: 0.8, routeAlpha: 0.9, size: 0.55 } as const;

// 머리말·① 잡음 밭 점(설계 2026-10-01 §6, 시안 noise-signal.html): 깊이 d(0 먼 쪽 .. 1 가까운 쪽)마다
// 지름 sizeMin + sizeAdd·d (CSS px), 알파 alphaMin + alphaAdd·d, d > white면 흰빛, 떨림 jitterMin + jitterAdd·d (CSS px).
// 시안 값(반지름 0.7 + 1.3·d → 지름 1.4 + 2.6·d, 알파 0.16 + 0.38·d)에서 사용자 요청(첫 시안보다 잘 보이게)으로 키웠다 —
// 시안 값 그대로는 점 가장자리 흐림 때문에 실제 화면에서 거의 안 보였다(1440×900 눈 확인).
// 가라앉으면(단계 4) 떨림 ×(1 − settleJitter), 알파 ×(1 − settleAlpha)
export const FIELD_POINT = {
  sizeMin: 2.0, sizeAdd: 3.0, alphaMin: 0.22, alphaAdd: 0.38, white: 0.85,
  jitterMin: 1.6, jitterAdd: 1.2, settleJitter: 0.7, settleAlpha: 0.3,
} as const;

export function fieldAlpha(d: number, twinkle: number, settled: number): number {
  return (FIELD_POINT.alphaMin + FIELD_POINT.alphaAdd * d) * twinkle * (1 - FIELD_POINT.settleAlpha * settled);
}

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
