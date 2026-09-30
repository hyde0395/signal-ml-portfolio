// SHAP 벌떼 배치 검사(계획 5-3c): 줄 순서·방향, 점 겹침 없음, 판 안, 3D 점 짝 맞추기 순서, 범주형 색.
import { describe, expect, it } from 'vitest';
import type { FeatureGroupInput } from '@/charts/layouts';
import { shapOpenLayout, shapPct, shapRows, SHAP_LAYOUT, type ShapData, type ShapRow } from '@/charts/shap';
import { TONE, TONE_VAL, type ChartLayout } from '@/charts/types';

// 피처 a: 값이 높을수록 크게 올림, b: 작고 방향 반대, c: 범주형
const N = 150;
const seq = (f: (i: number) => number) => Array.from({ length: N }, (_, i) => f(i));
const shap: ShapData = {
  n: N,
  features: ['b', 'a', 'c', 'd'],
  categorical: ['c'],
  v: [seq((i) => -Math.round((i - 75) * 0.5)), seq((i) => Math.round((i - 75) * 3)), seq((i) => ((i * 37) % 60) - 30), seq(() => 0)],
  f: [seq((i) => Math.round((i / (N - 1)) * 100)), seq((i) => Math.round((i / (N - 1)) * 100)), seq(() => 50), seq((i) => i % 101)],
};
const groups: FeatureGroupInput[] = [
  { id: 'g0', gain: 40, features: ['a', 'b'], name: 'G0' },
  { id: 'g1', gain: 30, features: ['c'], name: 'G1' },
  { id: 'holiday', gain: 20.4, features: ['d'], name: 'H' },
  { id: 'g3', gain: 9.6, features: [], name: 'G3' },
];
const s = {
  gain: (v: number) => `${v.toFixed(1)}%`, count: (n: number) => `${n}개`, pct: (v: number) => `${v}%`,
  lead: 'LEAD', down: 'DOWN', up: 'UP', low: 'LOW', high: 'HIGH', catNote: 'CAT',
  row: (r: ShapRow) => `${r.id}:${r.dir}`,
};
const inside = (L: ChartLayout) => {
  for (let i = 0; i < L.n; i++) {
    expect(L.x[i]).toBeGreaterThanOrEqual(0); expect(L.x[i]).toBeLessThanOrEqual(1);
    expect(L.y[i]).toBeGreaterThanOrEqual(0); expect(L.y[i]).toBeLessThanOrEqual(1);
  }
  for (const l of L.labels) { expect(l.x).toBeGreaterThanOrEqual(0); expect(l.x).toBeLessThanOrEqual(1); expect(l.y).toBeGreaterThanOrEqual(0); expect(l.y).toBeLessThanOrEqual(1); }
};

describe('shapPct', () => {
  it('log 잔차 ×1000 → %', () => {
    expect(shapPct(0)).toBe(0);
    expect(shapPct(1000)).toBeCloseTo((Math.E - 1) * 100, 6);
  });
});

describe('shapRows', () => {
  const rows = shapRows(shap, ['b', 'a', 'c']);
  it('그룹 피처만, 평균 |%|가 큰 순', () => {
    expect(rows.map((r) => r.id)).toEqual(['a', 'b', 'c'].sort((x, y) => rows.find((r) => r.id === y)!.meanAbs - rows.find((r) => r.id === x)!.meanAbs));
    expect(rows[0].id).toBe('a');
    for (let i = 1; i < rows.length; i++) expect(rows[i - 1].meanAbs).toBeGreaterThanOrEqual(rows[i].meanAbs);
  });
  it('방향: 값과 SHAP의 상관 부호, 범주형은 cat', () => {
    const by = Object.fromEntries(rows.map((r) => [r.id, r.dir]));
    expect(by).toEqual({ a: 'up', b: 'down', c: 'cat' });
    expect(shapRows(shap, ['d'])[0].dir).toBe('mixed'); // SHAP이 모두 0 → 상관 없음
  });
  it('없는 피처 이름은 던진다(facts와 charts.json이 어긋나면 바로 보이게)', () => {
    expect(() => shapRows(shap, ['zzz'])).toThrow();
  });
});

