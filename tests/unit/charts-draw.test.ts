// 2D 그리기와 키별 조립 검사: 점마다 원 하나, 색 번호 → 색, 키별로 알맞은 배치 함수를 부른다.
import { describe, expect, it } from 'vitest';
import { buildLayout } from '@/charts/build';
import { drawLayout, TONE_COLOR } from '@/charts/draw2d';
import { TONE, type ChartLayout } from '@/charts/types';
import type { ChartsData, CloudData } from '@/charts/data';
import { dictionaries } from '@/lib/content';
import { facts } from '@/lib/facts';
import { LOCALES } from '@/lib/i18n';

function fakeCtx() {
  const calls: { x: number; y: number; r: number; color: string; alpha: number }[] = [];
  let pending = { x: 0, y: 0, r: 0 };
  const ctx = {
    fillStyle: '', globalAlpha: 1,
    clearRect() {}, beginPath() {},
    arc(x: number, y: number, r: number) { pending = { x, y, r }; },
    fill() { calls.push({ ...pending, color: ctx.fillStyle, alpha: ctx.globalAlpha }); },
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
}

describe('drawLayout', () => {
  it('점마다 원 하나, 판 px 좌표, 반지름 = 지름/2, 색 번호별 색', () => {
    const L: ChartLayout = {
      n: 2, x: Float32Array.from([0.5, 1]), y: Float32Array.from([0, 0.5]), size: Float32Array.from([4, 6]),
      alpha: Float32Array.from([0.5, 1]), tone: Uint8Array.from([TONE.dot, TONE.amber]), group: Int16Array.from([-1, -1]), hl: Int16Array.from([-1, -1]),
      focusTone: TONE.amber, focusDim: 0.25, labels: [],
    };
    const { ctx, calls } = fakeCtx();
    drawLayout(ctx, L, 200, 100);
    expect(calls).toEqual([
      { x: 100, y: 0, r: 2, color: TONE_COLOR[TONE.dot], alpha: 0.5 },
      { x: 200, y: 50, r: 3, color: TONE_COLOR[TONE.amber], alpha: 1 },
    ]);
  });

  it('강조 그룹이 있으면 그 그룹은 호박색, 다른 강조 대상은 알파 × 0.25, 강조와 무관한 점은 그대로', () => {
    const L: ChartLayout = {
      n: 3, x: Float32Array.from([0, 0.5, 1]), y: Float32Array.from([0, 0, 0]), size: Float32Array.from([4, 4, 4]),
      alpha: Float32Array.from([0.8, 0.8, 0.8]), tone: Uint8Array.from([TONE.dot, TONE.dot, TONE.dot]),
      group: Int16Array.from([-1, -1, -1]), hl: Int16Array.from([0, 1, -1]), focusTone: TONE.amber, focusDim: 0.25, labels: [],
    };
    const { ctx, calls } = fakeCtx();
    drawLayout(ctx, L, 100, 100, 1);
    // alpha는 Float32Array를 거쳐 온 값이라 그대로 비교하면 float32→float64 오차가 남는다(0.8 → 0.800000011920929) — 셋째 자리로 반올림해 비교한다
    const rounded = calls.map((c) => ({ color: c.color, alpha: +c.alpha.toFixed(3) }));
    expect(rounded[0]).toEqual({ color: TONE_COLOR[TONE.dot], alpha: 0.2 });
    expect(rounded[1]).toEqual({ color: TONE_COLOR[TONE.amber], alpha: 0.8 });
    expect(rounded[2]).toEqual({ color: TONE_COLOR[TONE.dot], alpha: 0.8 });
  });
});

describe('buildLayout', () => {
  it('features는 facts의 그룹으로 와플 600점, 이름표에 언어별 개수 단위', () => {
    const groups = facts.model.featureGroups.map((g) => ({ id: g.id, gain: g.gain, features: g.features, name: g.id }));
    const L = buildLayout('features', {}, { w: 1080, h: 414 }, { locale: 'en', holidays: {}, groups, countUnit: ' features' });
    expect(L.n).toBe(600);
    expect(L.labels[0]).toMatchObject({ type: 'group', count: `${groups[0].features.length} features` });
  });

  // 표시 상자 문장: 서버에서 {v.…}가 남은 채 온 틀(charts.*.tip)을 짚은 항목 값으로 다 채운다(자리표시가 남지 않는다)
  const dates = ['2026-10-08', '2026-10-09', '2026-10-10'];
  const charts: ChartsData = {
    asOf: '2026-09-22', dates,
    depart: { pct: [-52, 318, 0], holiday: [null, 'kr_hangul_day', null] },
    labels: [{ date: dates[1], code: 'kr_hangul_day' }],
    curve: { bins: [[1, 3], [4, 7], [8, 14], [15, 21], [22, 30], [31, 45], [46, 60], [61, 90]], mean: [111, 44, 9, -24, -37, -50, -43, 21], n: [10, 20, 30, 40, 50, 60, 70, 80], sample: { bin: [], pct: [] } },
  };
  const cloud: CloudData = { asOf: '2026-09-22', dates, price: [187_400, null, 210_000], lo: [152_000, null, 180_000], hi: [231_000, null, 260_000], holidays: {} };
  for (const locale of LOCALES) {
    it(`${locale}: 차트 1·2·4 항목 문장에 자리표시가 남지 않고, 값이 들어간다`, () => {
      const c = dictionaries[locale].charts;
      const holidays = c.holidays as Record<string, string>;
      const size = { w: 1080, h: 414 };
      const dep = buildLayout('chartDepart', { charts }, size, { locale, holidays, tip: c.depart.tip, tipHoliday: c.depart.tipHoliday }).items!;
      const cur = buildLayout('chartCurve', { charts }, size, { locale, holidays, tip: c.curve.tip }).items!;
      const clo = buildLayout('chartCloud', { cloud }, size, { locale, holidays, tip: c.band.tip }).items!;
      for (const it of [...dep, ...cur, ...clo]) expect(it.text).not.toMatch(/[{}]/);
      expect(dep[0].text).toContain('−5%');
      expect(dep[0].text).not.toContain(holidays.kr_hangul_day);
      expect(dep[1].text).toContain('+32%');
      // 공휴일 조각은 tipHoliday 틀로("무렵" / "around" / "前後")
      expect(dep[1].text).toContain(c.depart.tipHoliday.replace('{v.name}', holidays.kr_hangul_day));
      // 항목 0 = 화면 맨 왼쪽 구간(D-61~90)
      expect(cur[0].text).toContain('D-61~90');
      expect(cur[0].text).toContain('+2%');
      expect(cur[0].text).toContain('80');
      expect(clo).toHaveLength(2);
      expect(clo[1].text).toContain(new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(210_000));
    });
  }
});
