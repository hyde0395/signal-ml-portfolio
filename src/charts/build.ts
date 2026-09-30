// 그림 판 키별로 데이터를 불러와 배치를 만든다. zod와 배치 코드가 들어 있어 ChartStage가 import()로만 부른다
// (초기 JS 150KB). 날짜·금액 글자는 방문자 언어(Intl)로 만든다 — 문구 파일이 아니라 형식이라 숫자 규칙과 무관.
import { loadCharts, loadCloud, type ChartsData, type CloudData } from './data';
import { cloudLayout, departLayout, swarmLayout, waffleLayout, type FeatureGroupInput, type PlotSize } from './layouts';
import { modelLayout } from './model';
import { shapOpenLayout } from './shap';
import type { ChartKey, ChartLayout } from './types';
import { interpolate, type Locale } from '@/lib/i18n';

export { drawLayout } from './draw2d';

// ③ SHAP 벌떼 문구(content features.shap). row*·opened는 {v.name}·{v.pct} 자리표시를 남긴 채 넘어온다.
// 키 목록을 값으로 두는 건 Features.tsx가 문구를 형 변환으로 넘겨 타입 검사가 키 불일치를 못 잡기 때문 — 단위 테스트가 세 언어 문구와 대조한다
export const SHAP_TEXT_KEYS = ['lead', 'down', 'up', 'low', 'high', 'catNote', 'rowUp', 'rowDown', 'rowMixed', 'rowCat', 'opened', 'closed'] as const;
export type ShapTexts = Record<(typeof SHAP_TEXT_KEYS)[number], string>;

export type ChartStrings = {
  locale: Locale;
  holidays: Record<string, string>; // 공휴일 코드 → 이름(출발일·구름)
  axis?: string;                    // 세로축 이름(출발일·벌떼·구름·모델 구조 1·2단계)
  axisResid?: string;               // 모델 구조 3단계 세로축 이름(기준 가격 대비)
  line?: string;                    // 모델 구조 기준 가격 선 이름표
  weekdayTitle?: string;            // 요일 평균 제목(출발일만)
  groups?: FeatureGroupInput[];     // 와플(③)만
  countUnit?: string;               // "개" / " features" / "個"
  shap?: ShapTexts;                 // 와플(③)만 — 펼친 SHAP 벌떼
  // 표시 상자 문장 틀(charts.<id>.tip, 차트 1·2·4). {v.…}가 채워지지 않은 채 서버에서 넘어온다 — 여기서 짚은 항목 값으로 채운다
  tip?: string;
  // 출발일 표시 상자의 공휴일 조각 틀(charts.depart.tipHoliday, {v.name}). 공휴일 코드는 공휴일 ±3일을 표시하므로 "무렵"으로 쓴다
  tipHoliday?: string;
};
export type Loaded = { charts?: ChartsData; cloud?: CloudData };

// charts.json은 출발일 차트와 벌떼가 같이 쓰므로 한 번만 받는다
const memo = new Map<string, Promise<unknown>>();
function once<T>(key: string, f: () => Promise<T>): Promise<T> {
  if (!memo.has(key)) memo.set(key, f().catch((e) => { memo.delete(key); throw e; })); // 실패는 기억하지 않는다(다시 시도 가능)
  return memo.get(key) as Promise<T>;
}

export async function loadFor(key: ChartKey, dataVersion: string): Promise<Loaded> {
  // 와플은 닫힌 상태에 데이터가 필요 없다 — charts.json을 못 받아도 와플은 그리고 펼치기만 막는다(ChartStage)
  if (key === 'features') {
    const charts = await once(`charts:${dataVersion}`, () => loadCharts(dataVersion)).catch((e: unknown) => {
      // 조용히 삼키면 펼치기가 왜 안 되는지(네트워크·스키마 불일치) 알 길이 없다 — 동작은 그대로 두고 흔적만 남긴다
      console.warn('SHAP 데이터를 불러오지 못했다 — 와플만 그린다', e);
      return undefined;
    });
    return { charts };
  }
  if (key === 'chartCloud') return { cloud: await once(`cloud:${dataVersion}`, () => loadCloud(dataVersion)) };
  return { charts: await once(`charts:${dataVersion}`, () => loadCharts(dataVersion)) };
}

