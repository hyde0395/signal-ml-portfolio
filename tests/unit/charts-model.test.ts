// ③ 모델 구조 점 배치 검사(계획 7-2): 세 단계의 점 개수·group이 같다(3D에서 같은 점이 옮겨 다닌다), 판 안(0..1),
// 1단계 공휴일 호박색, 2단계 기준 선이 밝아진다, 3단계 선이 한 높이(0)로 펴져 끊기고 큰 잔차만 호박색, variant.
import { describe, expect, it } from 'vitest';
import type { ChartsData } from '@/charts/data';
import { DEPART } from '@/charts/layouts';
import { MODEL, modelLayout, residualPct } from '@/charts/model';
import { TONE, type ChartLabel, type ChartLayout } from '@/charts/types';

const dates = ['2026-10-01', '2026-10-02', '2026-10-05', '2026-10-09', '2026-10-20'];
// 둘째 날만 공휴일 무렵. 관측 7개(날짜 번호, %×10), 기준 %×10은 출발일마다 하나(넷째 날은 없음)
const data = {
  asOf: '2026-09-22',
  dates,
  depart: { pct: [0, 0, 0, 0, 0], holiday: [null, 'kr_x', null, null, null] },
  labels: [],
  curve: { bins: [], mean: [], n: [], sample: { bin: [], pct: [] } },
  model: {
    route: 'ICN_NRT', cabin: 'LCC',
    base: [0, 400, -100, null, 200],
    obs: { date: [0, 0, 1, 1, 2, 3, 4], pct: [100, -50, 900, 200, -600, 50, 1500] },
  },
} as unknown as ChartsData;
const S = { month: (iso: string) => iso.slice(5, 7), pct: (v: number) => `${v}%`, axis: 'AX', axisResid: 'RES', line: 'LINE' };
const size = { w: 1000, h: 400 };
const at = (stage: number, sz = size) => modelLayout(data, sz, stage, S);
const OBS = data.model!.obs.date.length;
// 점 순서: 0% 흐린 기준선(개수는 판 폭에 따라) → 관측 → 선 점(뒤 MODEL.linePts개)
const obsStart = (L: ChartLayout) => L.n - MODEL.linePts - OBS;
const lineStart = (L: ChartLayout) => L.n - MODEL.linePts;
const texts = (L: ChartLayout) => L.labels.filter((l): l is Extract<ChartLabel, { type: 'text' }> => l.type === 'text');

const inside = (L: ChartLayout) => {
  for (let i = 0; i < L.n; i++) {
    expect(L.x[i]).toBeGreaterThanOrEqual(0); expect(L.x[i]).toBeLessThanOrEqual(1);
    expect(L.y[i]).toBeGreaterThanOrEqual(0); expect(L.y[i]).toBeLessThanOrEqual(1);
  }
};

describe('residualPct', () => {
  it('같은 평균에 대한 두 %로 기준 대비 %를 만든다', () => {
    expect(residualPct(10, 10)).toBeCloseTo(0, 9);
    expect(residualPct(32, 10)).toBeCloseTo(20, 9); // 1.32 / 1.1 = 1.2
    expect(residualPct(-10, 20)).toBeCloseTo(-25, 9); // 0.9 / 1.2 = 0.75
  });
});

