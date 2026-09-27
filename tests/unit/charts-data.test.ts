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