const signed = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v)}%`;
// 표시 상자의 %는 정수로 — 이름표 눈금과 같은 표기(소수 %는 작은 상자에서 읽기 번거롭다)
const signedInt = (v: number) => signed(Math.round(v));
const MONDAY = Date.UTC(2024, 0, 1); // 2024-01-01은 월요일

// open: ③ 펼친 와플 그룹 번호(−1 = 닫힘). step: 단계가 있는 판(③ 모델 구조)의 지금 단계 = 자막 문단 번호(ChartStage가 자른다)
export function buildLayout(key: ChartKey, loaded: Loaded, size: PlotSize, s: ChartStrings, open = -1, step = 0): ChartLayout {
  const holiday = (code: string) => s.holidays[code] ?? code;
  // 문장 틀이 없으면(와플 등) 빈 문장 — 이 경우 조작 층도 문장을 쓰지 않는다
  const tip = (v: Record<string, string | number>) => (s.tip ? interpolate(s.tip, { v }, s.locale) : '');
  // 표시 상자의 출발일: 연도 없이 월·일·요일(출발일은 한 해 안팎이라 연도가 없어도 헷갈리지 않는다)
  const day = new Intl.DateTimeFormat(s.locale, { month: 'short', day: 'numeric', weekday: 'short', timeZone: 'UTC' });
  const dayOf = (iso: string) => day.format(new Date(`${iso}T00:00:00Z`));
  switch (key) {
    case 'features': {
      const gain = (v: number) => `${v.toFixed(1)}%`, count = (n: number) => `${n}${s.countUnit ?? ''}`;
      const shap = loaded.charts?.shap, T = s.shap, groups = s.groups ?? [];
      if (open >= 0 && open < groups.length && shap && T) {
        const tpl = { up: T.rowUp, down: T.rowDown, mixed: T.rowMixed, cat: T.rowCat };
        return shapOpenLayout(groups, open, shap, size, {
          gain, count, pct: signed, lead: T.lead, down: T.down, up: T.up, low: T.low, high: T.high, catNote: T.catNote,
          row: (r) => interpolate(tpl[r.dir], { v: { name: r.id, pct: `${r.meanAbs.toFixed(1)}%` } }, s.locale),
        });
      }
      return waffleLayout(groups, size, { pct: gain, count });
    }
    case 'chartModel': {
      const mo = new Intl.DateTimeFormat(s.locale, { month: 'short', timeZone: 'UTC' });
      return modelLayout(loaded.charts!, size, step, {
        month: (iso) => mo.format(new Date(`${iso}T00:00:00Z`)), pct: signed,
        axis: s.axis ?? '', axisResid: s.axisResid ?? '', line: s.line ?? '',
      });
    }
    case 'chartDepart': {
      const wd = new Intl.DateTimeFormat(s.locale, { weekday: 'short', timeZone: 'UTC' });
      const mo = new Intl.DateTimeFormat(s.locale, { month: 'short', timeZone: 'UTC' });
      return departLayout(loaded.charts!, size, {
        weekday: (i) => wd.format(new Date(MONDAY + i * 86_400_000)),
        month: (iso) => mo.format(new Date(`${iso}T00:00:00Z`)),
        holiday, pct: signed, axis: s.axis ?? '', weekdayTitle: s.weekdayTitle ?? '',
        // 공휴일 조각(구분자 포함)은 tipHoliday 틀로 만든다 — 공휴일 무렵이 아닌 날은 빈 글자라 틀의 {v.holiday}가 사라진다
        tip: (v) => tip({
          date: dayOf(v.date), pct: signedInt(v.pct),
          holiday: v.holiday && s.tipHoliday ? interpolate(s.tipHoliday, { v: { name: v.holiday } }, s.locale) : '',
        }),
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
