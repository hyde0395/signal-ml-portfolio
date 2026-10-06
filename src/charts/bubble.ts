// ⑤ 차트 3 "R² 거품" 아령 판(정보 전달 2 §6, 시안 docs/superpowers/mockups/2026-10-05/bubble-dumbbell.html 왼쪽 A).
// 가로 R² 축 하나에 정정 두 번의 전·후를 잇는다: 전 = 속 빈 점(SVG 덧그림), 후 = 호박 별(결론 층 점 + 빛 번짐), 사이에 가는 별자리 선과
// 차이(−0.22). 오른쪽 작은 칸(좁은 판은 축 아래)은 MAE가 거의 그대로였음을 보인다 — R²만 떨어지고 오차는 그대로라는 것이 이 차트의 결론.
// 단계(자막 칸): 0 첫 정정 → 1 둘째 정정 + MAE 값 → 2 둘 다, 전 점은 흐리게. 점 개수·순서는 단계와 무관하다(3D 슬롯 전환).
// 데이터 파일이 필요 없다 — 값은 facts(model.bubble)에서 서버가 넘긴다.
import { Pts, type PlotSize } from './layouts';
import { LINE, STAR } from './lines';
import { CHART_FOCUS_DIM, TONE, type ChartLabel, type ChartLayout, type ChartLine, type OverlayShape } from './types';

// lo·hi: R² 축 범위, ticks: 세로 점선 눈금(배경 층 — 3D에서 배경 점이 모일 자리), gridStepPx: 점선 점 간격.
// starD: 후 별 지름, ringR: 전 점 반지름(px), beforeA: 전 점 알파, pastA: 단계 2(결론)에서 흐린 전 점 알파
export const BUBBLE = {
  stages: 3, wideMinPx: 560, lo: 0.5, hi: 1.0, ticks: [0.6, 0.7, 0.8, 0.9], gridStepPx: 7, gridA: 0.2,
  starD: 9, ringR: 7, beforeA: 0.8, pastA: 0.35,
} as const;

export type BubbleRow = { name: string; note: string; before: number; after: number };
// 서버가 넘기는 값(숫자·글자만 — 함수는 서버 → 클라이언트로 못 넘긴다)
export type BubbleInput = {
  rows: readonly [BubbleRow, BubbleRow]; // 첫 정정, 둘째 정정
  legendBefore: string; legendAfter: string;
  maeSame: string;   // "거의 그대로"
  maeChange: string; // "48,442 → 48,235원"(서버가 facts로 만든다)
};
// build.ts가 언어별 형식 함수를 더한 것
export type BubbleTexts = BubbleInput & { r2(v: number): string; tick(v: number): string; diff(v: number): string };

