// 그림 판 키별로 데이터를 불러와 배치를 만든다. zod와 배치 코드가 들어 있어 ChartStage가 import()로만 부른다
// (초기 JS 150KB). 날짜·금액 글자는 방문자 언어(Intl)로 만든다 — 문구 파일이 아니라 형식이라 숫자 규칙과 무관.
import { loadCharts, loadCloud, type ChartsData, type CloudData } from './data';
import { calendarLayout, cloudLayout, swarmLayout, waffleLayout, type FeatureGroupInput, type PlotSize } from './layouts';
import type { ChartKey, ChartLayout } from './types';

export { drawLayout } from './draw2d';

export type ChartStrings = {
  locale: string;
  holidays: Record<string, string>; // 공휴일 코드 → 이름(점 달력·구름)
  axis?: string;                    // 세로축 이름(벌떼·구름)
  groups?: FeatureGroupInput[];     // 와플(③)만
  countUnit?: string;               // "개" / " features" / "個"
};
export type Loaded = { charts?: ChartsData; cloud?: CloudData };

// charts.json은 점 달력과 벌떼가 같이 쓰므로 한 번만 받는다
const memo = new Map<string, Promise<unknown>>();
function once<T>(key: string, f: () => Promise<T>): Promise<T> {
  if (!memo.has(key)) memo.set(key, f().catch((e) => { memo.delete(key); throw e; })); // 실패는 기억하지 않는다(다시 시도 가능)
  return memo.get(key) as Promise<T>;
}

export async function loadFor(key: ChartKey, dataVersion: string): Promise<Loaded> {
  if (key === 'features') return {};
  if (key === 'chartCloud') return { cloud: await once(`cloud:${dataVersion}`, () => loadCloud(dataVersion)) };
  return { charts: await once(`charts:${dataVersion}`, () => loadCharts(dataVersion)) };
}

const signed = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v)}%`;
const MONDAY = Date.UTC(2024, 0, 1); // 2024-01-01은 월요일

export function buildLayout(key: ChartKey, loaded: Loaded, size: PlotSize, s: ChartStrings): ChartLayout {
  const holiday = (code: string) => s.holidays[code] ?? code;
  switch (key) {
    case 'features':
      return waffleLayout(s.groups ?? [], size, { pct: (v) => `${v.toFixed(1)}%`, count: (n) => `${n}${s.countUnit ?? ''}` });
    case 'chartDepart': {
      const wd = new Intl.DateTimeFormat(s.locale, { weekday: 'short', timeZone: 'UTC' });
      const mo = new Intl.DateTimeFormat(s.locale, { month: 'short', timeZone: 'UTC' });
      return calendarLayout(loaded.charts!, size, {
        weekday: (i) => wd.format(new Date(MONDAY + i * 86_400_000)),
        month: (iso) => mo.format(new Date(`${iso}T00:00:00Z`)),
        holiday,
      });
    }
    case 'chartCurve':
      return swarmLayout(loaded.charts!.curve, size, { bin: (lo, hi) => `D-${lo}~${hi}`, pct: signed, axis: s.axis ?? '' });
    case 'chartCloud': {
      const money = new Intl.NumberFormat(s.locale, { notation: 'compact', maximumFractionDigits: 1 });
      return cloudLayout(loaded.cloud!, size, { money: (v) => money.format(v), dday: (n) => `D+${n}`, holiday, axis: s.axis ?? '' });
    }
  }
}
