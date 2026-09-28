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
