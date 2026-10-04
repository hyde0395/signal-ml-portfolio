// 별자리 선·별 도우미(설계 2026-10-04 §2·§3). 배치 함수가 결론 점을 "별"(빛 번짐 + 심)로 더하고, 별끼리 잇는 선을
// SVG 경로로 바꾸며, 3D에서 선이 나타날 때까지 기다릴 시간을 정한다. 의존성이 없어 그림 판(초기 JS)에서 불러도 가볍다.

// 3D 점은 TerrainPoints의 damp(λ = 2.2)로 따라가 약 1.36초에 95%에 닿는다 — 그보다 조금 앞에서 선을 띄우기 시작해
// 페이드(0.6초)가 끝날 때 점과 함께 자리 잡게 한다
export const LINE = { width: 1.2, alpha: 0.6, delay3dMs: 1200 } as const;
// 빛 번짐: 같은 자리에 지름 2.5배·알파 0.14 점 하나(시안 v6). 셰이더·2D 캔버스 모두 둥근 점이라 그대로 번짐처럼 보인다
export const STAR = { haloScale: 2.5, haloAlpha: 0.14 } as const;

// layouts.ts의 Pts와 같은 모양 — Pts를 import하면 layouts ↔ lines가 서로 부르게 되어 모양만 받는다
export type Adder = { add(x: number, y: number, size: number, alpha: number, tone: number, group?: number, hl?: number): void };

// 빛 번짐을 먼저 넣어야 심이 그 위에 그려진다(2D는 순서대로 칠하고, 3D도 같은 깊이에서 뒤 번호가 위)
export function addStar(p: Adder, x: number, y: number, d: number, tone: number, alpha = 1, group = -1, hl = -1): void {
  p.add(x, y, d * STAR.haloScale, STAR.haloAlpha, tone, group, hl);
  p.add(x, y, d, alpha, tone, group, hl);
}

const r1 = (v: number) => Math.round(v * 10) / 10;

export function linePath(pts: number[], w: number, h: number): string {
  if (pts.length < 4) return '';
  let d = '';
  for (let i = 0; i + 1 < pts.length; i += 2) d += `${i ? 'L' : 'M'}${r1(pts[i] * w)} ${r1(pts[i + 1] * h)}`;
  return d;
}

export function linesDelay(is3d: boolean, reduced: boolean): number {
  return is3d && !reduced ? LINE.delay3dMs : 0;
}
