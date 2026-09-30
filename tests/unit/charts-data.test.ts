// 차트 데이터 읽기 검사: 실제 생성 파일(charts·demo)이 스키마를 통과하고, 404·길이 불일치는 reject.
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { CLOUD_SERIES, loadCharts, loadCloud } from '@/charts/data';
import { facts } from '@/lib/facts';

const v = facts.dataVersion;
const file = (name: string) => JSON.parse(readFileSync(`public/data/${name}.${v}.json`, 'utf8'));
const ok = (body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
const as = (f: unknown) => f as unknown as typeof fetch;

describe('loadCharts', () => {
  it('생성된 charts.json을 받아들인다(출발일 수 = 지형 출발일 수, 구간 8개)', async () => {
    const fetcher = vi.fn(() => ok(file('charts')));
    const c = await loadCharts(v, as(fetcher));
    expect(fetcher).toHaveBeenCalledWith(`/data/charts.${v}.json`);
    expect(c.dates).toEqual(file('terrain').dates);
    expect(c.curve.bins).toHaveLength(8);
    expect(c.curve.sample.bin.length).toBeGreaterThan(1000);
  });
  it('출발일 배열 길이가 다르면 reject', async () => {
    const bad = file('charts');
    bad.depart.pct = bad.depart.pct.slice(1);
    await expect(loadCharts(v, as(vi.fn(() => ok(bad))))).rejects.toThrow();
  });
  it('SHAP 표본: 피처 33개 × n, 값 순위 0~100', async () => {
    const c = await loadCharts(v, as(vi.fn(() => ok(file('charts')))));
    expect(c.shap?.features).toHaveLength(33);
    expect(c.shap?.v.every((r) => r.length === c.shap!.n)).toBe(true);
    expect(c.shap?.f.flat().every((x) => x >= 0 && x <= 100)).toBe(true);
  });
  it('SHAP 줄 길이가 n과 다르면 reject', async () => {
    const bad = file('charts');
    bad.shap.v[0] = bad.shap.v[0].slice(1);
    await expect(loadCharts(v, as(vi.fn(() => ok(bad))))).rejects.toThrow();
  });
  // ③ 모델 구조 점(계획 7-2): 기준 %는 출발일마다 하나, 관측 날짜 번호는 charts.dates 안
  it('모델 구조: 기준 % 길이 = 출발일 수, 관측 날짜 번호가 출발일 범위 안', async () => {
    const c = await loadCharts(v, as(vi.fn(() => ok(file('charts')))));
    expect(c.model?.base).toHaveLength(c.dates.length);
    expect(c.model?.obs.date.length).toBe(c.model?.obs.pct.length);
    expect(c.model?.obs.date.every((i) => i >= 0 && i < c.dates.length)).toBe(true);
  });
  it('모델 구조: 기준 % 길이가 다르거나 관측 날짜 번호가 범위 밖이면 reject', async () => {
    const short = file('charts');
    short.model.base = short.model.base.slice(1);
    await expect(loadCharts(v, as(vi.fn(() => ok(short))))).rejects.toThrow();
    const out = file('charts');
    out.model.obs.date[0] = out.dates.length;
    await expect(loadCharts(v, as(vi.fn(() => ok(out))))).rejects.toThrow();
    const uneven = file('charts');
    uneven.model.obs.pct = uneven.model.obs.pct.slice(1);
    await expect(loadCharts(v, as(vi.fn(() => ok(uneven))))).rejects.toThrow();
  });
  it('404면 reject', async () => {
    await expect(loadCharts(v, as(vi.fn(() => Promise.resolve(new Response('no', { status: 404 })))))).rejects.toThrow();
  });
});

describe('loadCloud', () => {
  it('데모 데이터에서 인천→나리타 LCC 한 조합을 꺼낸다', async () => {
    const demo = file('demo');
    const c = await loadCloud(v, as(vi.fn(() => ok(demo))));
    expect(c.dates).toEqual(demo.dates);
    expect(c.price).toEqual(demo.series[CLOUD_SERIES].price);
    expect(c.lo).toHaveLength(c.dates.length);
    expect(c.holidays).toEqual(demo.holidays);
  });
  it('그 조합이 비어 있으면(null) reject', async () => {
    const demo = file('demo');
    demo.series[CLOUD_SERIES] = null;
    await expect(loadCloud(v, as(vi.fn(() => ok(demo))))).rejects.toThrow();
  });
});
