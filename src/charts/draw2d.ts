// 3D가 꺼졌을 때(움직임 줄이기·WebGL 없음·저사양·저프레임) 같은 배치를 2D 캔버스에 그린다. 3D 점과 같은
// 색·크기라 대체 화면에서도 차트가 똑같이 읽힌다(설계 §7 — 차트는 캡처 이미지 대신 이 그림을 쓴다).
import { TONE, TONE_VAL, VAL_LO, type ChartLayout } from './types';

export const TONE_COLOR: Record<number, string> = { [TONE.dot]: '#8FB8FF', [TONE.amber]: '#FFB547', [TONE.text]: '#EEF3FF' };

const hex = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const LO = hex(VAL_LO), HI = hex(TONE_COLOR[TONE.amber]);

// 색 번호 → CSS 색. 값 색(TONE_VAL 이상)은 두 색 사이를 sRGB에서 보간한다
export function toneColor(t: number): string {
  if (t < TONE_VAL) return TONE_COLOR[t] ?? TONE_COLOR[TONE.dot];
  const k = Math.min(1, (t - TONE_VAL) / 100);
  return `#${LO.map((a, i) => Math.round(a + (HI[i] - a) * k).toString(16).padStart(2, '0')).join('')}`;
}

// ctx는 호출 측이 기기 픽셀 비율로 미리 늘려 둔다(w·h는 CSS px). focus: 강조할 번호(layout.hl과 비교), 없으면 -1
export function drawLayout(ctx: CanvasRenderingContext2D, layout: ChartLayout, w: number, h: number, focus = -1): void {
  ctx.clearRect(0, 0, w, h);
  for (let i = 0; i < layout.n; i++) {
    const hl = layout.hl[i];
    const focused = focus >= 0 && hl === focus;
    const dimmed = focus >= 0 && hl >= 0 && hl !== focus;
    ctx.globalAlpha = layout.alpha[i] * (dimmed ? layout.focusDim : 1);
    ctx.fillStyle = focused ? toneColor(layout.focusTone) : toneColor(layout.tone[i]);
    ctx.beginPath();
    ctx.arc(layout.x[i] * w, layout.y[i] * h, layout.size[i] / 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
