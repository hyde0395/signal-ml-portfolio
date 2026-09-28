// ③ 와플·④ 차트의 점 배치(설계 2026-09-25 §3.3·§3.4, 2026-09-27 개정). 데이터와 판 크기(px)를 받아
// 판 안 정규화 좌표의 점 목록과 HTML 이름표 목록을 돌려주는 순수 함수들이다. 2D 대체 그림과 3D 점이 같은 결과를 쓴다.
// 점 개수는 데이터 행 수가 아니라 차트마다 정한 고정 개수다(설계 §4 점 개수 원칙).
import type { ChartsData, CloudData } from './data';
import { TONE, type ChartLabel, type ChartLayout } from './types';

export type PlotSize = { w: number; h: number };
export type FeatureGroupInput = { id: string; gain: number; features: string[]; name: string };

export const DAY = 86_400_000;
export const utc = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const GOLDEN_ANGLE = 2.399963229728653; // 해바라기 배치: 원 안에 점을 고르게 펴는 각도

// 점을 하나씩 쌓아 두었다가 타입 배열로 바꾼다
export class Pts {
  private a = { x: [] as number[], y: [] as number[], size: [] as number[], alpha: [] as number[], tone: [] as number[], group: [] as number[], waffle: [] as number[] };
  add(x: number, y: number, size: number, alpha: number, tone: number, group = -1, waffle = -1): void {
    this.a.x.push(x); this.a.y.push(y); this.a.size.push(size); this.a.alpha.push(alpha); this.a.tone.push(tone); this.a.group.push(group); this.a.waffle.push(waffle);
  }
  done(labels: ChartLabel[]): ChartLayout {
    const a = this.a;
    return {
      n: a.x.length,
      x: Float32Array.from(a.x), y: Float32Array.from(a.y), size: Float32Array.from(a.size), alpha: Float32Array.from(a.alpha),
      tone: Uint8Array.from(a.tone), group: Int16Array.from(a.group), waffle: Int16Array.from(a.waffle), labels,
    };
  }
}

// ③ 점 와플: 그룹마다 10×10 = 점 100개, 중요도(gain %)를 반올림한 수만큼 켠다.
// 판 폭이 좁으면(휴대폰) 3×2로 두 줄. 이름표는 와플 바로 아래.
// 설명 줄(detailPx)은 판 맨 아래에 따로 둔다 — 피처 이름을 그룹마다 펼치면 옆 칸·글과 겹쳤다(설계 2026-09-28 §3).
// 이름표 칸(labelPx)은 와플 바로 아래 이름표 한 칸이 차지할 고정 높이 — 틈(labelGap) + 실제 글자 높이를
// 재서 정한 값이다(줄 높이의 비율로 정하면 두 줄(휴대폰) 배치에서 칸이 실제 글자 높이보다 좁아져 옆 줄
// 와플·설명 줄과 겹쳤다, 2026-09-28 e2e로 두 번 확인). 넓은 판(pct 1.25rem, 세 줄: pct·이름·개수)은
// 1440×900 실측 72.5px + 틈 2px ≈ 74.5px → 여유를 두고 76. 좁은 판은 개수를 빼고 두 줄만 쓰는 compact
// 이름표라 더 낮다 — 390×844 ko·en 실측 45.1px(모든 그룹 동일, 이름이 한 줄에 들어간다) + 4 → 올림해 50.
// detailPx.wide(설명 줄 자리)도 64에서 76으로: 가로가 짧은 휴대폰(844×390, 가로 모드)은 폭은 wideMinPx를
// 넘어도 줄 높이가 모자라 와플이 줄 높이에 걸리고(sq = rowH - labelPx), 이때 설명 줄 자리(usableH + 6)가
// 곧 판 바닥에 바짝 붙는다 — 13개 피처(lookup) 설명 줄 실측 높이가 64px이라 옛 64는 여유가 0이었다(844×390 e2e로 확인)
export const WAFFLE = { side: 10, wideMinPx: 560, labelGap: 2, labelPx: { wide: 76, narrow: 50 }, detailPx: { wide: 76, narrow: 120 } } as const;

