// 배치 함수 검사: 점 개수, 판 안(0..1), 강조 색, 크기 순서, 이름표. 좁은 휴대폰 판에서도 깨지지 않는지.
import { describe, expect, it } from 'vitest';
import type { ChartsData, CloudData } from '@/charts/data';
import { calendarLayout, cloudLayout, cloudScale, invNorm, swarmLayout, waffleLayout, type FeatureGroupInput } from '@/charts/layouts';
import { TONE, type ChartLayout } from '@/charts/types';

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
  it('넓은 판은 한 줄(이름표 y가 모두 같다), 좁은 판은 두 줄', () => {
    expect(new Set(L.labels.map((l) => l.y)).size).toBe(1);
    const narrow = waffleLayout(groups, { w: 340, h: 380 }, fmt);
    expect(new Set(narrow.labels.map((l) => l.y)).size).toBe(2);
    inside(narrow);
  });
  it('이름표는 그룹 여섯 개, 값·이름·개수·피처 목록', () => {
    expect(L.labels).toHaveLength(6);
    const h = L.labels[2];
    expect(h).toMatchObject({ type: 'group', id: 'holiday', pct: '11.4%', name: 'H', count: '4개', holiday: true });
    inside(L);
  });
});

// 2026-10-05(월)부터 14일, 하루는 공휴일, 값이 날마다 다르다
const dates = Array.from({ length: 14 }, (_, i) => new Date(Date.UTC(2026, 9, 5 + i)).toISOString().slice(0, 10));
const charts: ChartsData = {
  asOf: '2026-09-22',
  dates,
  depart: { pct: dates.map((_, i) => (i - 7) * 50), holiday: dates.map((_, i) => (i === 9 ? 'kr_hangul_day' : null)) },
  labels: [{ date: dates[9], code: 'kr_hangul_day' }],
  curve: { bins: [[1, 3], [4, 7], [8, 14], [15, 21], [22, 30], [31, 45], [46, 60], [61, 90]], mean: Array(8).fill(0), n: Array(8).fill(1), sample: { bin: [], pct: [] } },
};
const calS = { weekday: (i: number) => `w${i}`, month: (iso: string) => `m${iso.slice(5, 7)}`, holiday: (c: string) => `h:${c}` };

describe('calendarLayout', () => {
  const L = calendarLayout(charts, { w: 1080, h: 414 }, calS);
  const PER = L.n / dates.length;
  it('출발일마다 같은 수의 점, group = 출발일 번호', () => {
    expect(Number.isInteger(PER)).toBe(true);
    for (let i = 0; i < L.n; i++) expect(L.group[i]).toBe(Math.floor(i / PER));
  });
  it('공휴일 출발일만 호박색', () => {
    for (let i = 0; i < L.n; i++) expect(L.tone[i] === TONE.amber).toBe(L.group[i] === 9);
  });
  it('비싼 출발일일수록 점 원이 넓다', () => {
    const spread = (d: number) => {
      const xs: number[] = [];
      for (let i = d * PER; i < (d + 1) * PER; i++) xs.push(L.x[i] * 1080);
      return Math.max(...xs) - Math.min(...xs);
    };
    expect(spread(13)).toBeGreaterThan(spread(0));
  });
  it('같은 요일은 같은 줄(y), 다음 주 같은 요일은 오른쪽', () => {
    const cy = (d: number) => L.y[d * PER] ;
    const cx = (d: number) => L.x[d * PER];
    expect(Math.abs(cy(0) - cy(7))).toBeLessThan(0.02);
    expect(cx(7)).toBeGreaterThan(cx(0));
  });
  it('요일 이름표 7개, 공휴일 이름표는 labels만큼', () => {
    const text = L.labels.filter((l) => l.type === 'text');
    expect(text.filter((l) => l.type === 'text' && l.cls === 'tick').map((l) => (l as { text: string }).text)).toEqual(['w0', 'w1', 'w2', 'w3', 'w4', 'w5', 'w6']);
    expect(text.filter((l) => l.type === 'text' && l.cls === 'holiday').map((l) => (l as { text: string }).text)).toEqual(['h:kr_hangul_day']);
    expect(text.some((l) => l.type === 'text' && l.cls === 'month')).toBe(true);
  });
  it('좁은 휴대폰 판(340×380)에서도 모든 점이 판 안, 지름 1.6px 이상', () => inside(calendarLayout(charts, { w: 340, h: 380 }, calS)));
});

