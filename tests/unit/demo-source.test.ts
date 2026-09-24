// 데모 데이터 접근 계층 검사: 막대·결과 조회, 대표 편 없는 조합, 불러오기 실패와 다시 시도,
// 형식 검사, 그리고 커밋된 demo.json 자체(CI에서 항공권 저장소 없이 돈다).
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { describe, expect, it, vi } from 'vitest';
import { demoSchema, StaticForecastSource } from '@/demo/source';
import { demoUrl } from '@/demo/types';
import { facts } from '@/lib/facts';

const reco = { action: 'DROP_EXPECTED', why: 'FALLING', bestDay: 30, bestPrice: 171000, waitDays: 12, saving: 16400, savingPct: 8.7, globalBestDay: 30, confidence: 'medium' };
const fixture = {
  asOf: '2026-09-22', precomputed: true, routes: ['ICN_NRT'], cabins: ['LCC', 'FSC'],
  dates: ['2026-09-25', '2026-09-26'],
  holidays: { '2026-09-26': 'kr_chuseok' },
  series: {
    'ICN_NRT/LCC': { price: [187400, null], lo: [152000, null], hi: [231000, null], reco: [reco, null] },
    'ICN_NRT/FSC': null,
  },
};
const ok = (body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));

describe('StaticForecastSource', () => {
  it('meta: 기준일과 미리 계산 여부', async () => {
    const src = new StaticForecastSource('/d.json', vi.fn(() => ok(fixture)) as unknown as typeof fetch);
    expect(await src.meta()).toEqual({ asOf: '2026-09-22', precomputed: true });
  });

  it('getStrip: 날짜마다 예측가(없으면 null)와 공휴일 코드', async () => {
    const src = new StaticForecastSource('/d.json', vi.fn(() => ok(fixture)) as unknown as typeof fetch);
    expect(await src.getStrip('ICN_NRT', 'LCC')).toEqual([
      { date: '2026-09-25', price: 187400, holiday: null },
      { date: '2026-09-26', price: null, holiday: 'kr_chuseok' },
    ]);
  });

  it('대표 편이 없는 조합은 모든 날이 null', async () => {
    const src = new StaticForecastSource('/d.json', vi.fn(() => ok(fixture)) as unknown as typeof fetch);
    expect((await src.getStrip('ICN_NRT', 'FSC')).map((d) => d.price)).toEqual([null, null]);
    expect(await src.getForecast('ICN_NRT', 'FSC', '2026-09-25')).toBeNull();
  });

  it('getForecast: 값이 있는 날은 결과, 없는 날·모르는 날은 null', async () => {
    const src = new StaticForecastSource('/d.json', vi.fn(() => ok(fixture)) as unknown as typeof fetch);
    expect(await src.getForecast('ICN_NRT', 'LCC', '2026-09-25')).toEqual({ date: '2026-09-25', price: 187400, lo: 152000, hi: 231000, reco });
    expect(await src.getForecast('ICN_NRT', 'LCC', '2026-09-26')).toBeNull();
    expect(await src.getForecast('ICN_NRT', 'LCC', '2027-01-01')).toBeNull();
  });

  it('파일은 한 번만 받는다', async () => {
    const fetcher = vi.fn(() => ok(fixture));
    const src = new StaticForecastSource('/d.json', fetcher as unknown as typeof fetch);
    await src.meta();
    await src.getStrip('ICN_NRT', 'LCC');
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith('/d.json');
  });

  it('실패하면 reject하고, 다음 호출은 새로 받는다(다시 시도 버튼)', async () => {
    const fetcher = vi.fn()
      .mockReturnValueOnce(Promise.resolve(new Response('no', { status: 404 })))
      .mockReturnValueOnce(ok(fixture));
    const src = new StaticForecastSource('/d.json', fetcher as unknown as typeof fetch);
    await expect(src.meta()).rejects.toThrow('HTTP 404');
    await expect(src.meta()).resolves.toEqual({ asOf: '2026-09-22', precomputed: true });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('배열 길이가 dates와 다르면 형식 오류', () => {
    const bad = structuredClone(fixture) as typeof fixture;
    bad.series['ICN_NRT/LCC']!.price = [1];
    expect(() => demoSchema.parse(bad)).toThrow(/demo-series-length-mismatch/);
  });

  it('price는 있는데 reco가 없으면 형식 오류(넷 다 있거나 넷 다 없어야 한다)', () => {
    const bad = structuredClone(fixture) as typeof fixture;
    bad.series['ICN_NRT/LCC']!.reco[0] = null;
    expect(() => demoSchema.parse(bad)).toThrow(/demo-series-null-mismatch/);
  });

  it('series 키가 노선/등급 형식이 아니면 형식 오류', () => {
    const bad = structuredClone(fixture) as typeof fixture;
    (bad.series as Record<string, unknown>)['ICN_NRT/lcc'] = bad.series['ICN_NRT/LCC'];
    expect(() => demoSchema.parse(bad)).toThrow();
  });
});

describe('커밋된 demo.json', () => {
  const body = readFileSync(`public${demoUrl(facts.dataVersion)}`);
  const data = demoSchema.parse(JSON.parse(body.toString('utf-8')));

  it('스키마를 통과하고 gzip 500KB 이하', () => {
    expect(data.asOf).toBe(facts.dataVersion);
    expect(data.dates).toHaveLength(88);
    expect(gzipSync(body).length).toBeLessThanOrEqual(500 * 1024);
  });

  it('facts.demoDefault 조합은 예측이 있고 가격 하락 예상이다', async () => {
    const src = new StaticForecastSource('/d.json', vi.fn(() => ok(data)) as unknown as typeof fetch);
    const { route, cabin, date } = facts.demoDefault;
    const f = await src.getForecast(route, cabin, date);
    expect(f?.reco.action).toBe('DROP_EXPECTED');
  });

  it('모든 예측은 lo ≤ 예측가 ≤ hi', () => {
    for (const s of Object.values(data.series)) {
      if (!s) continue;
      s.price.forEach((p, i) => {
        if (p === null) return;
        expect(s.lo[i]!).toBeLessThanOrEqual(p);
        expect(p).toBeLessThanOrEqual(s.hi[i]!);
      });
    }
  });
});