export function waffleLayout(groups: FeatureGroupInput[], size: PlotSize, fmt: { pct(v: number): string; count(n: number): string }): ChartLayout {
  const wide = size.w >= WAFFLE.wideMinPx;
  const cols = wide ? groups.length : Math.ceil(groups.length / 2);
  const rows = Math.ceil(groups.length / cols);
  const labelPx = wide ? WAFFLE.labelPx.wide : WAFFLE.labelPx.narrow;
  const detailPx = wide ? WAFFLE.detailPx.wide : WAFFLE.detailPx.narrow;
  const usableH = Math.max(0, size.h - detailPx);
  const colW = size.w / cols, rowH = usableH / rows;
  // 와플은 칸 폭의 78%, 줄 높이에서 이름표 칸(labelPx)을 뺀 나머지를 넘지 않게
  const sq = Math.max(0, Math.min(colW * 0.78, rowH - labelPx));
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
      p.add(cx / size.w, cy / size.h, Math.max(1.6, cell * 0.72), on ? 0.95 : 0.13, on && holiday ? TONE.amber : TONE.dot, -1, gi);
    }
    // compact: 좁은 판은 개수 줄을 빼서(설명 줄에 이미 있다) 이름표를 두 줄로 낮춘다(labelPx.narrow가 그 높이다)
    labels.push({
      type: 'group', x: (x0 + sq / 2) / size.w, y: (y0 + sq + WAFFLE.labelGap) / size.h, id: g.id,
      pct: fmt.pct(g.gain), name: g.name, count: fmt.count(g.features.length), features: g.features, holiday, compact: !wide,
    });
  });
  // 설명 줄: 첫 와플의 왼쪽 끝에 맞춰, 마지막 줄 이름표 바로 아래에서 시작한다(틈 6px). 데스크톱처럼 와플이
  // 칸 폭에 걸려(가로로 좁아) 줄 높이를 다 못 쓰면(sq < rowH - labelPx) 이름표 밑에 빈 칸이 크게 남는데,
  // 그 빈 칸 대신 이름표 바로 아래로 당겨 설명 줄이 붕 떠 보이지 않게 한다. labelPx가 이제 실측 글자
  // 높이를 담고 있어(옛 고정 64와 달리) 세로로 좁은 판(사각형이 줄 높이를 꽉 채우는 경우, sq = rowH - labelPx)도
  // 이 자리(yLast + sq + labelPx + 6 = usableH + 6)가 그대로 안전하다 — 옛 자리(usableH + 8)로 따로 막을 필요가 없다
  const yLast = (rows - 1) * rowH;
  const detailY = yLast + sq + labelPx + 6;
  labels.push({ type: 'detail', x: ((colW - sq) / 2) / size.w, y: detailY / size.h });
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

// ④ 차트 2 구간별 분포 벌떼: 출발이 지난 편의 관측 하나 = 점 하나. 구간 8개를 왼쪽(D-61~90)에서
// 오른쪽(D-1~3)으로 놓고, 구간 안에서 같은 높이의 점은 좌우로 번갈아 비켜 쌓는다. 구간 평균을 이은 밝은 선이 U자.
// 평균이 가장 낮은 세 구간(지금 데이터로는 D-22~60)의 점은 호박색. ±22% 밖은 그리지 않는다(몇 개가 축을 늘려 모양을 뭉개지 않게).
// narrowColPx: 구간 칸이 이보다 좁으면(휴대폰) 이름표에서 "D-"를 뺀다 — 9px 글자로 "D-61~90"이 칸 폭을 다 채워 옆 이름표와 겹친다
export const SWARM = { dot: 3, gap: 0.4, clip: 22, linePts: 20, cheapCount: 3, narrowColPx: 56, marginLeft: 0.08, marginTop: 0.08, marginBottom: 0.12 } as const;

