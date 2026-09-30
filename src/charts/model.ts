// ③ 모델 구조 점(계획 7-2, 설계 2026-09-30-model-dots-design): 인천→나리타 LCC 관측 점이 자막 칸에 맞춰 세 단계로 옮겨 간다 —
// 0 모은 가격(노선·등급 평균 대비 %) → 1 NeuralProphet 기준 가격 선 → 2 기준에서 벗어난 몫(잔차 %, XGBoost가 배우는 것).
// 세 단계의 점 순서·개수·group이 같아야 3D에서 같은 지형 점이 단계 사이를 옮겨 다닌다(variant가 바뀌면 반대 슬롯, chartTargets.pickSlot).
import type { ChartsData } from './data';
import { monthLabels, mulberry32, Pts, utc, type PlotSize } from './layouts';
import { CHART_FOCUS_DIM, TONE, type ChartLabel, type ChartLayout } from './types';

// lo·hi: 세로 %범위 — 관측의 1~99번째 백분위(약 −61~+108%)가 들어가고 밖은 가장자리로 자른다. 세 단계가 같은 눈금이라
// 3단계에서 점이 "기준만큼 내려앉는" 것이 그대로 보인다. residHot: 큰 잔차(|%|) 호박색 — 지금 데이터로 관측의 약 13%.
// dashOn/dashPeriod: 3단계 0 줄은 선 점 5개 중 3개만 보여 끊긴 점선. jitterPx: 같은 출발일 관측을 좌우로 조금 흔든다(세로 줄 한 개로 겹치지 않게)
export const MODEL = { stages: 3, wideMinPx: 560, lo: -60, hi: 110, linePts: 240, dashOn: 3, dashPeriod: 5, residHot: 50, jitterPx: 1.6, seed: 7 } as const;

// 관측·기준이 같은 평균(노선·등급)에 대한 %라, 평균이 약분되어 obs / base − 1이 된다. 모델 목표 log1p(y) − log1p(base)와의
// 차이는 가격이 수만 원대라 0.001% 수준이다(설계 §2)
export const residualPct = (obs: number, base: number) => ((1 + obs / 100) / (1 + base / 100) - 1) * 100;

export type ModelTexts = {
  month(iso: string): string;
  pct(v: number): string;
  axis: string;      // 1·2단계 세로축(노선·등급 평균 대비)
  axisResid: string; // 3단계 세로축(기준 가격 대비)
  line: string;      // 기준 가격 선 이름표
};

export function modelLayout(d: ChartsData, size: PlotSize, stage: number, s: ModelTexts): ChartLayout {
  const m = d.model;
  if (!m) throw new Error('charts.json에 model이 없다');
  const st = Math.max(0, Math.min(MODEL.stages - 1, Math.floor(stage)));
  const W = size.w, H = size.h, wide = W >= MODEL.wideMinPx;
  // 왼쪽은 눈금 글자 자리, 위는 축 이름, 아래는 월 이름 자리
  const gx0 = W * (wide ? 0.07 : 0.13), gx1 = W - (wide ? 12 : 8);
  const top = H * 0.1, bottom = H * 0.86;
  const t0 = utc(d.dates[0]), t1 = utc(d.dates[d.dates.length - 1]);
  const XT = (t: number) => gx0 + (gx1 - gx0) * ((t - t0) / Math.max(1, t1 - t0));
  const X = (iso: string) => XT(utc(iso));
  const Y = (v: number) => top + (bottom - top) * (1 - (Math.min(MODEL.hi, Math.max(MODEL.lo, v)) - MODEL.lo) / (MODEL.hi - MODEL.lo));
  const p = new Pts();
  const dot = wide ? 2.2 : 1.7;

  // 0% 흐린 기준선(차트 1과 같은 모양). 3단계에서는 밝은 끊긴 점선이 그 자리를 대신해 알파 0 — 개수는 단계와 무관하게 같다
  for (let x = gx0; x <= gx1; x += 6) p.add(x / W, Y(0) / H, 1.6, st === 2 ? 0 : 0.28, TONE.text);

  // 관측 점: 흔들림은 단계와 무관하게 같은 시드 — 단계가 바뀌어도 점이 좌우로는 움직이지 않는다
  const rand = mulberry32(MODEL.seed);
  m.obs.date.forEach((di, k) => {
    const jx = (rand() - 0.5) * 2 * MODEL.jitterPx;
    const x = Math.min(1, Math.max(0, (X(d.dates[di]) + jx) / W));
    const o = m.obs.pct[k] / 10, b = m.base[di];
    if (st < 2) {
      const hol = d.depart.holiday[di] !== null;
      p.add(x, Y(o) / H, dot, st === 0 ? 0.6 : 0.2, hol ? TONE.amber : TONE.dot, di);
    } else if (b === null) {
      p.add(x, Y(o) / H, dot, 0, TONE.dot, di); // 기준이 없는 날은 잔차를 그릴 수 없다(지금 데이터엔 없다)
    } else {
      const r = residualPct(o, b / 10);
      p.add(x, Y(r) / H, dot, 0.6, Math.abs(r) >= MODEL.residHot ? TONE.amber : TONE.dot, di);
    }
  });

  // 기준 가격 선: 시간을 고르게 나눈 자리마다 점 하나, 값은 앞뒤 출발일 기준 사이 직선 보간(출발일 간격이 들쭉날쭉해
  // 출발일마다 점을 두면 먼 출발일 쪽 선이 성겼다). group = 가장 가까운 출발일 — 3D에서 그 출발일의 지형 점이 선이 된다
  const known = d.dates.map((iso, i) => ({ t: utc(iso), v: m.base[i], i })).filter((k): k is { t: number; v: number; i: number } => k.v !== null);
  let j = 0, lastY = Y(0);
  for (let i = 0; i < MODEL.linePts; i++) {
    const t = t0 + ((t1 - t0) * i) / (MODEL.linePts - 1);
    while (j + 1 < known.length && known[j + 1].t <= t) j++;
    const a = known[j], b = known[Math.min(j + 1, known.length - 1)];
    const f = b.t > a.t ? Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t))) : 0;
    const v = (a.v + (b.v - a.v) * f) / 10;
    const g = b.t - t < t - a.t ? b.i : a.i;
    const x = XT(t) / W;
    if (st === 2) p.add(x, Y(0) / H, 2.2, i % MODEL.dashPeriod < MODEL.dashOn ? 0.75 : 0, TONE.text, g);
    else p.add(x, Y(v) / H, 2.6, st === 1 ? 0.95 : 0, TONE.text, g);
    lastY = st === 2 ? Y(0) : Y(v);
  }

  const labels: ChartLabel[] = [];
  for (const v of [100, 50, 0, -50]) labels.push({ type: 'text', x: (gx0 - 6) / W, y: Y(v) / H, text: s.pct(v), align: 'end', cls: 'tick' });
  labels.push({ type: 'text', x: gx0 / W, y: (top * 0.35) / H, text: st === 2 ? s.axisResid : s.axis, align: 'start', cls: 'axis' });
  labels.push(...monthLabels(d.dates, X, s.month, bottom + (H - bottom) * 0.55, size));
  // 선 이름표: 선 오른쪽 끝 바로 위(판 위로 나가지 않게 8px에서 멈춘다)
  if (st >= 1) labels.push({ type: 'text', x: gx1 / W, y: Math.max(8, lastY - 12) / H, text: s.line, align: 'end', cls: 'head' });
  return { ...p.done(labels, TONE.text, CHART_FOCUS_DIM), variant: `stage:${st}` };
}