describe('swarmLayout', () => {
  // 구간 평균(%×10)은 실측 U자와 같은 모양, 표본은 구간마다 40개
  const mean = [111, 44, 9, -24, -37, -50, -43, 21];
  const bin: number[] = [], pct: number[] = [];
  mean.forEach((m, b) => { for (let k = 0; k < 40; k++) { bin.push(b); pct.push(m + (k - 20) * 5); } });
  pct.push(300); bin.push(0); // ±22% 밖 → 그리지 않는다
  const curve: ChartsData['curve'] = { ...charts.curve, mean, sample: { bin, pct } };
  const W = 1080, H = 414;
  const L = swarmLayout(curve, { w: W, h: H }, { bin: (lo, hi) => `D-${lo}~${hi}`, pct: (v) => `${v}%`, axis: 'A' });
  const isSample = (i: number) => L.size[i] === 3;
  const nodes = () => Array.from({ length: L.n }, (_, i) => i).filter((i) => L.size[i] === 6);

  it('범위 밖 표본은 빼고 320개, 평균선 점과 구간 마디 8개', () => {
    expect(Array.from({ length: L.n }, (_, i) => i).filter(isSample)).toHaveLength(320);
    expect(nodes()).toHaveLength(8);
  });
  it('가장 싼 세 구간(D-22~60)만 호박색', () => {
    // 표본은 구간 순서대로 들어가 있다(0번 구간부터 40개씩)
    for (let i = 0; i < 320; i++) expect(L.tone[i] === TONE.amber, `표본 ${i}`).toBe([4, 5, 6].includes(Math.floor(i / 40)));
  });
  it('왼쪽이 먼 출발일, 평균이 가장 낮은 구간의 마디가 가장 아래', () => {
    const ns = nodes().sort((a, b) => L.x[a] - L.x[b]);
    const ys = ns.map((i) => L.y[i]);
    // 왼쪽부터 D-61~90(평균 +2.1%) … D-1~3(+11.1%): 가장 아래(y 최대)는 D-31~45(-5.0%) = 왼쪽에서 세 번째
    expect(ys.indexOf(Math.max(...ys))).toBe(2);
  });
  it('같은 구간의 표본 점끼리 겹치지 않는다', () => {
    for (let b = 0; b < 8; b++) {
      const idx = Array.from({ length: 40 }, (_, k) => b * 40 + k);
      for (let a = 0; a < idx.length; a++) for (let c = a + 1; c < idx.length; c++) {
        const dx = (L.x[idx[a]] - L.x[idx[c]]) * W, dy = (L.y[idx[a]] - L.y[idx[c]]) * H;
        expect(Math.hypot(dx, dy)).toBeGreaterThanOrEqual(2.99);
      }
    }
  });
  it('이름표: 구간 8개 + y 눈금 3개(tick), 축 이름 1개', () => {
    expect(L.labels.filter((l) => l.type === 'text' && l.cls === 'tick')).toHaveLength(11);
    expect(L.labels.filter((l) => l.type === 'text' && l.cls === 'axis')).toHaveLength(1);
  });
  const S = { bin: (lo: number, hi: number) => `D-${lo}~${hi}`, pct: (v: number) => `${v}%`, axis: 'A' };
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
      if (D.size[i] !== 3) continue;
      count++;
      const key = `${Math.round(D.x[i] * 340 * 100)},${Math.round(D.y[i] * 380 * 100)}`;
      expect(seen.has(key), `점 ${i}`).toBe(false);
      seen.add(key);
    }
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThan(200);
  });
  it('호박색 구간은 평균이 가장 낮은 세 구간에서 정한다(고정 번호가 아니다)', () => {
    const shifted = [-60, -55, -50, 10, 20, 30, 40, 50];
    const b2: number[] = [], p2: number[] = [];
    shifted.forEach((m, b) => { for (let k = 0; k < 5; k++) { b2.push(b); p2.push(m); } });
    const X = swarmLayout({ ...charts.curve, mean: shifted, sample: { bin: b2, pct: p2 } }, { w: W, h: H }, S);
    for (let i = 0; i < 40; i++) expect(X.tone[i] === TONE.amber, `표본 ${i}`).toBe([0, 1, 2].includes(Math.floor(i / 5)));
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
  const s = { money: (v: number) => `${v}`, dday: (n: number) => `D+${n}`, holiday: (c: string) => `h:${c}`, axis: 'A' };
  const L = cloudLayout(cd, size, s);
  const sc = cloudScale(cd, size);
  it('예측 없는 날은 건너뛰고, 출발일마다 구름 24개 + 예측가 1개', () => expect(L.n).toBe(2 * 25));
  it('구름 점은 모두 그날 q10~q90 안, 예측가 점은 예측가 자리', () => {
    for (const [j, i] of [[0, 0], [1, 2]]) {
      for (let k = 0; k < 24; k++) {
        const py = L.y[j * 25 + k] * size.h;
        expect(py).toBeGreaterThanOrEqual(sc.y(cd.hi[i]!) - 1e-6);
        expect(py).toBeLessThanOrEqual(sc.y(cd.lo[i]!) + 1e-6);
      }
      expect(L.y[j * 25 + 24] * size.h).toBeCloseTo(sc.y(cd.price[i]!), 3);
    }
  });
  it('예측가 가까이가 가장자리보다 빽빽하다', () => {
    const band = (sc.y(cd.lo[0]!) - sc.y(cd.hi[0]!)) / 4;
    const mid = sc.y(cd.price[0]!);
    const near = Array.from({ length: 24 }, (_, k) => L.y[k] * size.h).filter((py) => Math.abs(py - mid) < band).length;
    expect(near).toBeGreaterThan(12);
  });
  it('공휴일 출발일은 호박색(구름과 예측가 모두), 아니면 예측가만 글자색', () => {
    for (let k = 0; k < 25; k++) expect(L.tone[25 + k]).toBe(TONE.amber);
    expect(L.tone[24]).toBe(TONE.text);
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
