// ④ 차트 데이터 읽기: charts.<기준일>.json(점 달력·구간별 벌떼)과 demo.<기준일>.json의 인천→나리타 LCC
// 예측(불확실성 구름)을 zod로 검사한다. zod가 들어 있어 그림 판이 화면 가까이 올 때만 import()로 불러온다.
import { z } from 'zod';

const iso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const ints = z.array(z.number().int());

export const chartsSchema = z.object({
  asOf: iso,
  dates: z.array(iso).min(2),
  depart: z.object({ pct: ints, holiday: z.array(z.string().nullable()) }),
  labels: z.array(z.object({ date: iso, code: z.string() })),
  curve: z.object({
    bins: z.array(z.tuple([z.number().int(), z.number().int()])).length(8),
    mean: ints.length(8),
    n: ints.length(8),
    sample: z.object({ bin: ints, pct: ints }),
  }),
})
  .refine((c) => c.depart.pct.length === c.dates.length && c.depart.holiday.length === c.dates.length, '출발일 배열 길이가 서로 다르다')
  .refine((c) => c.curve.sample.bin.length === c.curve.sample.pct.length, '표본 배열 길이가 서로 다르다');
export type ChartsData = z.infer<typeof chartsSchema>;

// 불확실성 구름은 데모 데이터에서 한 조합만 쓴다(설계 §3.4 차트 4 — 기준일 인천→나리타 LCC)
export const CLOUD_SERIES = 'ICN_NRT/LCC';
const won = z.number().nullable();
const cloudSchema = z.object({
  asOf: iso,
  dates: z.array(iso).min(1),
  holidays: z.record(z.string(), z.string()),
  series: z.record(z.string(), z.object({ price: z.array(won), lo: z.array(won), hi: z.array(won) }).nullable()),
});
export type CloudData = {
  asOf: string;
  dates: string[];
  price: (number | null)[];
  lo: (number | null)[];
  hi: (number | null)[];
  holidays: Record<string, string>; // 출발일 → 공휴일 코드(±3일)
};

async function getJson(url: string, fetcher: typeof fetch): Promise<unknown> {
  const res = await fetcher(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.json();
}

export async function loadCharts(dataVersion: string, fetcher: typeof fetch = fetch): Promise<ChartsData> {
  return chartsSchema.parse(await getJson(`/data/charts.${dataVersion}.json`, fetcher));
}

export async function loadCloud(dataVersion: string, fetcher: typeof fetch = fetch): Promise<CloudData> {
  const d = cloudSchema.parse(await getJson(`/data/demo.${dataVersion}.json`, fetcher));
  const s = d.series[CLOUD_SERIES];
  if (!s) throw new Error(`${CLOUD_SERIES} 예측이 없다`);
  return { asOf: d.asOf, dates: d.dates, price: s.price, lo: s.lo, hi: s.hi, holidays: d.holidays };
}
