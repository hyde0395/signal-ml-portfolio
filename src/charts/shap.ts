// ③ 와플 펼치기 → SHAP 벌떼 배치(계획 5-3c, 설계 2026-09-30 §3.2 배치 A). 펼치면 와플 6개가 판 위 작은 줄로 줄고,
// 남은 판에 펼친 그룹의 피처마다 가로줄 하나 — 점 하나 = 표본 예측 하나에서 그 피처가 가격을 움직인 %.
// layouts.ts와 같은 순수 함수라 2D 대체 그림과 3D 점이 같은 결과를 쓴다.
import type { ChartsData } from './data';
import { Pts, WAFFLE, type FeatureGroupInput, type PlotSize } from './layouts';
import { FOCUS_DIM, TONE, valTone, type ChartLabel, type ChartLayout } from './types';

export type ShapData = NonNullable<ChartsData['shap']>;
export type ShapRow = { id: string; categorical: boolean; pct: number[]; f: number[]; meanAbs: number; dir: 'up' | 'down' | 'mixed' | 'cat' };

// leadMinPx: 머리 줄에 설명 문장을 붙일 최소 판 폭 — 그보다 좁으면 오른쪽 색 범례와 겹친다(한국어·영어 1080px 판 어림)
export const SHAP_LAYOUT = {
  wideMinPx: 560, leadMinPx: 1000,
  // 좁은 판은 칸 폭의 0.6까지 — 아주 좁은 판에서도 이웃 작은 와플 사이에 틈이 남아 % 이름표가 붙어 보이지 않게
  mini: { wide: 44, narrow: 30 }, miniFrac: { wide: 0.12, narrow: 0.6 }, miniLabelPx: 18,
  // 좁은 판은 범례가 머리 줄 아래 한 줄을 더 쓰므로(legendDropPx) 벌떼 시작을 그만큼 내린다
  headGap: 10, headPx: { wide: 18, narrow: 32 }, bottomPx: 34,
  // 좁은 판 이름 칸: 가장 긴 피처 이름 is_kr_near_holiday가 9px 고정폭 글꼴로 약 97px
  labelW: { wide: 150, narrow: 108 }, dot: { wide: 3, narrow: 2.2 }, gap: 0.4,
  clipQ: 0.98, minLim: 1, dirMinCorr: 0.2, legendDots: 24, legendW: 90,
  // 좁은 판은 머리 줄과 범례가 한 줄에 안 들어가 범례를 한 줄 아래로 내린다
  legendDropPx: 14,
  // 범례 오른쪽 끝을 판 끝에서 띄우는 폭 — "높음" 글자가 범례 점 오른쪽에 붙을 자리
  legendRightPx: 40,
  // 판 아래에서 눈금 줄·방향 글 줄의 기준선 — bottomPx(34) 안에 두 줄이 들어간다
  tickFromBottomPx: 22, dirFromBottomPx: 7,
} as const;

export const shapPct = (v: number) => Math.expm1(v / 1000) * 100;

function corr(a: number[], b: number[]): number {
  const n = a.length, ma = a.reduce((s, x) => s + x, 0) / n, mb = b.reduce((s, x) => s + x, 0) / n;
  let sab = 0, saa = 0, sbb = 0;
  for (let i = 0; i < n; i++) { const da = a[i] - ma, db = b[i] - mb; sab += da * db; saa += da * da; sbb += db * db; }
  return saa && sbb ? sab / Math.sqrt(saa * sbb) : 0;
}

// 그룹 피처의 줄들. 순서 = 평균 |%| 내림차순(영향 큰 피처가 위). 방향 = 값 순위와 SHAP의 상관 부호(|r| < 0.2면 mixed)
export function shapRows(shap: ShapData, ids: string[]): ShapRow[] {
  return ids.map((id) => {
    const j = shap.features.indexOf(id);
    if (j < 0) throw new Error(`charts.json shap에 피처 ${id}가 없다`);
    const pct = shap.v[j].map(shapPct), f = shap.f[j];
    const categorical = shap.categorical.includes(id);
    const meanAbs = pct.reduce((s, x) => s + Math.abs(x), 0) / pct.length;
    const r = categorical ? 0 : corr(f, pct);
    const dir: ShapRow['dir'] = categorical ? 'cat' : r >= SHAP_LAYOUT.dirMinCorr ? 'up' : r <= -SHAP_LAYOUT.dirMinCorr ? 'down' : 'mixed';
    return { id, categorical, pct, f, meanAbs, dir };
  }).sort((a, b) => b.meanAbs - a.meanAbs);
}

