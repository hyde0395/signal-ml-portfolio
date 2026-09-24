// 미리 계산한 demo.<기준일>.json을 읽는 ForecastSource(스펙 §6.3). 모델 서버가 생기면 같은 인터페이스의
// ApiForecastSource를 만들고 DemoApp에서 생성하는 한 줄만 바꾼다. zod가 들어 있어 DemoApp이 dynamic
// import로만 부른다(초기 JS에 넣지 않기 위해).
import { z } from 'zod';
import {
  ACTIONS, CABINS, ROUTES, WHYS,
  type Cabin, type Forecast, type ForecastSource, type Meta, type Route, type StripDay,
} from './types';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const won = z.number().int().nonnegative().nullable();
const reco = z.object({
  action: z.enum(ACTIONS),
  why: z.enum(WHYS),
  bestDay: z.number().int(),
  bestPrice: z.number().int(),
  waitDays: z.number().int(),
  saving: z.number().int(),
  savingPct: z.number(),
  globalBestDay: z.number().int(),
  confidence: z.enum(['high', 'medium']).nullable(),
});
const series = z.object({ price: z.array(won), lo: z.array(won), hi: z.array(won), reco: z.array(reco.nullable()) });

export const demoSchema = z
  .object({
    asOf: isoDate,
    precomputed: z.boolean(),
    routes: z.array(z.enum(ROUTES)),
    cabins: z.array(z.enum(CABINS)),
    dates: z.array(isoDate).min(1),
    holidays: z.record(isoDate, z.string().regex(/^(kr|jp)_[a-z0-9_]+$/)),
    series: z.record(z.string(), series.nullable()),
  })
  .superRefine((d, ctx) => {
    for (const [key, s] of Object.entries(d.series)) {
      if (s && [s.price, s.lo, s.hi, s.reco].some((a) => a.length !== d.dates.length)) {
        // 영어 머리말은 e2e가 "이 모듈이 초기 청크에 없는지" 찾을 때 쓰는 표식이다(tests/e2e/demo.spec.ts)
        ctx.addIssue({ code: 'custom', message: `demo-series-length-mismatch: ${key} 배열 길이가 dates와 다르다` });
      }
    }
  });
export type DemoData = z.infer<typeof demoSchema>;

export class StaticForecastSource implements ForecastSource {
  private readonly url: string;
  private readonly fetcher: typeof fetch;
  private data: Promise<DemoData> | null = null;

  // 기본값을 fetch 그대로 넘기면 this.fetcher(...)로 부를 때 브라우저가 "Illegal invocation"을 던진다 → 감싼다
  constructor(url: string, fetcher: typeof fetch = (input, init) => fetch(input, init)) {
    this.url = url;
    this.fetcher = fetcher;
  }

  private load(): Promise<DemoData> {
    // 실패한 Promise를 남겨 두면 "다시 시도"가 계속 같은 실패를 돌려주므로, 실패하면 비워 다음 호출이 새로 받게 한다
    this.data ??= this.fetcher(this.url)
      .then(async (res) => {
        if (!res.ok) throw new Error(`${this.url}: HTTP ${res.status}`);
        return demoSchema.parse(await res.json());
      })
      .catch((e: unknown) => {
        this.data = null;
        throw e;
      });
    return this.data;
  }

  async meta(): Promise<Meta> {
    const d = await this.load();
    return { asOf: d.asOf, precomputed: d.precomputed };
  }

  async getStrip(route: Route, cabin: Cabin): Promise<StripDay[]> {
    const d = await this.load();
    const s = d.series[`${route}/${cabin}`] ?? null;
    return d.dates.map((date, i) => ({ date, price: s?.price[i] ?? null, holiday: d.holidays[date] ?? null }));
  }

  async getForecast(route: Route, cabin: Cabin, departDate: string): Promise<Forecast | null> {
    const d = await this.load();
    const s = d.series[`${route}/${cabin}`];
    const i = d.dates.indexOf(departDate);
    if (!s || i < 0) return null;
    const price = s.price[i], lo = s.lo[i], hi = s.hi[i], reco = s.reco[i];
    // 하나라도 비면 그 날은 "예측 없음"이다(막대에서도 고를 수 없게 그린다)
    if (price === null || lo === null || hi === null || reco === null) return null;
    return { date: departDate, price, lo, hi, reco };
  }
}