export function swarmLayout(c: ChartsData['curve'], size: PlotSize, s: { bin(lo: number, hi: number): string; pct(v: number): string; axis: string }): ChartLayout {
  const nb = c.bins.length;
  const left = size.w * SWARM.marginLeft, top = size.h * SWARM.marginTop;
  const innerW = size.w - left, innerH = size.h * (1 - SWARM.marginTop - SWARM.marginBottom);
  const colW = innerW / nb;
  const cx = (b: number) => left + (nb - 1 - b + 0.5) * colW; // 번호가 클수록(먼 출발일) 왼쪽
  const y = (v: number) => top + innerH * (1 - (v + SWARM.clip) / (2 * SWARM.clip));
  const step = SWARM.dot + SWARM.gap;
  const p = new Pts();

  const byBin: number[][] = Array.from({ length: nb }, () => []);
  c.sample.bin.forEach((b, i) => {
    const v = c.sample.pct[i] / 10;
    if (b >= 0 && b < nb && Math.abs(v) <= SWARM.clip) byBin[b].push(v);
  });
  // 호박색 구간은 번호를 박아 두지 않고 평균으로 고른다 — 재추출로 곡선 모양이 바뀌어도 "가장 싼 구간"이 맞게
  const cheapBins = c.mean.map((m, b) => [m, b] as const).sort((a, z) => a[0] - z[0]).slice(0, SWARM.cheapCount).map(([, b]) => b);
  byBin.forEach((vals, b) => {
    const cheap = cheapBins.includes(b);
    const used = new Map<number, number>();
    for (const v of vals) {
      // 높이를 점 간격 단위 줄로 맞추고, 같은 줄의 k번째 점은 가운데에서 좌우로 번갈아 비킨다 → 겹치지 않는다
      const row = Math.round(y(v) / step);
      const k = used.get(row) ?? 0;
      used.set(row, k + 1);
      const reach = Math.ceil(k / 2) * step;
      // 칸 폭을 넘치는 점은 버린다. 가장자리에 붙여 두면 같은 자리에 겹겹이 쌓여(더하기 혼합) 밝은 세로 막대로 보인다
      if (reach > colW * 0.45) continue;
      const off = reach * (k % 2 ? 1 : -1);
      p.add((cx(b) + off) / size.w, (row * step) / size.h, SWARM.dot, 0.55, cheap ? TONE.amber : TONE.dot);
    }
  });

  const nodes = c.mean
    .map((m, b) => [cx(b), y(Math.max(-SWARM.clip, Math.min(SWARM.clip, m / 10)))] as const)
    .sort((a, z) => a[0] - z[0]);
  for (let i = 0; i + 1 < nodes.length; i++) {
    for (let k = 1; k < SWARM.linePts; k++) {
      const t = k / SWARM.linePts;
      p.add((nodes[i][0] + (nodes[i + 1][0] - nodes[i][0]) * t) / size.w, (nodes[i][1] + (nodes[i + 1][1] - nodes[i][1]) * t) / size.h, 2.2, 0.9, TONE.text);
    }
  }
  for (const [nx, ny] of nodes) p.add(nx / size.w, ny / size.h, 6, 1, TONE.text);

  const labels: ChartLabel[] = [];
  const binText = (lo: number, hi: number) => (colW < SWARM.narrowColPx ? `${lo}~${hi}` : s.bin(lo, hi));
  c.bins.forEach(([lo, hi], b) => labels.push({ type: 'text', x: cx(b) / size.w, y: (top + innerH + 14) / size.h, text: binText(lo, hi), align: 'center', cls: 'tick' }));
  for (const v of [20, 0, -20]) labels.push({ type: 'text', x: (left - 6) / size.w, y: y(v) / size.h, text: s.pct(v), align: 'end', cls: 'tick' });
  labels.push({ type: 'text', x: left / size.w, y: (top * 0.4) / size.h, text: s.axis, align: 'start', cls: 'axis' });
  return p.done(labels);
}

// 표준정규분포의 분위수 함수(Acklam 근사, 오차 약 1e-9). 구름 점을 q10~q90 안에 뿌릴 때 쓴다
const IA = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239];
const IB = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
const IC = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
const ID = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];

export function invNorm(p: number): number {
  const tail = (q: number) => (((((IC[0] * q + IC[1]) * q + IC[2]) * q + IC[3]) * q + IC[4]) * q + IC[5]) / ((((ID[0] * q + ID[1]) * q + ID[2]) * q + ID[3]) * q + 1);
  if (p < 0.02425) return tail(Math.sqrt(-2 * Math.log(p)));
  if (p > 1 - 0.02425) return -tail(Math.sqrt(-2 * Math.log(1 - p)));
  const q = p - 0.5, r = q * q;
  return ((((((IA[0] * r + IA[1]) * r + IA[2]) * r + IA[3]) * r + IA[4]) * r + IA[5]) * q) / (((((IB[0] * r + IB[1]) * r + IB[2]) * r + IB[3]) * r + IB[4]) * r + 1);
}

// ④ 차트 4 예측 불확실성 구름: 출발일마다 q10~q90 사이에 점을 뿌리되, 분위(0.1~0.9)를 고르게 나눠 표준정규
// 분위수로 바꾸므로 예측가 근처는 빽빽하고 가장자리는 성기다. 예측가 아래·위는 폭이 달라 두 쪽을 따로 늘린다
// (q10·예측가·q90에 맞춘 두 쪽 정규분포 근사 — 점 위치는 표현용이고, 차트 글에 그렇게 밝힌다).
export const CLOUD = { perDate: 24, z90: 1.2815515655446004, marginLeft: 0.1, marginTop: 0.12, marginBottom: 0.12 } as const;

const valid = (cd: CloudData) => cd.dates.map((_, i) => i).filter((i) => cd.price[i] !== null && cd.lo[i] !== null && cd.hi[i] !== null);