export function bubbleLayout(size: PlotSize, stage: number, s: BubbleTexts): ChartLayout {
  const st = Math.max(0, Math.min(BUBBLE.stages - 1, Math.floor(stage)));
  const W = size.w, H = size.h, wide = W >= BUBBLE.wideMinPx;
  // 넓은 판: 왼쪽 20% 줄 이름, 가운데 축, 오른쪽 칸(0.8W~) MAE. 좁은 판: 줄 이름은 줄 위, MAE는 축 아래
  const gx0 = wide ? W * 0.2 : W * 0.06, gx1 = wide ? W * 0.74 : W - 16;
  const top = H * (wide ? 0.18 : 0.12), bottom = H * (wide ? 0.82 : 0.64);
  // 축 범위 밖 값(앞으로 바뀌는 facts)도 판 안에 머물도록 범위로 자른다
  const X = (v: number) => gx0 + (gx1 - gx0) * ((Math.min(BUBBLE.hi, Math.max(BUBBLE.lo, v)) - BUBBLE.lo) / (BUBBLE.hi - BUBBLE.lo));
  const rowY = wide ? [H * 0.38, H * 0.64] : [H * 0.3, H * 0.58];
  const shown = (i: number) => i === 0 || st >= 1;
  const p = new Pts();

  // 배경 층: 눈금마다 세로 점선. 개수는 판 크기만의 함수 — 단계와 무관
  for (const v of BUBBLE.ticks) for (let y = top; y <= bottom; y += BUBBLE.gridStepPx) p.add(X(v) / W, y / H, 1.2, BUBBLE.gridA, TONE.dot);

  // 결론 층: 후 별(빛 번짐 + 심). 아직 안 나온 줄은 번짐까지 알파 0 — addStar는 번짐 알파가 고정이라 직접 넣는다
  const star = (x: number, y: number, tone: number, on: boolean) => {
    p.add(x / W, y / H, BUBBLE.starD * STAR.haloScale, on ? STAR.haloAlpha : 0, tone);
    p.add(x / W, y / H, BUBBLE.starD, on ? 1 : 0, tone);
  };
  s.rows.forEach((r, i) => star(X(r.after), rowY[i], TONE.amber, shown(i)));
  // MAE 칸(넓은 판): 둘째 정정의 전·후가 거의 겹친다 — 후는 파랑 별(R² 별과 색으로도 구분), 전은 덧그림의 속 빈 점
  const maeX = W * 0.86;
  if (wide) star(maeX + 3, rowY[1], TONE.dot, st >= 1);

  // 별자리 선: 전 → 후. 덧그림: 전 = 속 빈 점(단계 2에서 흐리게), MAE 칸의 전 점
  const lines: ChartLine[] = [];
  const shapes: OverlayShape[] = [];
  s.rows.forEach((r, i) => {
    if (!shown(i)) return;
    const y = rowY[i] / H;
    lines.push({ pts: [X(r.before) / W, y, X(r.after) / W, y], tone: TONE.text, alpha: LINE.alpha, width: LINE.width });
    shapes.push({ type: 'dot', x: X(r.before) / W, y, r: BUBBLE.ringR, tone: TONE.text, alpha: st === 2 ? BUBBLE.pastA : BUBBLE.beforeA, hollow: true });
  });
  if (wide && st >= 1) shapes.push({ type: 'dot', x: maeX / W, y: rowY[1] / H, r: BUBBLE.ringR, tone: TONE.text, alpha: BUBBLE.beforeA, hollow: true });

  const labels: ChartLabel[] = [];
  // 범례(맨 위): 속 빈 점 = 걸러내기 전, 호박 별 = 걸러낸 뒤
  const ly = H * (wide ? 0.07 : 0.04);
  labels.push({ type: 'text', x: gx0 / W, y: ly / H, text: s.legendBefore, align: 'start', cls: 'keyRing' });
  labels.push({ type: 'text', x: (gx0 + (wide ? 130 : 110)) / W, y: ly / H, text: s.legendAfter, align: 'start', cls: 'keyAmber' });
  s.rows.forEach((r, i) => {
    if (!shown(i)) return;
    const y = rowY[i];
    if (wide) {
      // 이름은 축 바로 왼쪽에 붙여 오른쪽 정렬 — 긴 설명은 줄 아래 축 왼쪽에서 시작한다
      labels.push({ type: 'text', x: (gx0 - 20) / W, y: y / H, text: r.name, align: 'end', cls: 'head' });
      labels.push({ type: 'text', x: gx0 / W, y: (y + 24) / H, text: r.note, align: 'start', cls: 'tick' });
    } else {
      labels.push({ type: 'text', x: gx0 / W, y: (y - 64) / H, text: `${r.name} · ${r.note}`, align: 'start', cls: 'head' });
    }
    // 전 값은 작게 점 위, 후 값은 결론 이름표(큰 호박 숫자 + 차이)
    labels.push({ type: 'text', x: X(r.before) / W, y: (y - 20) / H, text: s.r2(r.before), align: 'center', cls: 'tick' });
    labels.push({ type: 'callout', x: X(r.after) / W, y: (y - 10) / H, value: s.r2(r.after), note: '', tone: 'amber', place: 'above' });
    // 차이 값은 이름표 안(큰 숫자 위)이 어색해, 전·후 사이 줄 아래 가운데에 작은 호박색 글자로 둔다
    labels.push({ type: 'text', x: ((X(r.before) + X(r.after)) / 2) / W, y: (y + 14) / H, text: s.diff(r.before - r.after), align: 'center', cls: 'holiday' });
  });
  // 축 눈금과 이름
  for (const v of BUBBLE.ticks) labels.push({ type: 'text', x: X(v) / W, y: (bottom + 14) / H, text: s.tick(v), align: 'center', cls: 'tick' });
  labels.push({ type: 'text', x: gx1 / W, y: (bottom + 32) / H, text: 'R²', align: 'end', cls: 'axis' });
  // MAE 칸
  if (wide) {
    const mx = W * 0.8;
    labels.push({ type: 'text', x: mx / W, y: (rowY[0] - 40) / H, text: 'MAE', align: 'start', cls: 'axis' });
    labels.push({ type: 'text', x: mx / W, y: rowY[0] / H, text: s.maeSame, align: 'start', cls: 'tick' });
    if (st >= 1) {
      labels.push({ type: 'text', x: mx / W, y: (rowY[1] + 24) / H, text: s.maeChange, align: 'start', cls: 'head' });
      labels.push({ type: 'text', x: mx / W, y: (rowY[1] + 42) / H, text: s.maeSame, align: 'start', cls: 'tick' });
    }
  } else {
    labels.push({ type: 'text', x: gx0 / W, y: (H * 0.78) / H, text: 'MAE', align: 'start', cls: 'axis' });
    labels.push({ type: 'text', x: gx0 / W, y: (H * 0.85) / H, text: `${s.rows[0].name} · ${s.maeSame}`, align: 'start', cls: 'tick' });
    if (st >= 1) labels.push({ type: 'text', x: gx0 / W, y: (H * 0.92) / H, text: `${s.rows[1].name} · ${s.maeChange} · ${s.maeSame}`, align: 'start', cls: 'tick' });
  }
  return { ...p.done(labels, TONE.text, CHART_FOCUS_DIM), variant: `stage:${st}`, lines, overlay: () => shapes };
}
