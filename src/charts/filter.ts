// ② 걸러내기 점(계획 8-1, 설계 2026-09-30-validation-filter-dots-design §4.1): 원본 행 표본을 소요 시간(가로) × 노선·등급 평균
// 대비 %(세로)에 뿌리고, 자막 칸마다 규칙을 하나씩 적용한다 — 걸린 점이 호박색으로 켜졌다가(sub 0) 판 아래로 떨어진다(sub 1).
// 배치는 (단계, sub)만의 함수라 거꾸로 스크롤하면 떨어진 점이 되돌아온다. 점 순서·개수는 모든 단계에서 같다(3D 슬롯 전환).
import type { ChartsData } from './data';
import { mulberry32, Pts, type PlotSize } from './layouts';
import { CHART_FOCUS_DIM, TONE, type ChartLabel, type ChartLayout } from './types';

// x0·x1: 가로 소요 분 범위, over: 판 오른쪽 끝 "960+" 칸 폭(판 폭 비율) — 400분 초과 행 중앙값이 665분, 90%가 1,085분
// 아래라 960에서 자르고 넘는 행은 칸 안에 흩어 둔다(가장자리에 세로 줄로 붙지 않게). lo·hi: 세로 %, 밖은 알파 0(7-2 규칙).
// ruleMin: 규칙 ① 소요 상한(facts data.filter.durationMax와 같은 400분). boxFrom: 규칙 ③ 상자 왼쪽 — 노선별 직항 p05 최댓값
// 150분 + 여유 65분(항공권 저장소 constants.py). subs: 단계마다 작은 단계 수(켜짐 → 떨어짐), subMs: 그 간격
// wideMinPx 820: 옆 칸(0.76W)의 "258,829 ROWS"·규칙 이름이 판 안에 들어가는 최소 폭(768px에서 7px 넘쳤다, 8-1 최종 검토)
export const FILTER = {
  stages: 3, subs: [1, 2, 2], subMs: 700, wideMinPx: 820,
  x0: 60, x1: 960, over: 0.05, lo: -90, hi: 300, ruleMin: 400, boxFrom: 215, seed: 11,
} as const;
const RULES = ['RULE 1 · DURATION · UNIT', 'RULE 2 · TIME MISMATCH', 'RULE 3 · DIRECT CHECK'];

export type FilterTexts = {
  axisX: string; axisY: string; box: string;
  rowsRaw: string; rowsKept: string; // "258,829 ROWS"처럼 이미 형식을 갖춘 글자(서버가 facts로 만든다)
  minutes(v: number): string; pct(v: number): string;
};

// 규칙 번호(0 통과)가 이 단계·sub에서 어떤 모습인지. ①·②는 단계 1, ③은 단계 2에서 켜지고, 그 단계 sub 1부터 떨어진다
export function filterState(rule: number, stage: number, sub: number): 'plain' | 'lit' | 'fallen' {
  if (rule === 0) return 'plain';
  const at = rule === 3 ? 2 : 1;
  if (stage < at) return 'plain';
  return stage > at || sub >= 1 ? 'fallen' : 'lit';
}

