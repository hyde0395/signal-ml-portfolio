// 그림 판 키별로 데이터를 불러와 배치를 만든다. zod와 배치 코드가 들어 있어 ChartStage가 import()로만 부른다
// (초기 JS 150KB). 날짜·금액 글자는 방문자 언어(Intl)로 만든다 — 문구 파일이 아니라 형식이라 숫자 규칙과 무관.
import { loadCharts, loadCloud, type ChartsData, type CloudData } from './data';
import { cloudLayout, departLayout, swarmLayout, waffleLayout, type FeatureGroupInput, type PlotSize } from './layouts';
import type { ChartKey, ChartLayout } from './types';
import { interpolate, type Locale } from '@/lib/i18n';

export { drawLayout } from './draw2d';

export type ChartStrings = {
  locale: Locale;
  holidays: Record<string, string>; // 공휴일 코드 → 이름(출발일·구름)
  axis?: string;                    // 세로축 이름(출발일·벌떼·구름)
  weekdayTitle?: string;            // 요일 평균 제목(출발일만)
  groups?: FeatureGroupInput[];     // 와플(③)만
  countUnit?: string;               // "개" / " features" / "個"
  // 표시 상자 문장 틀(charts.<id>.tip, 차트 1·2·4). {v.…}가 채워지지 않은 채 서버에서 넘어온다 — 여기서 짚은 항목 값으로 채운다
  tip?: string;
};
export type Loaded = { charts?: ChartsData; cloud?: CloudData };

// charts.json은 출발일 차트와 벌떼가 같이 쓰므로 한 번만 받는다
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
// 표시 상자의 %는 정수로 — 이름표 눈금과 같은 표기(소수 %는 작은 상자에서 읽기 번거롭다)
const signedInt = (v: number) => signed(Math.round(v));
const MONDAY = Date.UTC(2024, 0, 1); // 2024-01-01은 월요일

export function buildLayout(key: ChartKey, loaded: Loaded, size: PlotSize, s: ChartStrings): ChartLayout {
  const holiday = (code: string) => s.holidays[code] ?? code;
  // 문장 틀이 없으면(와플 등) 빈 문장 — 이 경우 조작 층도 문장을 쓰지 않는다
  const tip = (v: Record<string, string | number>) => (s.tip ? interpolate(s.tip, { v }, s.locale) : '');
  // 표시 상자의 출발일: 연도 없이 월·일·요일(출발일은 한 해 안팎이라 연도가 없어도 헷갈리지 않는다)
  const day = new Intl.DateTimeFormat(s.locale, { month: 'short', day: 'numeric', weekday: 'short', timeZone: 'UTC' });
  const dayOf = (iso: string) => day.format(new Date(`${iso}T00:00:00Z`));
  switch (key) {
    case 'features':
      return waffleLayout(s.groups ?? [], size, { pct: (v) => `${v.toFixed(1)}%`, count: (n) => `${n}${s.countUnit ?? ''}` });
    case 'chartDepart': {
      const wd = new Intl.DateTimeFormat(s.locale, { weekday: 'short', timeZone: 'UTC' });
      const mo = new Intl.DateTimeFormat(s.locale, { month: 'short', timeZone: 'UTC' });
      return departLayout(loaded.charts!, size, {
        weekday: (i) => wd.format(new Date(MONDAY + i * 86_400_000)),
        month: (iso) => mo.format(new Date(`${iso}T00:00:00Z`)),
        holiday, pct: signed, axis: s.axis ?? '', weekdayTitle: s.weekdayTitle ?? '',
        // 공휴일 이름은 앞에 구분자를 붙여 넘긴다 — 공휴일이 아닌 날은 틀의 {v.holiday}가 빈 글자로 사라지게
        tip: (v) => tip({ date: dayOf(v.date), pct: signedInt(v.pct), holiday: v.holiday ? ` · ${v.holiday}` : '' }),
      });
    }
    case 'chartCurve':
      return swarmLayout(loaded.charts!.curve, size, {
        bin: (lo, hi) => `D-${lo}~${hi}`, pct: signed, axis: s.axis ?? '',
        tip: (v) => tip({ bin: v.bin, pct: signedInt(v.pct), n: v.n }),
      });
    case 'chartCloud': {
      const money = new Intl.NumberFormat(s.locale, { notation: 'compact', maximumFractionDigits: 1 });
      return cloudLayout(loaded.cloud!, size, {
        money: (v) => money.format(v), dday: (n) => `D+${n}`, holiday, axis: s.axis ?? '',
        // 금액은 세로축 이름표와 같은 간략 표기(예: 18.7만 / 187.4K). 단위(원·₩)는 문장 틀에 있다
        tip: (v) => tip({ date: dayOf(v.date), price: money.format(v.price), lo: money.format(v.lo), hi: money.format(v.hi) }),
      });
    }
  }
}