describe('shapOpenLayout', () => {
  const W = 1080, H = 414;
  const L = shapOpenLayout(groups, 0, shap, { w: W, h: H }, s);
  it('variant·요약 문장·강조 색', () => {
    expect(L.variant).toBe('open:0');
    expect(L.summary).toEqual(['a:up', 'b:down']);
    expect(L.focusTone).toBe(TONE.amber);
  });
  it('3D 짝 맞추기 순서: 다른 그룹 자리(k×100)는 그 그룹 작은 와플, 펼친 그룹 자리는 벌떼 점', () => {
    for (let k = 1; k < groups.length; k++) for (let j = 0; j < 100; j++) expect(L.hl[k * 100 + j]).toBe(k);
    for (let j = 0; j < 100; j++) expect(L.hl[j]).toBe(-1);
    // 펼친 그룹의 작은 와플 100개는 그 뒤(400~499)
    for (let j = 400; j < 500; j++) expect(L.hl[j]).toBe(0);
  });
  it('작은 와플 켜진 점 수 = 반올림 gain, 공휴일 그룹 켜진 점은 호박', () => {
    const lit = (from: number) => { let n = 0; for (let j = from; j < from + 100; j++) if (L.alpha[j] > 0.5) n++; return n; };
    expect(lit(100)).toBe(30); expect(lit(200)).toBe(20); expect(lit(300)).toBe(10); expect(lit(400)).toBe(40);
    for (let j = 200; j < 300; j++) expect(L.tone[j] === TONE.amber).toBe(L.alpha[j] > 0.5);
  });
  it('벌떼 점: 비범주형은 값 색, 겹치지 않는다, 판 안', () => {
    const swarm: number[] = [];
    for (let i = 0; i < L.n; i++) if (L.hl[i] === -1 && L.tone[i] >= TONE_VAL) swarm.push(i);
    expect(swarm.length).toBeGreaterThan(250); // 2줄 × 150 중 98% 범위 밖·넘침을 빼고
    const seen = new Set<string>();
    for (const i of swarm) {
      const key = `${Math.round(L.x[i] * W * 10)}:${Math.round(L.y[i] * H * 10)}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
    inside(L);
  });
  it('이름표: 작은 와플 그룹 4 + 피처 이름 2(줄 순서대로 위에서 아래) + 머리 줄 + 범례 + 축', () => {
    const g = L.labels.filter((l) => l.type === 'group');
    expect(g).toHaveLength(4);
    expect(g.every((l) => l.type === 'group' && l.mini === 'name' && l.compact)).toBe(true);
    const f = L.labels.filter((l) => l.type === 'text' && l.cls === 'feature');
    expect(f.map((l) => l.type === 'text' && l.text)).toEqual(['a', 'b']);
    expect(f[0].y).toBeLessThan(f[1].y);
    const head = L.labels.find((l) => l.type === 'text' && l.cls === 'head');
    expect(head && head.type === 'text' && head.text).toBe('G0 · 40.0% · 2개 — LEAD');
    const texts = L.labels.flatMap((l) => (l.type === 'text' ? [l.text] : []));
    for (const t of ['LOW', 'HIGH', 'DOWN', 'UP', '0%']) expect(texts).toContain(t);
    expect(texts).not.toContain('CAT');
  });
  it('범주형만 있는 그룹: 벌떼 점은 중간색(TONE.dot), 범례 대신 안내 한 줄', () => {
    const C = shapOpenLayout(groups, 1, shap, { w: W, h: H }, s);
    for (let j = 0; j < 100; j++) if (C.alpha[j] > 0) expect(C.tone[j]).toBe(TONE.dot);
    const texts = C.labels.flatMap((l) => (l.type === 'text' ? [l.text] : []));
    expect(texts).toContain('CAT');
    expect(texts).not.toContain('LOW');
  });
  it('좁은 판(휴대폰): 머리 줄에 설명 없음, 작은 와플 이름표는 %, 판 안', () => {
    const M = shapOpenLayout(groups, 0, shap, { w: 358, h: 354 }, s);
    const head = M.labels.find((l) => l.type === 'text' && l.cls === 'head');
    expect(head && head.type === 'text' && head.text).toBe('G0 · 40.0% · 2개');
    expect(M.labels.filter((l) => l.type === 'group').every((l) => l.type === 'group' && l.mini === 'pct')).toBe(true);
    inside(M);
  });
  it('13줄(가장 많은 그룹)도 줄 높이가 점 두 개 이상', () => {
    const many: ShapData = { ...shap, features: Array.from({ length: 13 }, (_, i) => `x${i}`), categorical: [],
      v: Array.from({ length: 13 }, (_, k) => shap.v[1].map((x) => x * (k + 1))), f: Array.from({ length: 13 }, () => shap.f[1]) };
    const G: FeatureGroupInput[] = [{ id: 'lookup', gain: 46.8, features: many.features, name: 'L' }, ...groups.slice(1)];
    const M = shapOpenLayout(G, 0, many, { w: 358, h: 354 }, s);
    const ys = M.labels.filter((l) => l.type === 'text' && l.cls === 'feature').map((l) => l.y * 354);
    expect(ys).toHaveLength(13);
    for (let i = 1; i < ys.length; i++) expect(ys[i] - ys[i - 1]).toBeGreaterThanOrEqual(SHAP_LAYOUT.dot.narrow * 4);
    inside(M);
  });
});