export function cloudScale(cd: CloudData, size: PlotSize): { x(i: number): number; y(v: number): number } {
  const idx = valid(cd);
  const min = Math.min(...idx.map((i) => cd.lo[i]!)), max = Math.max(...idx.map((i) => cd.hi[i]!));
  const pad = (max - min) * 0.05 || 1;
  const dlo = min - pad, dhi = max + pad;
  const left = size.w * CLOUD.marginLeft, top = size.h * CLOUD.marginTop;
  const innerW = size.w - left, innerH = size.h * (1 - CLOUD.marginTop - CLOUD.marginBottom);
  const n = cd.dates.length;
  return {
    x: (i) => left + innerW * (n === 1 ? 0.5 : (i + 0.5) / n),
    y: (v) => top + innerH * (1 - (v - dlo) / (dhi - dlo)),
  };
}

export function cloudLayout(cd: CloudData, size: PlotSize, s: { money(v: number): string; dday(n: number): string; holiday(code: string): string; axis: string }): ChartLayout {
  const idx = valid(cd);
  const sc = cloudScale(cd, size);
  const colW = (size.w * (1 - CLOUD.marginLeft)) / cd.dates.length;
  const p = new Pts();
  for (const i of idx) {
    const price = cd.price[i]!, lo = cd.lo[i]!, hi = cd.hi[i]!;
    const hol = cd.holidays[cd.dates[i]] !== undefined;
    const rand = mulberry32(i + 1);
    for (let k = 0; k < CLOUD.perDate; k++) {
      const z = invNorm(0.1 + (0.8 * (k + 0.5)) / CLOUD.perDate);
      const v = z < 0 ? price + (z / CLOUD.z90) * (price - lo) : price + (z / CLOUD.z90) * (hi - price);
      const alpha = 0.16 + 0.34 * (1 - Math.abs(z) / CLOUD.z90);
      p.add((sc.x(i) + (rand() - 0.5) * colW * 0.7) / size.w, sc.y(v) / size.h, 2.2, alpha, hol ? TONE.amber : TONE.dot);
    }
    p.add(sc.x(i) / size.w, sc.y(price) / size.h, 4.2, 0.95, hol ? TONE.amber : TONE.text);
  }

  const labels: ChartLabel[] = [];
  const lo = Math.min(...idx.map((i) => cd.lo[i]!)), hi = Math.max(...idx.map((i) => cd.hi[i]!));
  const stepV = niceStep(hi - lo, 3);
  for (let v = Math.ceil(lo / stepV) * stepV; v <= hi; v += stepV) {
    labels.push({ type: 'text', x: (size.w * CLOUD.marginLeft - 6) / size.w, y: sc.y(v) / size.h, text: s.money(v), align: 'end', cls: 'tick' });
  }
  const n = cd.dates.length;
  for (const i of [...new Set([0, Math.floor((n - 1) / 2), n - 1])]) {
    const days = Math.round((utc(cd.dates[i]) - utc(cd.asOf)) / DAY);
    labels.push({ type: 'text', x: sc.x(i) / size.w, y: (size.h * (1 - CLOUD.marginBottom * 0.4)) / size.h, text: s.dday(days), align: 'center', cls: 'tick' });
  }
  // 공휴일 이름표: 이어진 공휴일 출발일 묶음 중 예측가가 가장 높은 두 묶음만(이름이 겹쳐 읽히지 않는 것을 막는다)
  const clusters: { at: number; top: number; code: string }[] = [];
  let cur: { at: number; top: number; code: string } | null = null;
  cd.dates.forEach((d, i) => {
    const code = cd.holidays[d];
    if (code === undefined) { cur = null; return; }
    const price = cd.price[i];
    if (!cur) { cur = { at: i, top: price ?? -Infinity, code }; clusters.push(cur); }
    else if (price !== null && price > cur.top) { cur.at = i; cur.top = price; cur.code = code; }
  });
  const left = size.w * CLOUD.marginLeft;
  clusters.filter((c) => c.top > -Infinity).sort((a, b) => b.top - a.top).slice(0, 2).forEach((c) => {
    // 왼쪽 가장자리 근처(축 이름표 "예측가(원)"이 있는 자리) 공휴일 이름표는 한 줄 아래로 내려 글자가 겹치지 않게 한다
    const nearAxis = Math.abs(sc.x(c.at) - left) < 140;
    const y = size.h * CLOUD.marginTop * 0.45 + (nearAxis ? 14 : 0);
    labels.push({ type: 'text', x: sc.x(c.at) / size.w, y: y / size.h, text: s.holiday(c.code), align: 'center', cls: 'holiday' });
  });
  labels.push({ type: 'text', x: (size.w * CLOUD.marginLeft) / size.w, y: 0.02, text: s.axis, align: 'start', cls: 'axis' });
  return p.done(labels);
}

// 눈금 간격: 1·2·5 × 10^k 중에서 대략 n칸이 되는 값
function niceStep(span: number, n: number): number {
  const raw = span / n;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const f = raw / mag;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * mag;
}

// 작고 빠른 시드 난수(점 좌우 흔들림이 매번 같게)
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
