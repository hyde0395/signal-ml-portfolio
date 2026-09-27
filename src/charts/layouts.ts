// ③ 와플·④ 차트의 점 배치(설계 2026-09-25 §3.3·§3.4, 2026-09-27 개정). 데이터와 판 크기(px)를 받아
// 판 안 정규화 좌표의 점 목록과 HTML 이름표 목록을 돌려주는 순수 함수들이다. 2D 대체 그림과 3D 점이 같은 결과를 쓴다.
// 점 개수는 데이터 행 수가 아니라 차트마다 정한 고정 개수다(설계 §4 점 개수 원칙).
import type { ChartsData } from './data';
import { TONE, type ChartLabel, type ChartLayout } from './types';

export type PlotSize = { w: number; h: number };
export type FeatureGroupInput = { id: string; gain: number; features: string[]; name: string };

export const DAY = 86_400_000;
export const utc = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const GOLDEN_ANGLE = 2.399963229728653; // 해바라기 배치: 원 안에 점을 고르게 펴는 각도

// 점을 하나씩 쌓아 두었다가 타입 배열로 바꾼다
export class Pts {
  private a = { x: [] as number[], y: [] as number[], size: [] as number[], alpha: [] as number[], tone: [] as number[], group: [] as number[] };
  add(x: number, y: number, size: number, alpha: number, tone: number, group = -1): void {
    this.a.x.push(x); this.a.y.push(y); this.a.size.push(size); this.a.alpha.push(alpha); this.a.tone.push(tone); this.a.group.push(group);
  }
  done(labels: ChartLabel[]): ChartLayout {
    const a = this.a;
    return {
      n: a.x.length,
      x: Float32Array.from(a.x), y: Float32Array.from(a.y), size: Float32Array.from(a.size), alpha: Float32Array.from(a.alpha),
      tone: Uint8Array.from(a.tone), group: Int16Array.from(a.group), labels,
    };
  }
}

// ③ 점 와플: 그룹마다 10×10 = 점 100개, 중요도(gain %)를 반올림한 수만큼 켠다.
// 판 폭이 좁으면(휴대폰) 3×2로 두 줄. 이름표는 와플 바로 아래.
export const WAFFLE = { side: 10, wideMinPx: 560 } as const;

export function waffleLayout(groups: FeatureGroupInput[], size: PlotSize, fmt: { pct(v: number): string; count(n: number): string }): ChartLayout {
  const cols = size.w >= WAFFLE.wideMinPx ? groups.length : Math.ceil(groups.length / 2);
  const rows = Math.ceil(groups.length / cols);
  const colW = size.w / cols, rowH = size.h / rows;
  // 와플은 칸 폭의 78%, 줄 높이의 58%를 넘지 않게(아래 42%는 이름표 자리)
  const sq = Math.min(colW * 0.78, rowH * 0.58);
  const cell = sq / WAFFLE.side;
  const p = new Pts();
  const labels: ChartLabel[] = [];
  groups.forEach((g, gi) => {
    const x0 = (gi % cols) * colW + (colW - sq) / 2;
    const y0 = Math.floor(gi / cols) * rowH;
    const lit = Math.round(g.gain);
    const holiday = g.id === 'holiday';
    for (let k = 0; k < WAFFLE.side * WAFFLE.side; k++) {
      const on = k < lit;
      const cx = x0 + ((k % WAFFLE.side) + 0.5) * cell;
      const cy = y0 + (Math.floor(k / WAFFLE.side) + 0.5) * cell;
      p.add(cx / size.w, cy / size.h, Math.max(1.6, cell * 0.72), on ? 0.95 : 0.13, on && holiday ? TONE.amber : TONE.dot);
    }
    labels.push({
      type: 'group', x: (x0 + sq / 2) / size.w, y: (y0 + sq + 10) / size.h, id: g.id,
      pct: fmt.pct(g.gain), name: g.name, count: fmt.count(g.features.length), features: g.features, holiday,
    });
  });
  return p.done(labels);
}

// ④ 차트 1 출발일 점 달력: 가로 = 주(월요일 시작), 세로 = 요일. 출발일 하나 = 점 perDate개로 된 원 하나.
// 원 크기·밝기 = 그 출발일의 노선·등급 평균 대비 %(-40%에서 +70% 사이를 0..1로). 공휴일 ±3일은 호박색.
export const CALENDAR = { perDate: 48, marginLeft: 0.07, marginTop: 0.12, marginBottom: 0.16 } as const;

export function calendarLayout(d: ChartsData, size: PlotSize, s: { weekday(i: number): string; month(iso: string): string; holiday(code: string): string }): ChartLayout {
  const first = utc(d.dates[0]);
  const t0 = first - ((new Date(first).getUTCDay() + 6) % 7) * DAY; // 첫 출발일이 든 주의 월요일
  const pos = d.dates.map((iso) => {
    const k = Math.round((utc(iso) - t0) / DAY);
    return { col: Math.floor(k / 7), row: k % 7 };
  });
  const weeks = Math.max(...pos.map((q) => q.col)) + 1;
  const left = size.w * CALENDAR.marginLeft, top = size.h * CALENDAR.marginTop;
  const cw = (size.w - left) / weeks;
  const ch = (size.h * (1 - CALENDAR.marginTop - CALENDAR.marginBottom)) / 7;
  const rMax = Math.min(cw, ch) * 0.46;
  const cx = (col: number) => left + (col + 0.5) * cw;
  const cy = (row: number) => top + (row + 0.5) * ch;
  const p = new Pts();
  d.dates.forEach((_, i) => {
    const norm = clamp01((d.depart.pct[i] / 10 + 40) / 110);
    const r = rMax * (0.35 + 0.65 * norm);
    const tone = d.depart.holiday[i] ? TONE.amber : TONE.dot;
    const alpha = 0.35 + 0.55 * norm;
    const dot = Math.max(1.6, r * 0.28);
    for (let k = 0; k < CALENDAR.perDate; k++) {
      const rho = r * Math.sqrt((k + 0.5) / CALENDAR.perDate), th = k * GOLDEN_ANGLE;
      p.add((cx(pos[i].col) + rho * Math.cos(th)) / size.w, (cy(pos[i].row) + rho * Math.sin(th)) / size.h, dot, alpha, tone, i);
    }
  });

  const labels: ChartLabel[] = [];
  for (let r = 0; r < 7; r++) labels.push({ type: 'text', x: (left - 6) / size.w, y: cy(r) / size.h, text: s.weekday(r), align: 'end', cls: 'tick' });
  let lastMonth = '';
  for (let c = 0; c < weeks; c++) {
    const iso = new Date(t0 + c * 7 * DAY).toISOString().slice(0, 10);
    if (iso.slice(0, 7) !== lastMonth) {
      labels.push({ type: 'text', x: cx(c) / size.w, y: (top * 0.4) / size.h, text: s.month(iso), align: 'start', cls: 'month' });
      lastMonth = iso.slice(0, 7);
    }
  }
  // 공휴일 이름표: 가까운 날짜끼리 겹치지 않게 두 줄로 엇갈린다(성탄절·신정은 한 주 차이)
  const base = size.h * (1 - CALENDAR.marginBottom * 0.6);
  d.labels.forEach((l, k) => {
    const i = d.dates.indexOf(l.date);
    if (i < 0) return;
    labels.push({ type: 'text', x: cx(pos[i].col) / size.w, y: (base + (k % 2) * 14) / size.h, text: s.holiday(l.code), align: 'center', cls: 'holiday' });
  });
  return p.done(labels);
}