describe('modelLayout', () => {
  const L = [at(0), at(1), at(2)];
  it('세 단계의 점 개수·group이 같고, 모두 판 안이다', () => {
    for (const l of L) {
      expect(l.n).toBe(L[0].n);
      expect(Array.from(l.group)).toEqual(Array.from(L[0].group));
      inside(l);
    }
    // 관측 점의 group = 출발일 번호(3D에서 그 출발일의 지형 점이 모인다)
    for (let k = 0; k < OBS; k++) expect(L[0].group[obsStart(L[0]) + k]).toBe(data.model!.obs.date[k]);
    // 선 점도 가장 가까운 출발일 번호
    for (let i = lineStart(L[0]); i < L[0].n; i++) expect(L[0].group[i]).toBeGreaterThanOrEqual(0);
  });
  it('variant는 단계 번호, 범위 밖 단계는 잘린다', () => {
    expect(L.map((l) => l.variant)).toEqual(['stage:0', 'stage:1', 'stage:2']);
    expect(at(3).variant).toBe('stage:2');
    expect(at(-1).variant).toBe('stage:0');
  });
  it('1단계: 공휴일 무렵이면서 높은(≥ DEPART.hotPct) 관측만 호박색, 선 점은 안 보인다', () => {
    const l = L[0], o = obsStart(l);
    for (let k = 0; k < OBS; k++) {
      const hot = data.model!.obs.date[k] === 1 && data.model!.obs.pct[k] / 10 >= DEPART.hotPct;
      expect(l.tone[o + k] === TONE.amber).toBe(hot);
    }
    // 공휴일 무렵이지만 낮은 점(20%)과 공휴일이 아닌 높은 점(150%)은 호박색이 아니다
    expect(l.tone[o + 3]).not.toBe(TONE.amber);
    expect(l.tone[o + 6]).not.toBe(TONE.amber);
    expect(l.tone[o + 2]).toBe(TONE.amber);
    for (let i = lineStart(l); i < l.n; i++) expect(l.alpha[i]).toBe(0);
  });
  it('2단계: 관측은 흐려지고 선 점이 밝게, 선은 기준 %를 따라 오르내린다', () => {
    const l = L[1], o = obsStart(l);
    for (let k = 0; k < OBS; k++) if (L[0].alpha[o + k] > 0) expect(l.alpha[o + k]).toBeLessThan(L[0].alpha[o + k]);
    const ys = new Set<number>();
    for (let i = lineStart(l); i < l.n; i++) { expect(l.alpha[i]).toBeGreaterThan(0.9); ys.add(l.y[i]); }
    expect(ys.size).toBeGreaterThan(3);
    // 관측 자리는 1단계와 같다(흐려지기만)
    for (let k = 0; k < OBS; k++) expect(l.y[o + k]).toBe(L[0].y[o + k]);
  });
  it('3단계: 선이 한 높이(0)로 펴지고 끊긴 점선, 관측은 잔차 높이로, 큰 잔차만 호박색', () => {
    const l = L[2], o = obsStart(l), ls = lineStart(l);
    const lineY = new Set<number>();
    let gaps = 0;
    for (let i = ls; i < l.n; i++) { lineY.add(l.y[i]); if (l.alpha[i] === 0) gaps++; }
    expect(lineY.size).toBe(1);
    expect(gaps).toBeGreaterThan(0);
    expect(gaps).toBeLessThan(MODEL.linePts);
    const zeroY = [...lineY][0];
    const m = data.model!;
    for (let k = 0; k < OBS; k++) {
      const b = m.base[m.obs.date[k]];
      if (b === null) { expect(l.alpha[o + k]).toBe(0); continue; } // 기준이 없는 날은 잔차를 그릴 수 없다
      const r = residualPct(m.obs.pct[k] / 10, b / 10);
      expect(l.tone[o + k] === TONE.amber).toBe(Math.abs(r) >= MODEL.residHot);
      // 0보다 비싸면 0 줄 위(화면 y가 작다)
      if (Math.abs(r) > 1) expect(l.y[o + k] < zeroY).toBe(r > 0);
    }
  });
  it('축 이름표는 3단계에서 기준 대비로 바뀌고, 선 이름표는 2·3단계에만', () => {
    expect(texts(L[0]).some((t) => t.text === 'AX')).toBe(true);
    expect(texts(L[2]).some((t) => t.text === 'RES')).toBe(true);
    expect(texts(L[2]).some((t) => t.text === 'AX')).toBe(false);
    expect(texts(L[0]).some((t) => t.text === 'LINE')).toBe(false);
    expect(texts(L[1]).some((t) => t.text === 'LINE')).toBe(true);
    expect(texts(L[2]).some((t) => t.text === 'LINE')).toBe(true);
    for (const l of L) for (const t of texts(l)) { expect(t.x).toBeGreaterThanOrEqual(0); expect(t.x).toBeLessThanOrEqual(1); expect(t.y).toBeGreaterThanOrEqual(0); expect(t.y).toBeLessThanOrEqual(1); }
  });
  it('세로 범위(MODEL.lo~hi) 밖 점은 가장자리에 쌓지 않고 숨긴다', () => {
    const o = obsStart(L[0]), last = OBS - 1; // 마지막 관측 = +150% — 범위 밖
    expect(data.model!.obs.pct[last] / 10).toBeGreaterThan(MODEL.hi);
    expect(L[0].alpha[o + last]).toBe(0);
    for (let k = 0; k < last; k++) expect(L[0].alpha[o + k]).toBeGreaterThan(0);
    // 3단계는 잔차 기준: +150%와 기준 +20% → 잔차 약 +108%, 범위 안이라 보인다
    expect(L[2].alpha[o + last]).toBeGreaterThan(0);
  });
  it('조작 항목이 없다(보기 전용)', () => {
    for (const l of L) expect(l.items).toBeUndefined();
  });
  it('좁은 휴대폰 판에서도 판 안', () => {
    for (let s = 0; s < 3; s++) inside(at(s, { w: 358, h: 354 }));
  });
  it('model이 없으면 던진다', () => {
    expect(() => modelLayout({ ...data, model: undefined }, size, 0, S)).toThrow();
  });
  it('1단계에만 별자리 선: 기준 가격이 있는 출발일 마디를 날짜 순으로', () => {
    expect(L[0].lines ?? []).toHaveLength(0);
    expect(L[2].lines ?? []).toHaveLength(0);
    expect(L[1].lines).toHaveLength(1);
    const pts = L[1].lines![0].pts;
    const known = data.model!.base.filter((v) => v !== null).length;
    expect(pts).toHaveLength(known * 2);
    for (let k = 2; k < pts.length; k += 2) expect(pts[k]).toBeGreaterThanOrEqual(pts[k - 2]);
  });
  it('2단계 0 끊긴 점선은 결론 층(보이는 점 알파 MODEL.zeroA)', () => {
    const l = L[2];
    for (let i = lineStart(l); i < l.n; i++) if (l.alpha[i] > 0) expect(l.alpha[i]).toBeCloseTo(MODEL.zeroA);
  });
});
