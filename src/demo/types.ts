// 데모 데이터의 타입·상수와 화면이 쓰는 ForecastSource 인터페이스(스펙 §6.3).
// zod 없이 타입과 상수만 있어 초기 JS에 들어가도 가볍다. 검사 코드는 source.ts에 있고, 데모 섹션이 화면
// 가까이 올 때만 불러온다.
export const ROUTES = ['ICN_NRT', 'NRT_ICN', 'ICN_KIX', 'KIX_ICN', 'ICN_HND', 'HND_ICN'] as const;
export type Route = (typeof ROUTES)[number];
export const CABINS = ['LCC', 'FSC'] as const;
export type Cabin = (typeof CABINS)[number];
export const ACTIONS = ['BUY_NOW', 'DROP_EXPECTED', 'WAIT'] as const;
export type Action = (typeof ACTIONS)[number];
// 추천 이유 코드. V2Predictor.recommend_action()의 분기와 1:1이다(scripts/export_demo.py encode_reco)
export const WHYS = ['IMMINENT', 'PAST_OPTIMAL', 'AT_LOW', 'SMALL_SAVING', 'FALLING', 'LATER_LOW'] as const;
export type Why = (typeof WHYS)[number];

export type Reco = {
  action: Action;
  why: Why;
  bestDay: number;
  bestPrice: number;
  waitDays: number;
  saving: number;
  savingPct: number; // 지금보다 몇 % 싼가(양수)
  globalBestDay: number;
  confidence: 'high' | 'medium' | null;
};
export type StripDay = { date: string; price: number | null; holiday: string | null };
export type Forecast = { date: string; price: number; lo: number; hi: number; reco: Reco };
export type Meta = { asOf: string; precomputed: boolean };

export interface ForecastSource {
  meta(): Promise<Meta>;
  getStrip(route: Route, cabin: Cabin): Promise<StripDay[]>;
  getForecast(route: Route, cabin: Cabin, departDate: string): Promise<Forecast | null>;
}

export function demoUrl(dataVersion: string): string {
  return `/data/demo.${dataVersion}.json`;
}
