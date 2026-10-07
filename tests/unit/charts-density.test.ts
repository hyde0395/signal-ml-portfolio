// 배경 표본 밀도(설계 2026-10-07 §2): 배경 층 점 크기 = 상수, 구름 출발일당 점 수. 수치는 설계 표 그대로
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { ChartsData } from '@/charts/data';
import { filterLayout, FILTER } from '@/charts/filter';
import { CLOUD, SWARM } from '@/charts/layouts';
import { MODEL, modelLayout } from '@/charts/model';
import { SPLIT, splitLayout } from '@/charts/split';
import { facts } from '@/lib/facts';

const charts = JSON.parse(readFileSync(`public/data/charts.${facts.dataVersion}.json`, 'utf8')) as ChartsData;
const WIDE = { w: 1100, h: 520 }, NARROW = { w: 358, h: 360 };
const sizes = (L: { n: number; size: Float32Array }) => new Set(Array.from({ length: L.n }, (_, i) => L.size[i]));

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
    expect(sizes(modelLayout(charts, WIDE, 0, texts)).has(Math.fround(MODEL.dotWide))).toBe(true);
    expect(sizes(modelLayout(charts, NARROW, 0, texts)).has(Math.fround(MODEL.dotNarrow))).toBe(true);
  });
  const fTexts = { axisX: '', axisY: '', box: '', rowsRaw: '', rowsKept: '', rules: ['', '', ''] as [string, string, string], counts: ['', '', ''] as [string, string, string], minutes: String, pct: String };
  it('걸러내기 점 = dotWide·dotNarrow', () => {
    expect(sizes(filterLayout(charts, WIDE, 0, 0, fTexts)).has(Math.fround(FILTER.dotWide))).toBe(true);
    expect(sizes(filterLayout(charts, NARROW, 0, 0, fTexts)).has(Math.fround(FILTER.dotNarrow))).toBe(true);
  });
  const empty = { name: '', r2: '', mae: '', tag: '' };
  const sTexts = { month: () => '', axisX: '', axisY: '', legend: ['', '', ''] as [string, string, string], methods: [empty, empty, empty] as const };
  it('검증 설계 점 = dotWide·dotNarrow', () => {
    expect(sizes(splitLayout(charts, WIDE, 2, 0, sTexts)).has(Math.fround(SPLIT.dotWide))).toBe(true);
    expect(sizes(splitLayout(charts, NARROW, 2, 0, sTexts)).has(Math.fround(SPLIT.dotNarrow))).toBe(true);
  });
});
