// 배치 함수 검사: 점 개수, 판 안(0..1), 강조 색, 크기 순서, 이름표. 좁은 휴대폰 판에서도 깨지지 않는지.
import { describe, expect, it } from 'vitest';
import type { ChartsData, CloudData } from '@/charts/data';
import { CLOUD, cloudLayout, cloudScale, DEPART, QDOT, departLayout, invNorm, SWARM, swarmLayout, WAFFLE, waffleLayout, type FeatureGroupInput } from '@/charts/layouts';
import { STAR } from '@/charts/lines';
import { CHART_FOCUS_DIM, FOCUS_DIM, TONE, type ChartLabel, type ChartLayout } from '@/charts/types';

const inside = (L: ChartLayout) => {
  for (let i = 0; i < L.n; i++) {
    expect(L.x[i]).toBeGreaterThanOrEqual(0); expect(L.x[i]).toBeLessThanOrEqual(1);
    expect(L.y[i]).toBeGreaterThanOrEqual(0); expect(L.y[i]).toBeLessThanOrEqual(1);
    expect(L.size[i]).toBeGreaterThanOrEqual(1.6);
  }
};

const groups: FeatureGroupInput[] = [
  { id: 'lookup', gain: 46.8, features: Array(13).fill('f'), name: 'L' },
  { id: 'categorical', gain: 26.0, features: Array(5).fill('f'), name: 'C' },
  { id: 'holiday', gain: 11.4, features: Array(4).fill('f'), name: 'H' },
  { id: 'days', gain: 6.8, features: Array(4).fill('f'), name: 'D' },
  { id: 'flight', gain: 4.6, features: Array(5).fill('f'), name: 'F' },
  { id: 'market', gain: 1.2, features: Array(2).fill('f'), name: 'M' },
];
const fmt = { pct: (v: number) => `${v.toFixed(1)}%`, count: (n: number) => `${n}개` };

