// 배경 표본 밀도(설계 2026-10-07 §2): 배경 층 점 크기 = 상수, 구름 출발일당 점 수. 수치는 설계 표 그대로
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { ChartsData } from '@/charts/data';
import { filterLayout, FILTER } from '@/charts/filter';
import { CLOUD, SWARM } from '@/charts/layouts';
import { MODEL, modelLayout } from '@/charts/model';
import { SPLIT, splitLayout } from '@/charts/split';
import { facts } from '@/lib/facts';
import { TONE } from '@/charts/types';
import { buildLayout } from '@/charts/build';
import { buildPointCloud, mapSchema, terrainSchema } from '@/three/data';

const charts = JSON.parse(readFileSync(`public/data/charts.${facts.dataVersion}.json`, 'utf8')) as ChartsData;
const WIDE = { w: 1100, h: 520 }, NARROW = { w: 358, h: 360 };
// 배경 점(색 TONE.dot · 알파 > 0)의 크기 집합 — 규칙 선·상자(호박)·기준선(글자색) 점은 빼고 본다
const sizes = (L: { n: number; size: Float32Array; alpha: Float32Array; tone: Uint8Array }) => {
  const out = new Set<number>();
  for (let i = 0; i < L.n; i++) if (L.tone[i] === TONE.dot && L.alpha[i] > 0) out.add(L.size[i]);
  return out;
};
const only = (L: Parameters<typeof sizes>[0], v: number) => { const s = sizes(L); return s.size > 0 && [...s].every((x) => x === Math.fround(v)); };

describe('배경 점 크기 상수(설계 표)', () => {
  it('U자 벌떼 1.5 · 간격 0.3', () => { expect(SWARM.dot).toBe(1.5); expect(SWARM.gap).toBe(0.3); });
  it('구름 출발일마다 60, 가운데 층 2.1 · 바깥 1.7', () => {
    expect(CLOUD.perDate).toBe(60); expect(CLOUD.coreSize).toBe(2.1); expect(CLOUD.outerSize).toBe(1.7);
  });
  it('모델 1.55/1.2, 걸러내기 1.9/1.45, 검증 설계 1.9/1.4', () => {
    expect([MODEL.dotWide, MODEL.dotNarrow]).toEqual([1.55, 1.2]);
    expect([FILTER.dotWide, FILTER.dotNarrow]).toEqual([1.9, 1.45]);
    expect([SPLIT.dotWide, SPLIT.dotNarrow]).toEqual([1.9, 1.4]);
  });
});

describe('배치가 상수를 쓴다', () => {
  const texts = { month: () => '', pct: () => '', axis: '', axisResid: '', line: '' };
  it('모델 관측 점 = dotWide(넓은 판)·dotNarrow(좁은 판)', () => {
    expect(only(modelLayout(charts, WIDE, 0, texts), MODEL.dotWide)).toBe(true);
    expect(only(modelLayout(charts, NARROW, 0, texts), MODEL.dotNarrow)).toBe(true);
  });
  const fTexts = { axisX: '', axisY: '', box: '', rowsRaw: '', rowsKept: '', rules: ['', '', ''] as [string, string, string], counts: ['', '', ''] as [string, string, string], minutes: String, pct: String };
  it('걸러내기 점 = dotWide·dotNarrow', () => {
    expect(only(filterLayout(charts, WIDE, 0, 0, fTexts), FILTER.dotWide)).toBe(true);
    expect(only(filterLayout(charts, NARROW, 0, 0, fTexts), FILTER.dotNarrow)).toBe(true);
  });
  const empty = { name: '', r2: '', mae: '', tag: '' };
  const sTexts = { month: () => '', axisX: '', axisY: '', legend: ['', '', ''] as [string, string, string], methods: [empty, empty, empty] as const };
  it('검증 설계 점 = dotWide·dotNarrow', () => {
    expect(only(splitLayout(charts, WIDE, 2, 0, sTexts), SPLIT.dotWide)).toBe(true);
    expect(only(splitLayout(charts, NARROW, 2, 0, sTexts), SPLIT.dotNarrow)).toBe(true);
  });
});

describe('표본 수(설계 §3)', () => {
  it('U자 16,000 · 걸러내기·검증 설계 8,000', () => {
    expect(charts.curve.sample.pct).toHaveLength(16_000);
    expect(charts.filter!.pct).toHaveLength(8_000);
    expect(charts.split!.fetch).toHaveLength(8_000);
  });
  it('모델 관측은 출발일마다 최대 48개, 48개인 날이 있다', () => {
    const per = new Map<number, number>();
    for (const d of charts.model!.obs.date) per.set(d, (per.get(d) ?? 0) + 1);
    expect(Math.max(...per.values())).toBe(48);
  });
});

// 3D는 차트 점마다 지형 점 하나를 배정하고 모자라면 남은 점을 버린다(chartTargets.ts assignPoints) — 별·선 점은 표본 뒤에
// 더해지므로 버려지면 결론 층이 사라진다. 세로 화면은 잡음 점을 절반만 만들어(noiseStride 2) 그쪽이 더 작다
describe('3D 점 수 한도(설계 §4)', () => {
  const rd = (f: string) => JSON.parse(readFileSync(`public/data/${f}`, 'utf8'));
  const terrain = terrainSchema.parse(rd(`terrain.${facts.dataVersion}.json`));
  const map = mapSchema.parse(rd('map.v1.json'));
  const pool = buildPointCloud(terrain, map, { noiseStride: 2, seed: 7 }).count;
  const S = { locale: 'ko' as const, holidays: {} };
  const cases: [string, number, number][] = [['chartCurve', 0, 0], ['chartModel', 0, 0], ['chartFilter', 2, 1], ['chartSplit', 2, 4]];
  for (const size of [WIDE, NARROW]) for (const [key, step, sub] of cases) {
    it(`${key} ${size.w}px: 점 수 ≤ 세로 화면 점 구름`, () => {
      const L = buildLayout(key as never, { charts }, size, S, -1, step, sub);
      expect(L.n).toBeLessThanOrEqual(pool);
    });
  }
  it('구름(⑤ 차트 4)도 한도 안', async () => {
    const { loadCloud } = await import('@/charts/data');
    const demo = rd(`demo.${facts.dataVersion}.json`);
    const cd = await loadCloud(facts.dataVersion, (async () => ({ ok: true, json: async () => demo })) as never);
    const n = buildLayout('chartCloud', { cloud: cd }, WIDE, S).n;
    expect(n).toBeLessThanOrEqual(pool);
  });
});
