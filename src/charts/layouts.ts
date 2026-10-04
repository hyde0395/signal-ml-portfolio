// ③ 와플·④·⑤ 차트의 점 배치(설계 2026-09-25 §3.3·§3.4, 2026-09-27 개정). 데이터와 판 크기(px)를 받아
// 판 안 정규화 좌표의 점 목록과 HTML 이름표 목록을 돌려주는 순수 함수들이다. 2D 대체 그림과 3D 점이 같은 결과를 쓴다.
// 점 개수는 데이터 행 수가 아니라 차트마다 정한 고정 개수다(설계 §4 점 개수 원칙).
import type { ChartsData, CloudData } from './data';
import { addStar, LINE } from './lines';
import { CHART_FOCUS_DIM, FOCUS_DIM, TONE, type ChartItem, type ChartLabel, type ChartLayout, type OverlayShape } from './types';

export type PlotSize = { w: number; h: number };
export type FeatureGroupInput = { id: string; gain: number; features: string[]; name: string };

export const DAY = 86_400_000;
export const utc = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const GOLDEN_ANGLE = 2.399963229728653; // 해바라기 배치: 원 안에 점을 고르게 펴는 각도

// 점을 하나씩 쌓아 두었다가 타입 배열로 바꾼다
export class Pts {
  private a = { x: [] as number[], y: [] as number[], size: [] as number[], alpha: [] as number[], tone: [] as number[], group: [] as number[], hl: [] as number[] };
  add(x: number, y: number, size: number, alpha: number, tone: number, group = -1, hl = -1): void {
    this.a.x.push(x); this.a.y.push(y); this.a.size.push(size); this.a.alpha.push(alpha); this.a.tone.push(tone); this.a.group.push(group); this.a.hl.push(hl);
  }
  // focusTone·focusDim: 이 배치가 강조될 때 쓸 색·흐림 정도(차트마다 다르다, types.ts ChartLayout 참고)
  done(labels: ChartLabel[], focusTone: number, focusDim: number): ChartLayout {
    const a = this.a;
    return {
      n: a.x.length,
      x: Float32Array.from(a.x), y: Float32Array.from(a.y), size: Float32Array.from(a.size), alpha: Float32Array.from(a.alpha),
      tone: Uint8Array.from(a.tone), group: Int16Array.from(a.group), hl: Int16Array.from(a.hl), focusTone, focusDim, labels,
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
  return p.done(labels, TONE.amber, FOCUS_DIM);
}

// ④ 차트 1 출발일(설계 2026-09-29 §2, 시안 3): 시간 흐름 점 그래프 + 요일 평균. 가로 = 출발일(실제 날짜 비례), 세로 = 노선·등급
// 평균 대비 %. 출발일 하나 = 점 뭉치 하나(3D에서는 그 출발일의 배경 점이 모인다, group). 막대·줄기 선은 쓰지 않는다 —
// 점을 쌓은 막대는 사용자가 "별로"(2026-09-25), 줄기 선은 시안에서 지저분했다. 호박색은 공휴일 무렵이면서 +25% 이상인
// 날만 — 공휴일 ±3일을 모두 칠하면 강조가 흐려졌다(사용자 지적 2026-09-29). 오른쪽(휴대폰은 아래)은 요일 평균
// 이름표 겹침 어림값: 공휴일 이름(11px 글꼴) 글자당 폭, 월 이름 사이 최소 간격
export const DEPART_TEXT = { charPx: 6.6, monthGapPx: 34 } as const;
export const DEPART = { perDate: 12, wideMinPx: 560, lo: -30, hi: 75, hotPct: 25, hotWeekday: 15, weekLo: -25, weekHi: 25 } as const;

// 출발일 가로축의 월 이름(차트 1·③ 모델 구조가 같이 쓴다). X = 출발일 → 판 안 px, y = 이름표 줄 높이(px).
// 앞 월 이름과 monthGapPx보다 가까우면 뺀다 — 첫 출발일(5월 중순)과 다음 달 첫 출발일이 붙어 있어 좁은 판에서 "MayJun"처럼 붙었다
export function monthLabels(dates: string[], X: (iso: string) => number, month: (iso: string) => string, y: number, size: PlotSize): ChartLabel[] {
  const out: ChartLabel[] = [];
  let lastMonth = '', lastMonthX = -Infinity;
  dates.forEach((iso) => {
    if (iso.slice(0, 7) === lastMonth) return;
    lastMonth = iso.slice(0, 7);
    if (X(iso) - lastMonthX < DEPART_TEXT.monthGapPx) return;
    lastMonthX = X(iso);
    out.push({ type: 'text', x: X(iso) / size.w, y: y / size.h, text: month(iso), align: 'center', cls: 'month' });
  });
  return out;
}

export function departLayout(
  d: ChartsData, size: PlotSize,
  s: {
    month(iso: string): string; weekday(i: number): string; holiday(code: string): string; pct(v: number): string; axis: string; weekdayTitle: string;
    // 짚은 출발일 문장. date = ISO 날짜, pct = 평균 대비 %, holiday = 공휴일 이름(공휴일 무렵이 아니면 없음)
    tip(v: { date: string; pct: number; holiday?: string }): string;
  },
): ChartLayout {
  const wide = size.w >= DEPART.wideMinPx;
  const W = size.w, H = size.h;
  // 점 그래프 영역(px). 좁은 판은 오른쪽 끝을 14px 비운다 — 마지막 봉우리(설날) 위 가운데 맞춤 이름표가
  // 판 밖(화면 가장자리)까지 나갔다(2026-09-29 390px 눈 확인)
  const gx0 = W * (wide ? 0.06 : 0.1), gx1 = wide ? W * 0.74 : W - 14, gy0 = 0, gy1 = H * (wide ? 1 : 0.68);
  const top = gy0 + (gy1 - gy0) * 0.08, bottom = gy1 - (gy1 - gy0) * 0.14;
  const t0 = utc(d.dates[0]), t1 = utc(d.dates[d.dates.length - 1]);
  const X = (iso: string) => gx0 + (gx1 - gx0 - 8) * ((utc(iso) - t0) / Math.max(1, t1 - t0)) + 4;
  const Y = (v: number) => top + (bottom - top) * (1 - (Math.min(DEPART.hi, Math.max(DEPART.lo, v)) - DEPART.lo) / (DEPART.hi - DEPART.lo));
  const r = wide ? 4 : 2.4;
  const p = new Pts();
  const labels: ChartLabel[] = [];
  const items: ChartItem[] = [];
  // 0% 기준선
  for (let x = gx0; x <= gx1; x += 6) p.add(x / W, Y(0) / H, 1.6, 0.28, TONE.text);
  d.dates.forEach((iso, i) => {
    const v = d.depart.pct[i] / 10;
    const hot = d.depart.holiday[i] !== null && v >= DEPART.hotPct;
    const cx = X(iso), cy = Y(v);
    // 강조 번호 = 출발일 번호(날짜 순 = 화면 왼쪽부터). 뭉치의 해바라기 배치 중심이 곧 (cx, cy)라 항목 자리로 쓴다
    for (let k = 0; k < DEPART.perDate; k++) {
      const rho = r * Math.sqrt((k + 0.5) / DEPART.perDate), th = k * GOLDEN_ANGLE;
      p.add((cx + rho * Math.cos(th)) / W, (cy + rho * Math.sin(th)) / H, 1.8, 0.8, hot ? TONE.amber : TONE.dot, i, i);
    }
    const code = d.depart.holiday[i];
    items.push({ key: i, x: cx / W, y: cy / H, text: s.tip({ date: iso, pct: v, holiday: code === null ? undefined : s.holiday(code) }) });
  });
  for (const v of [50, 25, 0, -25]) labels.push({ type: 'text', x: (gx0 - 6) / W, y: Y(v) / H, text: s.pct(v), align: 'end', cls: 'tick' });
  labels.push({ type: 'text', x: gx0 / W, y: (top * 0.35) / H, text: s.axis, align: 'start', cls: 'axis' });
  labels.push(...monthLabels(d.dates, X, s.month, bottom + (gy1 - bottom) * 0.6, size));
  // 공휴일 이름표: 봉우리 바로 위. 옆 이름표와 가로로 겹치면 한 줄(13px) 위로 올린다 — 글자 폭은 배치 함수에서 잴 수 없어
  // 글자 수 × charPx로 어림한다(좁은 영어 판에서 Christmas·Seollal이 붙었다). 판 위로 나가지 않게 8px에서 멈춘다
  const placed: { x: number; y: number; half: number }[] = [];
  d.labels
    .map((l) => ({ l, i: d.dates.indexOf(l.date) }))
    .filter(({ i }) => i >= 0)
    .sort((a, b) => X(a.l.date) - X(b.l.date))
    .forEach(({ l, i }) => {
      const text = s.holiday(l.code), x = X(l.date), half = (text.length * DEPART_TEXT.charPx) / 2;
      let y = Math.max(8, Y(d.depart.pct[i] / 10) - r - 10);
      for (const q of placed) if (Math.abs(q.x - x) < q.half + half + 4 && Math.abs(q.y - y) < 12) y = Math.max(8, q.y - 13);
      placed.push({ x, y, half });
      labels.push({ type: 'text', x: x / W, y: y / H, text, align: 'center', cls: 'holiday' });
    });

  // 요일 평균(월=0 … 일=6)
  const sum = Array(7).fill(0), cnt = Array(7).fill(0);
  d.dates.forEach((iso, i) => { const k = (new Date(utc(iso)).getUTCDay() + 6) % 7; sum[k] += d.depart.pct[i] / 10; cnt[k]++; });
  const avg = sum.map((v, k) => (cnt[k] ? v / cnt[k] : null));
  const clampW = (v: number) => Math.min(DEPART.weekHi, Math.max(DEPART.weekLo, v));
  if (wide) {
    // 요일 이름 칸(nameX, 오른쪽 맞춤)과 점 줄 시작(sx0) 사이를 비워 둔다 — 음수 값 이름표가 점 줄 왼쪽 끝 밖에 붙으므로
    // 이름 바로 옆에서 시작하면 "화−17%"처럼 요일 이름과 붙었다(2026-09-29 눈 확인)
    const nameX = W * 0.78 + 16, sx0 = W * 0.78 + 64, sx1 = W - 44, sy0 = H * 0.12, sy1 = H * 0.9;
    const SX = (v: number) => sx0 + (sx1 - sx0) * ((clampW(v) - DEPART.weekLo) / (DEPART.weekHi - DEPART.weekLo));
    const rowH = (sy1 - sy0) / 7;
    labels.push({ type: 'text', x: (W * 0.78) / W, y: (sy0 * 0.45) / H, text: s.weekdayTitle, align: 'start', cls: 'axis' });
    for (let y = sy0; y <= sy1; y += 4) p.add(SX(0) / W, y / H, 1.6, 0.28, TONE.text);
    avg.forEach((a, k) => {
      const y = sy0 + rowH * (k + 0.5);
      labels.push({ type: 'text', x: nameX / W, y: y / H, text: s.weekday(k), align: 'end', cls: 'tick' });
      if (a === null) return;
      const tone = a > DEPART.hotWeekday ? TONE.amber : TONE.dot;
      const x0 = SX(0), x1 = SX(a), n = Math.max(1, Math.round(Math.abs(x1 - x0) / 3));
      for (let j = 1; j <= n; j++) p.add((x0 + ((x1 - x0) * j) / n) / W, y / H, 2.2, 0.85, tone);
      labels.push({ type: 'text', x: (x1 + (a >= 0 ? 6 : -6)) / W, y: y / H, text: s.pct(Math.round(a)), align: a >= 0 ? 'start' : 'end', cls: 'tick' });
    });
  } else {
    const sy0 = H * 0.74, sy1 = H * 0.96, colW = (W * 0.9) / 7, sx0 = W * 0.1;
    const SY = (v: number) => sy0 + 14 + (sy1 - sy0 - 28) * (1 - (clampW(v) - DEPART.weekLo) / (DEPART.weekHi - DEPART.weekLo));
    labels.push({ type: 'text', x: 0, y: (sy0 - 4) / H, text: s.weekdayTitle, align: 'start', cls: 'axis' });
    for (let x = sx0; x <= W; x += 5) p.add(x / W, SY(0) / H, 1.6, 0.28, TONE.text);
    avg.forEach((a, k) => {
      const cx = sx0 + colW * (k + 0.5);
      labels.push({ type: 'text', x: cx / W, y: sy1 / H, text: s.weekday(k), align: 'center', cls: 'tick' });
      if (a === null) return;
      const tone = a > DEPART.hotWeekday ? TONE.amber : TONE.dot;
      for (let j = 0; j < 5; j++) { const rho = 2.4 * Math.sqrt((j + 0.5) / 5), th = j * GOLDEN_ANGLE; p.add((cx + rho * Math.cos(th)) / W, (SY(a) + rho * Math.sin(th)) / H, 1.8, 0.9, tone); }
      labels.push({ type: 'text', x: cx / W, y: (SY(a) - 10) / H, text: s.pct(Math.round(a)), align: 'center', cls: 'tick' });
    });
  }
  return { ...p.done(labels, TONE.text, CHART_FOCUS_DIM), items, initial: -1 };
}

// ④ 차트 2 구간별 분포 벌떼(설계 2026-10-04 §4, 시안 ucurve-constellation): 출발이 지난 편의 관측 하나 = 점 하나(배경 층 —
// 작고 옅게, 모두 파랑). 구간 8개를 왼쪽(D-61~90)에서 오른쪽(D-1~3)으로 놓고, 같은 높이의 점은 좌우로 번갈아 비켜 쌓는다.
// 구간 평균 8개는 별(빛 번짐 + 심)과 가는 별자리 선(결론 층). 가장 싼 구간의 별만 호박색·조금 크게, 그 아래 최저 이름표,
// 가장 가까운 구간(D-1~3) 위에 출발 직전 이름표. ±22% 밖은 그리지 않는다(몇 개가 축을 늘려 모양을 뭉개지 않게).
// sampleA: 표본 알파 — 차트 2는 늘 한 구간이 짚혀 있어(처음 = 가장 싼 구간) 나머지는 × CHART_FOCUS_DIM(0.45) ≈ 0.2가 되고,
// 짚은 구간만 0.45로 밝다(설계 §2 "짚은 항목만 약 0.45")
// narrowColPx: 구간 칸이 이보다 좁으면(휴대폰) 이름표에서 "D-"를 뺀다 — 9px 글자로 "D-61~90"이 칸 폭을 다 채워 옆 이름표와 겹친다
export const SWARM = { dot: 2.4, gap: 0.5, sampleA: 0.45, star: 6.8, starKey: 9.2, clip: 22, narrowColPx: 56, marginLeft: 0.08, marginTop: 0.12, marginBottom: 0.12 } as const;

export function swarmLayout(
  c: ChartsData['curve'], size: PlotSize,
  // tip: 짚은 구간 문장. bin = 구간 이름, pct = 구간 평균(같은 편 평균 대비 %), n = 관측 수
  s: {
    bin(lo: number, hi: number): string; pct(v: number): string; axis: string; tip(v: { bin: string; pct: number; n: number }): string;
    zero: string; callMin(lo: number, hi: number): string; callLast: string; pct1(v: number): string;
  },
): ChartLayout {
  const nb = c.bins.length;
  const left = size.w * SWARM.marginLeft, top = size.h * SWARM.marginTop;
  const innerW = size.w - left, innerH = size.h * (1 - SWARM.marginTop - SWARM.marginBottom);
  const colW = innerW / nb;
  const cx = (b: number) => left + (nb - 1 - b + 0.5) * colW; // 번호가 클수록(먼 출발일) 왼쪽
  // 강조·항목 번호는 화면 왼쪽부터 매긴다(구간 번호의 반대) — 키보드 →·aria-valuenow 증가가 화면 오른쪽 이동과 같게
  const keyOf = (b: number) => nb - 1 - b;
  const y = (v: number) => top + innerH * (1 - (v + SWARM.clip) / (2 * SWARM.clip));
  const step = SWARM.dot + SWARM.gap;
  const p = new Pts();

  const byBin: number[][] = Array.from({ length: nb }, () => []);
  c.sample.bin.forEach((b, i) => {
    const v = c.sample.pct[i] / 10;
    if (b >= 0 && b < nb && Math.abs(v) <= SWARM.clip) byBin[b].push(v);
  });
  // 0% 기준(같은 편 평균): 성긴 점선 — 기준 층(설계 §2). 표본보다 먼저 그려 뒤에 깔린다
  for (let x = left; x <= size.w - 4; x += 7) p.add(x / size.w, y(0) / size.h, 1.6, 0.35, TONE.text);
  byBin.forEach((vals, b) => {
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
      p.add((cx(b) + off) / size.w, (row * step) / size.h, SWARM.dot, SWARM.sampleA, TONE.dot, -1, keyOf(b));
    }
  });

  const nodes = c.mean
    .map((m, b) => ({ b, x: cx(b), y: y(Math.max(-SWARM.clip, Math.min(SWARM.clip, m / 10))), v: m / 10 }))
    .sort((a, z) => a.x - z.x);
  // 호박색 구간은 번호를 박아 두지 않고 평균으로 고른다 — 재추출로 곡선 모양이 바뀌어도 "가장 싼 구간"이 맞게
  const cheapest = c.mean.reduce((best, m, b) => (m < c.mean[best] ? b : best), 0);
  for (const n of nodes) {
    const key = n.b === cheapest;
    addStar(p, n.x / size.w, n.y / size.h, key ? SWARM.starKey : SWARM.star, key ? TONE.amber : TONE.text);
  }
  const lines = [{ pts: nodes.flatMap((n) => [n.x / size.w, n.y / size.h]), tone: TONE.text, alpha: LINE.alpha, width: LINE.width }];

  const labels: ChartLabel[] = [];
  const binText = (lo: number, hi: number) => (colW < SWARM.narrowColPx ? `${lo}~${hi}` : s.bin(lo, hi));
  // 항목 자리 = 구간 마디(평균 높이). 문장의 구간 이름은 좁은 판에서도 "D-"를 뺀 이름표가 아니라 온전한 이름으로
  const items: ChartItem[] = Array.from({ length: nb }, (_, k) => {
    const b = nb - 1 - k, [lo, hi] = c.bins[b];
    const m = Math.max(-SWARM.clip, Math.min(SWARM.clip, c.mean[b] / 10));
    return { key: k, x: cx(b) / size.w, y: y(m) / size.h, text: s.tip({ bin: s.bin(lo, hi), pct: c.mean[b] / 10, n: c.n[b] }) };
  });
  c.bins.forEach(([lo, hi], b) => labels.push({ type: 'text', x: cx(b) / size.w, y: (top + innerH + 14) / size.h, text: binText(lo, hi), align: 'center', cls: 'tick' }));
  for (const v of [20, 10, 0, -10, -20]) labels.push({ type: 'text', x: (left - 6) / size.w, y: y(v) / size.h, text: s.pct(v), align: 'end', cls: 'tick' });
  labels.push({ type: 'text', x: left / size.w, y: (top * 0.4) / size.h, text: s.axis, align: 'start', cls: 'axis' });
  labels.push({ type: 'text', x: (size.w - 4) / size.w, y: (y(0) - 8) / size.h, text: s.zero, align: 'end', cls: 'axis' });
  const minN = nodes.find((n) => n.b === cheapest)!, lastN = nodes.find((n) => n.b === 0)!;
  const [mlo, mhi] = c.bins[cheapest];
  labels.push({ type: 'callout', x: minN.x / size.w, y: minN.y / size.h, value: s.pct1(minN.v), note: s.callMin(mlo, mhi), tone: 'amber', place: 'below' });
  labels.push({ type: 'callout', x: lastN.x / size.w, y: lastN.y / size.h, value: s.pct1(lastN.v), note: s.callLast, tone: 'text', place: 'above' });
  // 처음에는 평균이 가장 낮은(가장 싼) 구간을 강조해 둔다(조작 규칙 표)
  return { ...p.done(labels, TONE.text, CHART_FOCUS_DIM), items, initial: keyOf(cheapest), lines };
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

// ⑤ 차트 4 예측 구간(설계 2026-10-04 §4, 시안 interval-constellation v6): 출발일마다 q10~q90 사이에 점을 뿌리되 분위(0.1~0.9)를
// 고르게 나눠 표준정규 분위수로 바꾸므로 예측가 근처는 빽빽하고 가장자리는 성기다(두 쪽 정규 근사 — 점 위치는 표현용, 자막에 밝힘).
// 가운데 50%(분위 0.25~0.75)는 크고 진하게, 바깥은 작고 옅게 — 팬 차트의 두 층. 예측가는 별 + 별자리 선.
// 넓은 판(panelMinPx 이상)은 오른쪽 칸(판 폭의 panelFrac, panelMin~panelMax px)에 짚은 날의 분위수 점 그림(QDOT)
// focusDim 0.8: 짚은 날 외 점을 조금만 흐린다 — 0.45면 처음부터 짚힌 상태라 구름 전체가 늘 어두웠다(시안 대비)
export const CLOUD = {
  perDate: 30, z90: 1.2815515655446004, coreLo: 0.25, coreHi: 0.75, coreSize: 2.5, coreA: 0.6, outerSize: 2, outerA: 0.24,
  star: 4.4, focusDim: 0.8, panelMinPx: 640, panelFrac: 0.24, panelMin: 200, panelMax: 280, panelGap: 28,
  marginLeft: 0.1, marginTop: 0.16, marginBottom: 0.12,
} as const;
// 분위수 점 그림(Kay 외 2016): 점 n개 = 확률 1/n씩. 칸 높이는 구간 폭의 1/rows(최소 점 한 줄)로 묶어 가로로 쌓는다
export const QDOT = { n: 20, r: 5, gap: 2.4, rows: 6 } as const;
// 분위 (k + 0.5)/n 중 q10~q90 안에 드는 점 수(n = 20이면 16) — 문구에 숫자를 쓰지 않으려고 코드가 센다
const QDOT_Q = Array.from({ length: QDOT.n }, (_, k) => (k + 0.5) / QDOT.n);
const QDOT_INSIDE = QDOT_Q.filter((q) => q > 0.1 && q < 0.9).length;

const valid = (cd: CloudData) => cd.dates.map((_, i) => i).filter((i) => cd.price[i] !== null && cd.lo[i] !== null && cd.hi[i] !== null);

export function cloudScale(cd: CloudData, size: PlotSize, rightPx = 0): { x(i: number): number; y(v: number): number } {
  const idx = valid(cd);
  const min = Math.min(...idx.map((i) => cd.lo[i]!)), max = Math.max(...idx.map((i) => cd.hi[i]!));
  const pad = (max - min) * 0.05 || 1;
  const dlo = min - pad, dhi = max + pad;
  const left = size.w * CLOUD.marginLeft, top = size.h * CLOUD.marginTop;
  const innerW = size.w - left - rightPx, innerH = size.h * (1 - CLOUD.marginTop - CLOUD.marginBottom);
  const n = cd.dates.length;
  return {
    x: (i) => left + innerW * (n === 1 ? 0.5 : (i + 0.5) / n),
    y: (v) => top + innerH * (1 - (v - dlo) / (dhi - dlo)),
  };
}

export function cloudLayout(
  cd: CloudData, size: PlotSize,
  // tip: 짚은 출발일 문장. date = ISO 날짜, price·lo·hi = 예측가·구간 아래·위(원)
  s: { money(v: number): string; dday(n: number): string; holiday(code: string): string; axis: string; tip(v: { date: string; price: number; lo: number; hi: number }): string;
    panelHead(v: { date: string; dday: number }): string; panelNote(v: { step: number; total: number; inside: number }): string; moneyFull(v: number): string },
): ChartLayout {
  const idx = valid(cd);
  const wide = size.w >= CLOUD.panelMinPx;
  const side = wide ? Math.max(CLOUD.panelMin, Math.min(CLOUD.panelMax, size.w * CLOUD.panelFrac)) : 0;
  const sc = cloudScale(cd, size, side ? side + CLOUD.panelGap : 0);
  const colW = ((size.w - side - (side ? CLOUD.panelGap : 0)) * (1 - CLOUD.marginLeft)) / cd.dates.length;
  // 항목 문장 끝에 칸 설명을 붙인다(낭독용 — 칸은 aria-hidden이라 같은 내용을 문장으로도 준다)
  const note = s.panelNote({ step: 100 / QDOT.n, total: QDOT.n, inside: QDOT_INSIDE });
  const p = new Pts();
  const items: ChartItem[] = [];
  // 강조·항목 번호 j는 예측 있는 날만 센 순서다(날짜 번호 i가 아니다) — 예측 없는 날이 끼어도 items[j]로 바로 찾게
  for (const [j, i] of idx.entries()) {
    const price = cd.price[i]!, lo = cd.lo[i]!, hi = cd.hi[i]!;
    const hol = cd.holidays[cd.dates[i]] !== undefined;
    const rand = mulberry32(i + 1);
    for (let k = 0; k < CLOUD.perDate; k++) {
      const q = 0.1 + (0.8 * (k + 0.5)) / CLOUD.perDate, z = invNorm(q);
      const v = z < 0 ? price + (z / CLOUD.z90) * (price - lo) : price + (z / CLOUD.z90) * (hi - price);
      const core = q > CLOUD.coreLo && q < CLOUD.coreHi;
      p.add((sc.x(i) + (rand() - 0.5) * colW * 0.62) / size.w, sc.y(v) / size.h, core ? CLOUD.coreSize : CLOUD.outerSize,
        core ? CLOUD.coreA : CLOUD.outerA, hol ? TONE.amber : TONE.dot, -1, j);
    }
    addStar(p, sc.x(i) / size.w, sc.y(price) / size.h, CLOUD.star, hol ? TONE.amber : TONE.text, 1, -1, j);
    items.push({ key: j, x: sc.x(i) / size.w, y: sc.y(price) / size.h, text: `${s.tip({ date: cd.dates[i], price, lo, hi })} · ${note}` });
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
  const lines = [{ pts: idx.flatMap((i) => [sc.x(i) / size.w, sc.y(cd.price[i]!) / size.h]), tone: TONE.text, alpha: LINE.alpha * 0.9, width: LINE.width }];
  // 처음 짚은 날: 공휴일 무렵 출발일 중 구간(q90 − q10)이 가장 넓은 날 — 분위수 점 그림이 가장 잘 펼쳐지는 날. 없으면 전체에서
  const width = (i: number) => cd.hi[i]! - cd.lo[i]!;
  const holIdx = idx.filter((i) => cd.holidays[cd.dates[i]] !== undefined);
  const pool = holIdx.length ? holIdx : idx;
  const first = pool.reduce((a, i) => (width(i) > width(a) ? i : a), pool[0]);
  const initial = idx.indexOf(first);
  return { ...p.done(labels, TONE.text, CLOUD.focusDim), items, initial, lines, overlay: (sel) => cloudPanel(cd, size, sc, idx, side, s, sel) };
}

// ⑤ 덧그림: 짚은 날의 별 강조(모든 판) + 넓은 판이면 오른쪽 분위수 점 그림 칸. 세로는 왼쪽 차트와 같은 sc.y
function cloudPanel(cd: CloudData, size: PlotSize, sc: ReturnType<typeof cloudScale>, idx: number[], side: number,
  s: { panelHead(v: { date: string; dday: number }): string; panelNote(v: { step: number; total: number; inside: number }): string; moneyFull(v: number): string },
  sel: number): OverlayShape[] {
  if (sel < 0 || sel >= idx.length) return [];
  const i = idx[sel], price = cd.price[i]!, lo = cd.lo[i]!, hi = cd.hi[i]!;
  const hol = cd.holidays[cd.dates[i]] !== undefined;
  const W = size.w, H = size.h, X = sc.x(i), Y = (v: number) => sc.y(v);
  const out: OverlayShape[] = [
    { type: 'dot', x: X / W, y: Y(price) / H, r: 9, tone: hol ? TONE.amber : TONE.text, alpha: 0.22 },
    { type: 'dot', x: X / W, y: Y(price) / H, r: 3.4, tone: hol ? TONE.amber : TONE.text, alpha: 1 },
  ];
  if (!side) return out;
  const x0 = W - side, x1 = W - 16;
  const qv = (q: number) => { const z = invNorm(q) / CLOUD.z90; return z < 0 ? price + z * (price - lo) : price + z * (hi - price); };
  // q10·q90 자리: 기둥에서 칸 끝까지 성긴 점선
  for (const v of [lo, hi]) out.push({ type: 'dash', x0: (X + 8) / W, x1: x1 / W, y: Y(v) / H, tone: TONE.dot, alpha: 0.45 });
  // 점 쌓기: 세로를 칸(구간 폭의 1/rows, 최소 점 한 줄)으로 나눠 같은 칸의 점을 가로로.
  // y0를 칸 세 개만큼 위로 잡는 것은 바깥 점(q0.025·q0.975)이 q90 위·q10 아래로 나가도 칸 번호가 음수가 되지 않게 하려는 여유
  const cell = QDOT.r * 2 + QDOT.gap, cellH = Math.max(cell, (Y(lo) - Y(hi)) / QDOT.rows), y0 = Y(hi) - cellH * 3;
  const bins = new Map<number, number[]>();
  QDOT_Q.forEach((q, k) => { const b = Math.floor((Y(qv(q)) - y0) / cellH); bins.set(b, [...(bins.get(b) ?? []), k]); });
  for (const [b, ks] of bins) ks.forEach((k, jx) => {
    const outside = QDOT_Q[k] < 0.1 || QDOT_Q[k] > 0.9;
    out.push({ type: 'dot', x: (x0 + 8 + QDOT.r + jx * cell) / W, y: Math.min(H - QDOT.r, Math.max(QDOT.r, y0 + (b + 0.5) * cellH)) / H,
      r: QDOT.r, tone: outside ? TONE.text : TONE.dot, alpha: outside ? 0.75 : 0.95, hollow: outside });
  });
  const dday = Math.round((utc(cd.dates[i]) - utc(cd.asOf)) / DAY);
  out.push({ type: 'text', x: x0 / W, y: 12 / H, text: s.panelHead({ date: cd.dates[i], dday }), align: 'start', cls: 'panelHead' });
  out.push({ type: 'text', x: x0 / W, y: 32 / H, text: s.panelNote({ step: 100 / QDOT.n, total: QDOT.n, inside: QDOT_INSIDE }), align: 'start', cls: 'panelNote' });
  out.push({ type: 'text', x: x1 / W, y: Y(price) / H, text: s.moneyFull(price), align: 'end', cls: 'panelValue' });
  out.push({ type: 'text', x: x1 / W, y: (Y(hi) - 10) / H, text: `q90 ${s.moneyFull(hi)}`, align: 'end', cls: 'panelQ' });
  out.push({ type: 'text', x: x1 / W, y: (Y(lo) + 10) / H, text: `q10 ${s.moneyFull(lo)}`, align: 'end', cls: 'panelQ' });
  return out;
}

// 눈금 간격: 1·2·5 × 10^k 중에서 대략 n칸이 되는 값
function niceStep(span: number, n: number): number {
  const raw = span / n;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const f = raw / mag;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * mag;
}

// 작고 빠른 시드 난수(점 좌우 흔들림이 매번 같게)
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