describe('waffleLayout', () => {
  const L = waffleLayout(groups, { w: 1080, h: 414 }, fmt);
  it('그룹마다 점 100개, 켜진 점(알파 0.95) 수 = 반올림한 gain', () => {
    expect(L.n).toBe(600);
    for (let g = 0; g < 6; g++) {
      let lit = 0;
      for (let k = 0; k < 100; k++) if (L.alpha[g * 100 + k] > 0.5) lit++;
      expect(lit).toBe(Math.round(groups[g].gain));
    }
  });
  it('호박색은 공휴일 그룹의 켜진 점에만', () => {
    for (let i = 0; i < L.n; i++) {
      const holidayLit = Math.floor(i / 100) === 2 && L.alpha[i] > 0.5;
      expect(L.tone[i] === TONE.amber).toBe(holidayLit);
    }
  });
  it('넓은 판은 한 줄(그룹 이름표 y가 모두 같다), 좁은 판은 두 줄', () => {
    const ys = (L2: ChartLayout) => new Set(L2.labels.filter((l) => l.type === 'group').map((l) => l.y));
    expect(ys(L).size).toBe(1);
    const narrow = waffleLayout(groups, { w: 340, h: 380 }, fmt);
    expect(ys(narrow).size).toBe(2);
    inside(narrow);
  });
  it('이름표는 그룹 여섯 개 + 설명 줄 하나, 값·이름·개수·피처 목록', () => {
    expect(L.labels).toHaveLength(7);
    const h = L.labels[2];
    expect(h).toMatchObject({ type: 'group', id: 'holiday', pct: '11.4%', name: 'H', count: '4개', holiday: true });
    inside(L);
  });
  it('점마다 강조 번호(0~5, 와플 그룹), 그룹 순서대로 100개씩', () => {
    for (let i = 0; i < L.n; i++) expect(L.hl[i]).toBe(Math.floor(i / 100));
  });
  it('강조 색은 호박색, 흐림은 0.25', () => {
    expect(L.focusTone).toBe(TONE.amber);
    expect(L.focusDim).toBe(FOCUS_DIM);
  });
  it('설명 줄은 마지막 이름표이고, 모든 와플·그룹 이름표보다 아래(좁은 판에서도)', () => {
    for (const L2 of [L, waffleLayout(groups, { w: 340, h: 380 }, fmt)]) {
      const d = L2.labels[L2.labels.length - 1];
      expect(d.type).toBe('detail');
      const maxDot = Math.max(...Array.from(L2.y));
      const maxGroup = Math.max(...L2.labels.filter((l) => l.type === 'group').map((l) => l.y));
      expect(d.y).toBeGreaterThan(maxDot);
      expect(d.y).toBeGreaterThan(maxGroup);
      expect(d.y).toBeLessThan(1);
    }
  });
  // 2026-09-28 e2e로 두 번 확인: 옛 58% 비율(→ 고정 64px 한 값)은 두 줄(휴대폰) 배치에서 이름표 칸이
  // 실제 글자 높이보다 좁아 옆 줄 와플·설명 줄과 겹쳤다. labelPx를 넓은/좁은 판 실측 높이로 나눈 뒤
  // "이름표 끝(gap을 뺀 y*h + labelPx, 즉 그 줄에 예약된 칸의 맨 아래)"이 다음 줄 와플·설명 줄보다
  // 위인지를 모든 판 크기에서 지킨다. 짧고 넓은 판(820×180)은 와플이 폭 대신 높이에 걸리는 경우다
  it('이름표 칸은 다음 줄 와플·설명 줄과 겹치지 않고, 설명 줄은 판 안에 들어간다(넓은·좁은·짧고 넓은 판)', () => {
    for (const size of [{ w: 1080, h: 414 }, { w: 340, h: 380 }, { w: 820, h: 180 }] as const) {
      const wide = size.w >= WAFFLE.wideMinPx;
      const cols = wide ? groups.length : Math.ceil(groups.length / 2);
      const rows = Math.ceil(groups.length / cols);
      const labelPx = wide ? WAFFLE.labelPx.wide : WAFFLE.labelPx.narrow;
      const detailPx = wide ? WAFFLE.detailPx.wide : WAFFLE.detailPx.narrow;
      const rowH = Math.max(0, size.h - detailPx) / rows;
      const L2 = waffleLayout(groups, size, fmt);
      const groupLabels = L2.labels.filter((l): l is Extract<ChartLabel, { type: 'group' }> => l.type === 'group');
      const detail = L2.labels[L2.labels.length - 1];
      expect(detail.type, `${size.w}×${size.h}`).toBe('detail');
      const detailEnd = detail.y * size.h;
      groupLabels.forEach((l, gi) => {
        const row = Math.floor(gi / cols);
        // gap을 뺀 자리 = 그 줄에 예약된 칸(labelPx)의 실제 끝 — 시작점(y*h)에 낀 gap과 무관하게 항상 성립
        const end = l.y * size.h - WAFFLE.labelGap + labelPx;
        const tag = `${size.w}×${size.h} 그룹 ${l.id}`;
        if (row < rows - 1) expect(end, `${tag} vs 다음 줄`).toBeLessThanOrEqual((row + 1) * rowH + 1);
        expect(end, `${tag} vs 설명 줄`).toBeLessThanOrEqual(detailEnd + 1);
      });
      expect(detailEnd + (detailPx - 8), `${size.w}×${size.h} 설명 줄이 판 안`).toBeLessThanOrEqual(size.h + 1);
    }
  });
});

// 2026-10-05(월)부터 14일, 둘 다 공휴일이지만 하나는 봉우리(peak)가 된다. 값이 날마다 다르다
const dates = Array.from({ length: 14 }, (_, i) => new Date(Date.UTC(2026, 9, 5 + i)).toISOString().slice(0, 10));
const charts: ChartsData = {
  asOf: '2026-09-22',
  dates,
  depart: { pct: dates.map((_, i) => (i === 2 ? 40 : (i - 7) * 50)), holiday: dates.map((_, i) => (i === 2 ? 'chuseok' : i === 9 ? 'kr_hangul_day' : null)) },
  labels: [{ date: dates[2], code: 'chuseok' }, { date: dates[9], code: 'kr_hangul_day' }],
  curve: { bins: [[1, 3], [4, 7], [8, 14], [15, 21], [22, 30], [31, 45], [46, 60], [61, 90]], mean: Array(8).fill(0), n: Array(8).fill(1), sample: { bin: [], pct: [] } },
};
const depS = {
  month: (iso: string) => `m${iso.slice(5, 7)}`, weekday: (i: number) => `w${i}`, holiday: (c: string) => `h:${c}`, pct: (v: number) => `${v}%`, axis: 'AX', weekdayTitle: 'WT',
  // 가짜 문장 함수: 문장 조각이 항목 text에 들어가는지만 본다
  tip: (v: { date: string; pct: number; holiday?: string }) => `T ${v.date} ${v.pct}${v.holiday ? ` ${v.holiday}` : ''}`,
};