export function filterLayout(d: ChartsData, size: PlotSize, stage: number, sub: number, s: FilterTexts): ChartLayout {
  const f = d.filter;
  if (!f) throw new Error('charts.json에 filter가 없다');
  const st = Math.max(0, Math.min(FILTER.stages - 1, Math.floor(stage)));
  const sb = Math.max(0, Math.min(FILTER.subs[st] - 1, Math.floor(sub)));
  const W = size.w, H = size.h, wide = W >= FILTER.wideMinPx;
  // 넓은 판은 오른쪽 26%에 규칙 목록·행 수, 좁은 판은 위쪽 줄에 둔다
  const gx0 = W * (wide ? 0.08 : 0.14), gx1 = wide ? W * 0.72 : W - 8;
  const top = H * (wide ? 0.1 : 0.3), bottom = H * 0.86;
  const gxMain = gx0 + (gx1 - gx0) * (1 - FILTER.over);
  const X = (m: number) => gx0 + (gxMain - gx0 - 6) * ((m - FILTER.x0) / (FILTER.x1 - FILTER.x0));
  const Y = (v: number) => top + (bottom - top) * (1 - (v - FILTER.lo) / (FILTER.hi - FILTER.lo));
  const p = new Pts();
  const dot = wide ? 2.2 : 1.7;
  const lineA = 0.55;

  // 규칙 ① 세로 점선(400분)과 규칙 ③ 점선 상자 — 점 개수는 단계와 무관하게 같고 보일 때만 알파를 준다
  for (let y = top; y <= bottom; y += 7) p.add(X(FILTER.ruleMin) / W, y / H, 1.5, st >= 1 ? lineA : 0, TONE.amber);
  const bx0 = X(FILTER.boxFrom), bx1 = X(FILTER.ruleMin);
  for (let x = bx0; x <= bx1; x += 7) for (const y of [top, bottom]) p.add(x / W, y / H, 1.5, st === 2 ? lineA : 0, TONE.amber);
  for (let y = top; y <= bottom; y += 7) p.add(bx0 / W, y / H, 1.5, st === 2 ? lineA : 0, TONE.amber);

  // 표본 점: 960+ 칸의 좌우 흩어짐·떨어질 때 옆으로 비껴 가는 폭은 고정 시드 — 단계가 바뀌어도 칸 안 자리는 그대로
  const rand = mulberry32(FILTER.seed);
  for (let k = 0; k < f.dur.length; k++) {
    const m = f.dur[k], v = f.pct[k] / 10, rule = f.rule[k];
    const jitter = rand(), drift = (rand() - 0.5) * 0.04;
    const x = m > FILTER.x1 ? gxMain + (gx1 - gxMain) * (0.2 + 0.6 * jitter) : X(Math.max(FILTER.x0, m));
    const visible = m >= FILTER.x0 && v >= FILTER.lo && v <= FILTER.hi;
    const state = filterState(rule, st, sb);
    if (state === 'fallen') p.add(Math.min(1, Math.max(0, x / W + drift)), 1.12, dot, 0, TONE.amber);
    else p.add(x / W, (visible ? Y(v) : Y(0)) / H, dot, visible ? 0.7 : 0, state === 'lit' ? TONE.amber : TONE.dot);
  }

  // 이름표: 행 수를 맨 앞에 둔다 — 그림 판이 이름표를 순서(번호)로 그려, 같은 자리의 플립이 단계 사이에 이어진다
  const labels: ChartLabel[] = [];
  const kept = st === 2 && sb >= 1;
  const sideX = wide ? W * 0.76 : gx0;
  labels.push({ type: 'text', x: sideX / W, y: (wide ? H * 0.62 : H * 0.07) / H, text: kept ? s.rowsKept : s.rowsRaw, align: 'start', cls: 'stat' });
  RULES.forEach((text, i) => {
    const on = i < 2 ? st >= 1 : st >= 2;
    const x = wide ? sideX : gx0 + ((W - 8 - gx0) / 3) * i;
    const y = wide ? H * 0.12 + i * 24 : H * 0.18;
    labels.push({ type: 'text', x: x / W, y: y / H, text: wide ? text : text.slice(0, 6), align: 'start', cls: on ? 'ruleOn' : 'rule' });
  });
  for (const m of [120, 240, 360, 480, 720]) labels.push({ type: 'text', x: X(m) / W, y: (bottom + (H - bottom) * 0.45) / H, text: s.minutes(m), align: 'center', cls: 'tick' });
  labels.push({ type: 'text', x: ((gxMain + gx1) / 2) / W, y: (bottom + (H - bottom) * 0.45) / H, text: `${FILTER.x1}+`, align: 'center', cls: 'tick' });
  for (const v of [200, 100, 0, -50]) labels.push({ type: 'text', x: (gx0 - 6) / W, y: Y(v) / H, text: s.pct(v), align: 'end', cls: 'tick' });
  labels.push({ type: 'text', x: gx0 / W, y: (top * 0.45) / H, text: s.axisY, align: 'start', cls: 'axis' });
  labels.push({ type: 'text', x: gxMain / W, y: (bottom + (H - bottom) * 0.85) / H, text: s.axisX, align: 'end', cls: 'axis' });
  if (st === 2) labels.push({ type: 'text', x: bx0 / W, y: Math.max(8, top - 10) / H, text: s.box, align: 'start', cls: 'note' });
  return { ...p.done(labels, TONE.text, CHART_FOCUS_DIM), variant: `stage:${st}:${sb}` };
}