type P = [x: number, y: number, size: number, alpha: number, tone: number, hl: number];

export function shapOpenLayout(
  groups: FeatureGroupInput[], open: number, shap: ShapData, size: PlotSize,
  s: { gain(v: number): string; count(n: number): string; pct(v: number): string; lead: string; down: string; up: string; low: string; high: string; catNote: string; row(r: ShapRow): string },
): ChartLayout {
  const L = SHAP_LAYOUT, W = size.w, H = size.h, wide = W >= L.wideMinPx;
  const g = groups[open];
  const rows = shapRows(shap, g.features);
  const labels: ChartLabel[] = [];

  // 작은 와플 줄: 그룹마다 칸 하나, 가운데 정렬
  const colW = W / groups.length;
  const sq = Math.min(wide ? L.mini.wide : L.mini.narrow, wide ? H * L.miniFrac.wide : colW * L.miniFrac.narrow);
  const cell = sq / WAFFLE.side;
  const mini: P[][] = groups.map((gr, k) => {
    const x0 = k * colW + (colW - sq) / 2, lit = Math.round(gr.gain), hol = gr.id === 'holiday';
    labels.push({
      type: 'group', x: (x0 + sq / 2) / W, y: (sq + 2) / H, id: gr.id, pct: s.gain(gr.gain), name: gr.name,
      count: s.count(gr.features.length), features: gr.features, holiday: hol, compact: true, mini: wide ? 'name' : 'pct',
    });
    return Array.from({ length: WAFFLE.side * WAFFLE.side }, (_, c): P => {
      const on = c < lit;
      return [x0 + ((c % WAFFLE.side) + 0.5) * cell, ((Math.floor(c / WAFFLE.side)) + 0.5) * cell, Math.max(1.6, cell * 0.72), on ? 0.95 : 0.13, on && hol ? TONE.amber : TONE.dot, k];
    });
  });

  // 머리 줄 + 색 범례(범주형뿐이면 안내 한 줄)
  const headY = sq + L.miniLabelPx + L.headGap;
  const headText = `${g.name} · ${s.gain(g.gain)} · ${s.count(g.features.length)}`;
  labels.push({ type: 'text', x: 0, y: headY / H, text: W >= L.leadMinPx ? `${headText} — ${s.lead}` : headText, align: 'start', cls: 'head' });
  const legendY = wide ? headY : headY + L.legendDropPx;
  const extra: P[] = [];
  if (rows.every((r) => r.categorical)) {
    labels.push({ type: 'text', x: 1, y: legendY / H, text: s.catNote, align: 'end', cls: 'tick' });
  } else {
    const lx1 = W - L.legendRightPx, lx0 = lx1 - L.legendW;
    for (let i = 0; i < L.legendDots; i++) {
      const k = i / (L.legendDots - 1);
      extra.push([lx0 + (lx1 - lx0) * k, legendY, 3, 0.9, valTone(k * 100), -1]);
    }
    labels.push({ type: 'text', x: (lx0 - 6) / W, y: legendY / H, text: s.low, align: 'end', cls: 'tick' });
    labels.push({ type: 'text', x: (lx1 + 6) / W, y: legendY / H, text: s.high, align: 'start', cls: 'tick' });
  }

  // 벌떼: 가로 범위는 그룹 전체 |%|의 98번째 백분위로 좌우 대칭. 밖의 점은 가장자리에 붙이지 않고 버린다
  // (④ 벌떼와 같은 이유 — 겹겹이 쌓여 밝은 막대가 된다)
  const top = headY + (wide ? L.headPx.wide : L.headPx.narrow), bottom = H - L.bottomPx;
  const rowH = (bottom - top) / Math.max(1, rows.length);
  const abs = rows.flatMap((r) => r.pct.map(Math.abs)).sort((a, b) => a - b);
  // 올림한 정수로 둬야 끝 눈금 글(±lim%)이 실제 축 끝과 같다 — 반올림하면 눈금보다 바깥에 점이 찍힌다
  const lim = Math.max(L.minLim, Math.ceil(abs.length ? abs[Math.floor(L.clipQ * (abs.length - 1))] : 0));
  const labelW = wide ? L.labelW.wide : L.labelW.narrow;
  const ax0 = labelW + 8, ax1 = W - 8;
  const X = (v: number) => ax0 + (ax1 - ax0) * ((v + lim) / (2 * lim));
  const dot = wide ? L.dot.wide : L.dot.narrow, step = dot + L.gap;
  const swarm: P[] = [];
  rows.forEach((r, ri) => {
    const cy = top + rowH * (ri + 0.5);
    labels.push({ type: 'text', x: labelW / W, y: cy / H, text: r.id, align: 'end', cls: 'feature' });
    const used = new Map<number, number>();
    r.pct.forEach((v, i) => {
      if (Math.abs(v) > lim) return;
      // 가로를 점 간격 단위 열로 맞추고, 같은 열의 k번째 점은 줄 가운데에서 위아래로 번갈아 비킨다 → 겹치지 않는다
      const col = Math.round(X(v) / step);
      const k = used.get(col) ?? 0;
      used.set(col, k + 1);
      const off = Math.ceil(k / 2) * step * (k % 2 ? 1 : -1);
      if (Math.abs(off) > rowH * 0.45) return;
      swarm.push([col * step, cy + off, dot, 0.85, r.categorical ? TONE.dot : valTone(r.f[i]), -1]);
    });
  });
  for (let y = top; y <= bottom; y += 4) extra.push([X(0), y, 1.6, 0.28, TONE.text, -1]);

  // 축: 눈금(−lim·0·+lim) 한 줄 + 방향 글 한 줄
  const tickY = H - L.tickFromBottomPx, dirY = H - L.dirFromBottomPx;
  labels.push({ type: 'text', x: ax0 / W, y: tickY / H, text: s.pct(-lim), align: 'start', cls: 'tick' });
  labels.push({ type: 'text', x: X(0) / W, y: tickY / H, text: s.pct(0), align: 'center', cls: 'tick' });
  labels.push({ type: 'text', x: ax1 / W, y: tickY / H, text: s.pct(lim), align: 'end', cls: 'tick' });
  labels.push({ type: 'text', x: ax0 / W, y: dirY / H, text: s.down, align: 'start', cls: 'axis' });
  labels.push({ type: 'text', x: ax1 / W, y: dirY / H, text: s.up, align: 'end', cls: 'axis' });

  // 점 순서 = 3D 점 짝(assignPoints가 순서대로 점 구름을 배정한다). 닫힌 와플의 그룹 k 자리(k×100)에 그대로 그룹 k의
  // 작은 와플을 두어 점이 제자리에서 줄어들게 하고, 펼친 그룹 자리에는 벌떼 앞 100점을 두어 그 와플 점이 벌떼로
  // 흩어지게 한다. 펼친 그룹의 작은 와플·나머지 벌떼·0선·범례는 그 뒤(지형에서 날아온다)
  const p = new Pts();
  const add = (q: P) => p.add(q[0] / W, q[1] / H, q[2], q[3], q[4], -1, q[5]);
  const head = swarm.slice(0, 100);
  // 벌떼 점이 100개보다 적으면(범위 밖이 많은 작은 그룹) 보이지 않는 점으로 채워 뒤 그룹 자리가 밀리지 않게 한다
  while (head.length < 100) head.push([X(0), top, 1.6, 0, TONE.dot, -1]);
  groups.forEach((_, k) => (k === open ? head : mini[k]).forEach(add));
  mini[open].forEach(add);
  swarm.slice(100).forEach(add);
  extra.forEach(add);
  return { ...p.done(labels, TONE.amber, FOCUS_DIM), variant: `open:${open}`, summary: rows.map(s.row) };
}