describe('departLayout', () => {
  const L = departLayout(charts, { w: 1080, h: 414 }, depS);
  const dateIdx = Array.from(L.group).filter((g) => g >= 0);
  const PER = DEPART.perDate;
  const centerOf = (d: number) => {
    let x = 0, y = 0, n = 0;
    for (let i = 0; i < L.n; i++) if (L.group[i] === d) { x += L.x[i]; y += L.y[i]; n++; }
    return [x / n, y / n, n] as const;
  };
  it('출발일마다 perDate개 점, group = 출발일 번호', () => {
    for (let d = 0; d < dates.length; d++) expect(centerOf(d)[2]).toBe(PER);
    expect(dateIdx.length).toBe(dates.length * PER);
  });
  it('가로는 날짜 순서, 세로는 비쌀수록 위', () => {
    expect(centerOf(1)[0]).toBeGreaterThan(centerOf(0)[0]);
    expect(centerOf(13)[1]).toBeLessThan(centerOf(0)[1]); // 픽스처 pct는 번호가 클수록 크다
  });
  it('호박색 = 공휴일이면서 +25% 이상', () => {
    for (let i = 0; i < L.n; i++) if (L.group[i] >= 0) {
      const d = L.group[i];
      expect(L.tone[i] === TONE.amber).toBe(charts.depart.holiday[d] !== null && charts.depart.pct[d] / 10 >= DEPART.hotPct);
    }
  });
  it('공휴일 이름표는 그 출발일 뭉치 바로 위', () => {
    const h = L.labels.filter((l): l is Extract<ChartLabel, { type: 'text' }> => l.type === 'text' && l.cls === 'holiday');
    expect(h.map((l) => l.text)).toEqual(['h:chuseok']);
    const [cx, cy] = centerOf(2);
    expect(Math.abs(h[0].x - cx)).toBeLessThan(0.01);
    expect(h[0].y).toBeLessThan(cy);
    expect((cy - h[0].y) * 414).toBeLessThan(30);
  });
  it('요일 평균 값 = 그 요일 출발일들의 평균 %, +15% 넘는 요일만 호박색 점', () => {
    const sum = Array(7).fill(0), cnt = Array(7).fill(0);
    charts.dates.forEach((iso, i) => { const k = (new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7; sum[k] += charts.depart.pct[i] / 10; cnt[k]++; });
    const avg = sum.map((v, k) => v / cnt[k]);
    const texts = L.labels.filter((l): l is Extract<ChartLabel, { type: 'text' }> => l.type === 'text').map((l) => l.text);
    for (const a of avg) expect(texts).toContain(depS.pct(Math.round(a)));
    // 요일 평균 점(출발일 뭉치가 아닌 group −1, 알파 0.85)의 호박색 여부
    const weekdayAmber = Array.from({ length: L.n }, (_, i) => i).some((i) => L.group[i] === -1 && L.alpha[i] > 0.8 && L.tone[i] === TONE.amber);
    expect(weekdayAmber).toBe(avg.some((a) => a > DEPART.hotWeekday));
  });
  it('요일 평균: 이름 7개와 값 7개, 제목·세로축 이름', () => {
    const t = L.labels.filter((l): l is Extract<ChartLabel, { type: 'text' }> => l.type === 'text');
    for (let k = 0; k < 7; k++) expect(t.some((l) => l.text === `w${k}`)).toBe(true);
    expect(t.some((l) => l.text === 'WT')).toBe(true);
    expect(t.some((l) => l.text === 'AX')).toBe(true);
    expect(t.filter((l) => l.cls === 'month').length).toBeGreaterThan(0);
  });
  it('강조 번호: 출발일 뭉치 점은 출발일 번호, 기준선·요일 평균 점은 −1. 강조 색·흐림은 차트 공통값', () => {
    for (let i = 0; i < L.n; i++) expect(L.hl[i], `점 ${i}`).toBe(L.group[i] >= 0 ? L.group[i] : -1);
    expect(L.focusTone).toBe(TONE.text);
    expect(L.focusDim).toBe(CHART_FOCUS_DIM);
  });
  it('짚을 항목: 출발일마다 하나, key = 번호, x 오름차순, 자리는 그 뭉치 가운데, 처음 강조 없음', () => {
    const items = L.items!;
    expect(items).toHaveLength(dates.length);
    items.forEach((it, i) => {
      expect(it.key).toBe(i);
      if (i > 0) expect(it.x).toBeGreaterThan(items[i - 1].x);
      const [cx, cy] = centerOf(i);
      expect(Math.abs(it.x - cx) * 1080).toBeLessThan(1);
      expect(Math.abs(it.y - cy) * 414).toBeLessThan(1);
    });
    expect(L.initial).toBe(-1);
  });
  it('항목 문장: 출발일·평균 대비 %, 공휴일 출발일이면 공휴일 이름', () => {
    const items = L.items!;
    expect(items[0].text).toBe(`T ${dates[0]} ${charts.depart.pct[0] / 10}`);
    expect(items[9].text).toContain('h:kr_hangul_day');
    expect(items[8].text).not.toContain('h:');
  });
  it('판 안, 지름 1.6px 이상(넓은 판·좁은 판)', () => { inside(L); inside(departLayout(charts, { w: 340, h: 380 }, depS)); });
  it('별자리 선 하나: 출발일 뭉치 가운데를 날짜 순으로, 알파 DEPART.lineA', () => {
    expect(L.lines).toHaveLength(1);
    const ln = L.lines![0];
    expect(ln.alpha).toBe(DEPART.lineA);
    expect(ln.pts).toHaveLength(charts.dates.length * 2);
    for (let d = 0; d < charts.dates.length; d++) {
      const [cx, cy] = centerOf(d);
      expect(ln.pts[d * 2]).toBeCloseTo(cx, 3);
      expect(ln.pts[d * 2 + 1]).toBeCloseTo(cy, 3);
    }
  });
  it('결론 이름표: 공휴일 무렵 출발일 중 가장 높은 봉우리 하나(호박, 위), 그 날의 공휴일 이름표는 빠진다', () => {
    const c = L.labels.filter((l) => l.type === 'callout');
    expect(c).toHaveLength(1);
    const peak = charts.depart.pct.reduce((b, v, i) => (charts.depart.holiday[i] !== null && v > charts.depart.pct[b] ? i : b),
      charts.depart.pct.findIndex((_, i) => charts.depart.holiday[i] !== null));
    expect(c[0]).toMatchObject({ tone: 'amber', place: 'above', value: depS.pct(Math.round(charts.depart.pct[peak] / 10)), note: depS.holiday(charts.depart.holiday[peak]!) });
    const peakLabel = charts.labels.find((l) => l.date === charts.dates[peak]);
    if (peakLabel) expect(L.labels.filter((l) => l.type === 'text' && l.cls === 'holiday' && l.text === depS.holiday(peakLabel.code) && Math.abs(l.x - c[0].x) < 1e-6)).toHaveLength(0);
  });
});

describe('swarmLayout', () => {
  // 구간 평균(%×10)은 실측 U자와 같은 모양, 표본은 구간마다 40개
  const mean = [111, 44, 9, -24, -37, -50, -43, 21];
  const bin: number[] = [], pct: number[] = [];
  mean.forEach((m, b) => { for (let k = 0; k < 40; k++) { bin.push(b); pct.push(m + (k - 20) * 5); } });
  pct.push(300); bin.push(0); // ±22% 밖 → 그리지 않는다
  const curve: ChartsData['curve'] = { ...charts.curve, mean, sample: { bin, pct } };
  const W = 1080, H = 414;
  const tip = (v: { bin: string; pct: number; n: number }) => `T ${v.bin} ${v.pct} ${v.n}`;
  const S = {
    bin: (lo: number, hi: number) => `D-${lo}~${hi}`, pct: (v: number) => `${v}%`, axis: 'A', tip,
    zero: 'Z', callMin: (lo: number, hi: number) => `min ${lo}~${hi}`, callLast: 'last', pct1: (v: number) => `${v.toFixed(1)}%`,
  };
  const L = swarmLayout(curve, { w: W, h: H }, S);
  const isSample = (i: number) => L.size[i] === Math.fround(SWARM.dot); // size는 Float32Array라 fround로 맞춘다
  const stars = () => Array.from({ length: L.n }, (_, i) => i).filter((i) => L.size[i] === Math.fround(SWARM.star) || L.size[i] === Math.fround(SWARM.starKey));
  // 0% 점선이 먼저 들어가므로 표본 점은 앞에서부터가 아니라 크기로 골라 구간 순서대로 본다
  const sampleIdx = Array.from({ length: L.n }, (_, i) => i).filter(isSample);

  it('범위 밖 표본은 빼고 320개, 구간 평균 별 8개, 별자리 선 하나(꼭짓점 8개, 왼쪽→오른쪽)', () => {
    expect(sampleIdx).toHaveLength(320);
    expect(stars()).toHaveLength(8);
    expect(L.lines).toHaveLength(1);
    const pts = L.lines![0].pts;
    expect(pts).toHaveLength(16);
    for (let k = 2; k < pts.length; k += 2) expect(pts[k]).toBeGreaterThan(pts[k - 2]);
  });
  it('표본은 모두 파랑(꾸밈 호박색 없음), 가장 싼 구간의 별만 호박색', () => {
    for (const i of sampleIdx) expect(L.tone[i]).toBe(TONE.dot);
    const amberStars = stars().filter((i) => L.tone[i] === TONE.amber);
    expect(amberStars).toHaveLength(1);
    expect(L.size[amberStars[0]]).toBe(Math.fround(SWARM.starKey));
    // 가장 싼 구간 = 평균이 가장 낮음 = 화면에서 가장 아래(y 최대)
    const ys = stars().map((i) => L.y[i]);
    expect(L.y[amberStars[0]]).toBe(Math.max(...ys));
  });
  it('결론 이름표 둘: 최저(호박, 아래)와 출발 직전(글자색, 위), 값은 소수 한 자리', () => {
    const c = L.labels.filter((l) => l.type === 'callout');
    expect(c).toEqual([
      expect.objectContaining({ value: '-5.0%', note: 'min 31~45', tone: 'amber', place: 'below' }),
      expect.objectContaining({ value: '11.1%', note: 'last', tone: 'text', place: 'above' }),
    ]);
  });
  it('0% 기준 점선과 "같은 편 평균" 이름표', () => {
    expect(L.labels).toContainEqual(expect.objectContaining({ type: 'text', text: 'Z', cls: 'axis', align: 'end' }));
  });
  it('왼쪽이 먼 출발일, 평균이 가장 낮은 구간의 마디가 가장 아래', () => {
    const ns = stars().sort((a, b) => L.x[a] - L.x[b]);
    const ys = ns.map((i) => L.y[i]);
    // 왼쪽부터 D-61~90(평균 +2.1%) … D-1~3(+11.1%): 가장 아래(y 최대)는 D-31~45(-5.0%) = 왼쪽에서 세 번째
    expect(ys.indexOf(Math.max(...ys))).toBe(2);
  });
  it('같은 구간의 표본 점끼리 겹치지 않는다', () => {
    for (let b = 0; b < 8; b++) {
      const idx = Array.from({ length: 40 }, (_, k) => sampleIdx[b * 40 + k]);
      for (let a = 0; a < idx.length; a++) for (let c = a + 1; c < idx.length; c++) {
        const dx = (L.x[idx[a]] - L.x[idx[c]]) * W, dy = (L.y[idx[a]] - L.y[idx[c]]) * H;
        expect(Math.hypot(dx, dy)).toBeGreaterThanOrEqual(SWARM.dot + SWARM.gap - 0.01);
      }
    }
  });
  it('이름표: 구간 8개 + y 눈금 5개(tick), 축 이름 + 0% 기준 이름 2개', () => {
    expect(L.labels.filter((l) => l.type === 'text' && l.cls === 'tick')).toHaveLength(13);
    expect(L.labels.filter((l) => l.type === 'text' && l.cls === 'axis')).toHaveLength(2);
  });
  // 항목 번호(= 강조 번호)는 화면 왼쪽부터 0 — 구간 번호 b는 오른쪽(D-1~3)이 0이라 뒤집힌다(k = 7 − b).
  // 키보드 → / aria-valuenow 증가가 화면 오른쪽 이동과 같아지게 하려는 것이다
  const keyOfBin = (b: number) => 7 - b;
  it('강조 번호: 구간 표본 점은 그 구간의 항목 번호, 별·0% 점선은 −1', () => {
    sampleIdx.forEach((i, k) => expect(L.hl[i], `표본 ${i}`).toBe(keyOfBin(Math.floor(k / 40))));
    for (let i = 0; i < L.n; i++) if (!isSample(i)) expect(L.hl[i], `선 ${i}`).toBe(-1);
    expect(L.focusTone).toBe(TONE.text);
    expect(L.focusDim).toBe(CHART_FOCUS_DIM);
  });
  it('짚을 항목: 구간 8개, key = 번호, x 오름차순(마디 자리), 문장에 구간 이름·평균 %·관측 수', () => {
    const items = L.items!;
    expect(items).toHaveLength(8);
    const ns = stars().sort((a, b) => L.x[a] - L.x[b]);
    items.forEach((it, k) => {
      expect(it.key).toBe(k);
      expect(it.x).toBeCloseTo(L.x[ns[k]], 6);
      expect(it.y).toBeCloseTo(L.y[ns[k]], 6);
      const b = 7 - k, [lo, hi] = curve.bins[b];
      expect(it.text).toBe(`T D-${lo}~${hi} ${mean[b] / 10} ${curve.n[b]}`);
    });
  });
  it('처음 강조 = 평균이 가장 낮은 구간(D-31~45, 구간 번호 5)의 항목 번호', () => {
    expect(L.initial).toBe(keyOfBin(5));
  });
  const binTexts = (lay: ReturnType<typeof swarmLayout>) =>
    lay.labels.filter((l) => l.type === 'text' && l.cls === 'tick' && !l.text.endsWith('%')).map((l) => (l.type === 'text' ? l.text : ''));
  it('좁은 판(340px)에서는 구간 이름표에 "D-"를 빼 서로 겹치지 않게, 넓은 판에서는 그대로', () => {
    const narrow = binTexts(swarmLayout(curve, { w: 340, h: 380 }, S));
    expect(narrow).toHaveLength(8);
    for (const t of narrow) expect(t).not.toContain('D-');
    for (const t of binTexts(L)) expect(t).toContain('D-');
  });
  it('구간 폭을 넘치는 점은 가장자리에 쌓지 않고 뺀다 — 같은 px 자리에 두 점이 없다', () => {
    // 모든 표본이 한 구간·같은 값 → 한 줄에 몰린다. 좁은 판에서는 폭을 넘치는 점이 생긴다
    const dense: ChartsData['curve'] = { ...charts.curve, mean, sample: { bin: new Array(200).fill(5), pct: new Array(200).fill(-50) } };
    const D = swarmLayout(dense, { w: 340, h: 380 }, S);
    const seen = new Set<string>();
    let count = 0;
    for (let i = 0; i < D.n; i++) {
      if (D.size[i] !== Math.fround(SWARM.dot)) continue;
      count++;
      const key = `${Math.round(D.x[i] * 340 * 100)},${Math.round(D.y[i] * 380 * 100)}`;
      expect(seen.has(key), `점 ${i}`).toBe(false);
      seen.add(key);
    }
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThan(200);
  });
});

describe('invNorm', () => {
  it('표준정규 분위수', () => {
    expect(invNorm(0.5)).toBeCloseTo(0, 6);
    expect(invNorm(0.9)).toBeCloseTo(1.28155, 3);
    expect(invNorm(0.1)).toBeCloseTo(-1.28155, 3);
    expect(invNorm(0.01)).toBeCloseTo(-2.32635, 3);
  });
});

describe('cloudLayout', () => {
  const cd: CloudData = {
    asOf: '2026-09-22',
    dates: ['2026-09-25', '2026-09-26', '2026-09-27'],
    price: [200_000, null, 300_000],
    lo: [150_000, null, 250_000],
    hi: [260_000, null, 380_000],
    holidays: { '2026-09-27': 'kr_midautumn_festival' },
  };
  const size = { w: 1080, h: 414 };
  const s = {
    money: (v: number) => `${v}`, dday: (n: number) => `D+${n}`, holiday: (c: string) => `h:${c}`, axis: 'A',
    tip: (v: { date: string; price: number; lo: number; hi: number }) => `T ${v.date} ${v.price} ${v.lo}~${v.hi}`,
    panelHead: (v: { date: string; dday: number }) => `H ${v.date} ${v.dday}`,
    panelNote: (v: { step: number; total: number; inside: number }) => `N ${v.step} ${v.inside}/${v.total}`,
    moneyFull: (v: number) => `${v}`,
  };
  const L = cloudLayout(cd, size, s);
  const side = Math.max(CLOUD.panelMin, Math.min(CLOUD.panelMax, size.w * CLOUD.panelFrac));
  const sc = cloudScale(cd, size, side + CLOUD.panelGap);
  const PER = CLOUD.perDate + 2; // 날짜 하나의 점 수: 구름 + 별(번짐·심)
  it('예측 없는 날은 건너뛰고, 출발일마다 구름 perDate개 + 예측가 별(번짐 + 심) 2개', () => expect(L.n).toBe(2 * (CLOUD.perDate + 2)));
  it('가운데 50% 층은 바깥 층보다 크고 진하다', () => {
    const cloud = Array.from({ length: L.n }, (_, i) => i).filter((i) => L.size[i] === CLOUD.coreSize || L.size[i] === CLOUD.outerSize);
    expect(cloud).toHaveLength(2 * CLOUD.perDate);
    const core = cloud.filter((i) => L.size[i] === CLOUD.coreSize), outer = cloud.filter((i) => L.size[i] === CLOUD.outerSize);
    expect(core.length).toBeGreaterThan(0); expect(outer.length).toBeGreaterThan(0);
    for (const i of core) expect(L.alpha[i]).toBe(Math.fround(CLOUD.coreA));
    for (const i of outer) expect(L.alpha[i]).toBe(Math.fround(CLOUD.outerA));
  });
  it('별자리 선 하나: 예측 있는 날의 예측가 자리를 날짜 순으로(예측 없는 날은 건너뛴다)', () => {
    expect(L.lines).toHaveLength(1);
    const pts = L.lines![0].pts;
    expect(pts).toHaveLength(4);
    expect([pts[0], pts[1]]).toEqual([sc.x(0) / size.w, sc.y(200_000) / size.h]);
    expect([pts[2], pts[3]]).toEqual([sc.x(2) / size.w, sc.y(300_000) / size.h]);
  });
  it('처음 짚은 날 = 공휴일 무렵 출발일 중 구간이 가장 넓은 날(항목 번호), 없으면 전체에서', () => {
    expect(L.initial).toBe(1); // 2026-09-27(공휴일, 폭 130,000) — 예측 있는 날만 센 번호 1
    const noHol = cloudLayout({ ...cd, holidays: {} }, size, s);
    expect(noHol.initial).toBe(1); // 폭 110,000 < 130,000
  });
  it('넓은 판: 덧그림 칸에 점 20개(속 빈 점 4개), 칸 머리·설명, 같은 세로축', () => {
    const shapes = L.overlay!(1);
    const dots = shapes.filter((x) => x.type === 'dot' && x.r === QDOT.r);
    expect(dots).toHaveLength(QDOT.n);
    expect(dots.filter((x) => x.type === 'dot' && x.hollow)).toHaveLength(4);
    expect(shapes).toContainEqual(expect.objectContaining({ type: 'text', cls: 'panelHead', text: 'H 2026-09-27 5' }));
    expect(shapes).toContainEqual(expect.objectContaining({ type: 'text', cls: 'panelNote', text: 'N 5 16/20' }));
    for (const d of dots) { expect(d.y).toBeGreaterThan(0); expect(d.y).toBeLessThan(1); expect((d as { x: number }).x).toBeGreaterThan(sc.x(2) / size.w); }
  });
  it('좁은 판(640px 미만): 칸 없음 — 덧그림은 짚은 날 별 강조만', () => {
    const N = cloudLayout(cd, { w: 600, h: 380 }, s);
    const shapes = N.overlay!(0);
    expect(shapes.filter((x) => x.type === 'dot' && x.r === QDOT.r)).toHaveLength(0);
    expect(shapes.filter((x) => x.type === 'text')).toHaveLength(0);
  });
  it('짚은 날이 없으면(−1) 덧그림 없음', () => expect(L.overlay!(-1)).toEqual([]));
  // 항목 번호는 예측 있는 날만 센 순서(예측 없는 날이 끼면 날짜 번호와 달라진다) — 조작 층이 items[번호]로 바로 찾게
  it('강조 번호: 그날 구름·예측가 점 모두 그날 항목 번호', () => {
    for (let i = 0; i < L.n; i++) expect(L.hl[i], `점 ${i}`).toBe(Math.floor(i / PER));
    expect(L.focusTone).toBe(TONE.text);
    expect(L.focusDim).toBe(CLOUD.focusDim);
  });
  it('짚을 항목: 예측 있는 날마다 하나, 자리 = 예측가 점, 문장에 날짜·예측가·범위, 처음 짚은 날은 initial', () => {
    const items = L.items!;
    expect(items).toHaveLength(2);
    for (const [j, i] of [[0, 0], [1, 2]]) {
      expect(items[j].key).toBe(j);
      expect(items[j].x).toBeCloseTo(sc.x(i) / size.w, 6);
      expect(items[j].y).toBeCloseTo(sc.y(cd.price[i]!) / size.h, 6);
      expect(items[j].text).toBe(`T ${cd.dates[i]} ${cd.price[i]} ${cd.lo[i]}~${cd.hi[i]} · N 5 16/20`);
    }
    expect(items[1].x).toBeGreaterThan(items[0].x);
    expect(L.initial).toBe(1);
  });
  it('구름 점은 모두 그날 q10~q90 안, 예측가 점은 예측가 자리', () => {
    for (const [j, i] of [[0, 0], [1, 2]]) {
      for (let k = 0; k < CLOUD.perDate; k++) {
        const py = L.y[j * PER + k] * size.h;
        expect(py).toBeGreaterThanOrEqual(sc.y(cd.hi[i]!) - 1e-6);
        expect(py).toBeLessThanOrEqual(sc.y(cd.lo[i]!) + 1e-6);
      }
      for (const o of [0, 1]) expect(L.y[j * PER + CLOUD.perDate + o] * size.h).toBeCloseTo(sc.y(cd.price[i]!), 3);
      expect(L.size[j * PER + CLOUD.perDate + 1]).toBe(Math.fround(CLOUD.star));
      expect(L.size[j * PER + CLOUD.perDate]).toBe(Math.fround(CLOUD.star * STAR.haloScale));
    }
  });
  it('예측가 가까이가 가장자리보다 빽빽하다', () => {
    const band = (sc.y(cd.lo[0]!) - sc.y(cd.hi[0]!)) / 4;
    const mid = sc.y(cd.price[0]!);
    const near = Array.from({ length: CLOUD.perDate }, (_, k) => L.y[k] * size.h).filter((py) => Math.abs(py - mid) < band).length;
    expect(near).toBeGreaterThan(CLOUD.perDate / 2);
  });
  it('공휴일 출발일은 호박색(구름과 예측가 모두), 아니면 예측가만 글자색', () => {
    for (let k = 0; k < PER; k++) expect(L.tone[PER + k]).toBe(TONE.amber);
    expect(L.tone[CLOUD.perDate + 1]).toBe(TONE.text);
    expect(L.tone[0]).toBe(TONE.dot);
  });
  it('이름표: y 눈금(tick) 2개 이상, D+ 날짜, 공휴일 이름, 축 이름', () => {
    const texts = L.labels.filter((l) => l.type === 'text').map((l) => (l as { text: string }).text);
    expect(texts).toContain('D+3');
    expect(texts).toContain('D+5');
    expect(texts).toContain('h:kr_midautumn_festival');
    expect(texts).toContain('A');
  });

  // 첫 출발일(왼쪽 가장자리, 축 이름표 "A"가 있는 자리)에 공휴일이 있으면 이름표가 겹치지 않고 한 줄 아래로 내려가야 한다
  it('첫 출발일이 공휴일이면 공휴일 이름표가 축 이름표와 세로로 12px 이상 떨어진다', () => {
    const cd2: CloudData = {
      asOf: '2026-09-22',
      dates: ['2026-09-25', '2026-09-26', '2026-09-27', '2026-09-28', '2026-09-29'],
      price: [400_000, 200_000, 210_000, 220_000, 230_000],
      lo: [300_000, 150_000, 160_000, 170_000, 180_000],
      hi: [500_000, 260_000, 270_000, 280_000, 290_000],
      holidays: { '2026-09-25': 'kr_test_holiday' },
    };
    const size2 = { w: 800, h: 300 };
    const L2 = cloudLayout(cd2, size2, s);
    const axisY = L2.labels.find((l) => l.type === 'text' && l.cls === 'axis')!.y * size2.h;
    const holidayY = L2.labels.find((l) => l.type === 'text' && l.cls === 'holiday')!.y * size2.h;
    expect(Math.abs(holidayY - axisY)).toBeGreaterThanOrEqual(12);
  });
});
