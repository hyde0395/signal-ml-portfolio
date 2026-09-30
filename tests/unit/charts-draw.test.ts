// 2D 그리기와 키별 조립 검사: 점마다 원 하나, 색 번호 → 색, 키별로 알맞은 배치 함수를 부른다.
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { buildLayout, loadFor } from '@/charts/build';
import { drawLayout, TONE_COLOR, toneColor } from '@/charts/draw2d';
import { TONE, TONE_VAL, VAL_LO, valTone, type ChartLayout } from '@/charts/types';
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

  it('값 색 번호(10~110)는 파랑 → 호박 보간, 범위 밖은 자른다', () => {
    expect(valTone(0)).toBe(TONE_VAL);
    expect(valTone(100)).toBe(TONE_VAL + 100);
    expect(valTone(140)).toBe(TONE_VAL + 100);
    expect(valTone(-3)).toBe(TONE_VAL);
    expect(toneColor(TONE_VAL)).toBe(VAL_LO.toLowerCase());
    expect(toneColor(TONE_VAL + 100)).toBe('#ffb547');
    expect(toneColor(TONE_VAL + 50)).toBe('#ada1a3'); // (#5A8CFF + #FFB547) / 2, 반올림
    expect(toneColor(TONE.dot)).toBe(TONE_COLOR[TONE.dot]);
  });
});

describe('loadFor', () => {
  it('features: charts.json을 못 받아도 와플은 그리되(charts 없음) 오류는 경고로 남긴다', async () => {
    const err = new Error('offline');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(err));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      await expect(loadFor('features', 'load-fail-test')).resolves.toEqual({ charts: undefined });
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('SHAP'), err);
    } finally {
      warn.mockRestore();
      vi.unstubAllGlobals();
    }
  });
});

describe('buildLayout', () => {
  it('features는 facts의 그룹으로 와플 600점, 이름표에 언어별 개수 단위', () => {
    const groups = facts.model.featureGroups.map((g) => ({ id: g.id, gain: g.gain, features: g.features, name: g.id }));
    const L = buildLayout('features', {}, { w: 1080, h: 414 }, { locale: 'en', holidays: {}, groups, countUnit: ' features' });
    expect(L.n).toBe(600);
    expect(L.labels[0]).toMatchObject({ type: 'group', count: `${groups[0].features.length} features` });
  });

  it('와플: open이 있으면 SHAP 벌떼 배치, 없거나 SHAP 데이터가 없으면 닫힌 와플', () => {
    const charts = JSON.parse(readFileSync(`public/data/charts.${facts.dataVersion}.json`, 'utf8')) as ChartsData;
    const groups = facts.model.featureGroups.map((g) => ({ id: g.id, gain: g.gain, features: g.features, name: g.id }));
    const shapTexts = { lead: 'L', down: 'D', up: 'U', low: 'lo', high: 'hi', catNote: 'C', rowUp: '{v.name} up {v.pct}', rowDown: '{v.name} down {v.pct}', rowMixed: '{v.name} mixed {v.pct}', rowCat: '{v.name} cat {v.pct}', opened: '{v.name}', closed: 'x' };
    const s = { locale: 'ko' as const, holidays: {}, groups, countUnit: '개', shap: shapTexts };
    const closed = buildLayout('features', { charts }, { w: 1080, h: 414 }, s);
    expect(closed.variant ?? '').toBe('');
    // 실제 데이터로 모든 그룹 × 넓은 판·휴대폰 판 — 한 그룹만 보면 줄 많은 그룹이 판 밖으로 나가도 모른다
    for (const size of [{ w: 1080, h: 414 }, { w: 358, h: 354 }]) {
      groups.forEach((g, i) => {
        const open = buildLayout('features', { charts }, size, s, i);
        expect(open.variant).toBe(`open:${i}`);
        expect(open.summary).toHaveLength(g.features.length);
        expect(open.summary![0]).toMatch(/ (up|down|mixed|cat) \d+\.\d%$/);
        for (let j = 0; j < open.n; j++) {
          expect(open.x[j]).toBeGreaterThanOrEqual(0); expect(open.x[j]).toBeLessThanOrEqual(1);
          expect(open.y[j]).toBeGreaterThanOrEqual(0); expect(open.y[j]).toBeLessThanOrEqual(1);
        }
        for (const l of open.labels) {
          expect(l.x).toBeGreaterThanOrEqual(0); expect(l.x).toBeLessThanOrEqual(1);
          expect(l.y).toBeGreaterThanOrEqual(0); expect(l.y).toBeLessThanOrEqual(1);
        }
      });
    }
    expect(buildLayout('features', {}, { w: 1080, h: 414 }, s, 0).variant ?? '').toBe(''); // 데이터 없음 → 닫힌 와플
  });

  // ③ 모델 구조 점(계획 7-2): 단계(step)마다 다른 배치 종류, 3단계 축 이름표는 기준 가격 대비. 실제 데이터로 넓은 판·휴대폰 판
  it('chartModel: step으로 단계 배치, 실제 데이터에서 점·이름표가 판 안', () => {
    const charts = JSON.parse(readFileSync(`public/data/charts.${facts.dataVersion}.json`, 'utf8')) as ChartsData;
    const s = { locale: 'ko' as const, holidays: {}, axis: 'AX', axisResid: 'RES', line: 'LINE' };
    for (const size of [{ w: 1080, h: 414 }, { w: 358, h: 354 }]) {
      for (const step of [0, 1, 2, 3]) {
        const L = buildLayout('chartModel', { charts }, size, s, -1, step);
        expect(L.variant).toBe(`stage:${Math.min(step, 2)}`);
        for (let j = 0; j < L.n; j++) {
          expect(L.x[j]).toBeGreaterThanOrEqual(0); expect(L.x[j]).toBeLessThanOrEqual(1);
          expect(L.y[j]).toBeGreaterThanOrEqual(0); expect(L.y[j]).toBeLessThanOrEqual(1);
        }
        for (const l of L.labels) {
          expect(l.x).toBeGreaterThanOrEqual(0); expect(l.x).toBeLessThanOrEqual(1);
          expect(l.y).toBeGreaterThanOrEqual(0); expect(l.y).toBeLessThanOrEqual(1);
        }
        const axis = L.labels.find((l) => l.type === 'text' && l.cls === 'axis');
        expect(axis).toMatchObject({ text: step >= 2 ? 'RES' : 'AX' });
      }
    }
    expect(buildLayout('chartModel', { charts }, { w: 1080, h: 414 }, s).variant).toBe('stage:0'); // step 기본 0
  });

  it('chartFilter: 실제 데이터에서 (단계, sub)마다 점 개수 같음, 이름표 판 안, 마지막에 걸러낸 행 수', () => {
    const charts = JSON.parse(readFileSync(`public/data/charts.${facts.dataVersion}.json`, 'utf8')) as ChartsData;
    const s = { locale: 'ko' as const, holidays: {}, axis: 'AX', axisResid: 'RES', line: 'LINE' };
    const fs = { ...s, axisX: '소요', box: '상자', rowsRaw: 'RAW', rowsKept: 'KEPT' };
    const size = { w: 1080, h: 414 };
    const Ls = [[0, 0], [1, 0], [1, 1], [2, 0], [2, 1]].map(([st, sb]) => buildLayout('chartFilter', { charts }, size, fs, -1, st, sb));
    expect(new Set(Ls.map((l) => l.n)).size).toBe(1);
    expect(Ls[4].labels[0]).toMatchObject({ text: 'KEPT' });
    for (const L of Ls) for (const l of L.labels) { expect(l.x).toBeGreaterThanOrEqual(0); expect(l.x).toBeLessThanOrEqual(1); }
    // 규칙 ③(직항 확인) 점은 대부분 상자 안(215~400분)이다 — 실제 데이터 모양 확인
    const f = charts.filter!;
    const r3 = f.dur.filter((_, i) => f.rule[i] === 3);
    expect(r3.filter((m) => m >= 215 && m <= 400).length / r3.length).toBeGreaterThan(0.95);
  });
  it('chartSplit: 실제 데이터에서 TSS sub마다 평가 점 수가 비슷하다(각 폴드 약 1/6)', () => {
    const charts = JSON.parse(readFileSync(`public/data/charts.${facts.dataVersion}.json`, 'utf8')) as ChartsData;
    const s = { locale: 'ko' as const, holidays: {}, axis: 'AX', axisResid: 'RES', line: 'LINE' };
    const m = { name: 'X', r2: 'R', mae: 'M', tag: 'T' };
    const ss = { ...s, axisX: '수집일', legend: ['a', 'b', 'c'] as [string, string, string], methods: [m, m, m] as const };
    const size = { w: 1080, h: 414 };
    for (let sb = 0; sb < 5; sb++) {
      const L = buildLayout('chartSplit', { charts }, size, ss, -1, 2, sb);
      const test = Array.from(L.tone).filter((t) => t === 2).length;
      expect(test / L.n).toBeGreaterThan(0.12);
      expect(test / L.n).toBeLessThan(0.22);
    }
  });

  it('커밋된 charts.json의 SHAP 피처 = facts 와플 그룹 피처의 합집합', () => {
    const charts = JSON.parse(readFileSync(`public/data/charts.${facts.dataVersion}.json`, 'utf8')) as ChartsData;
    const want = new Set(facts.model.featureGroups.flatMap((g) => g.features));
    expect(new Set(charts.shap!.features)).toEqual(want);
    expect(charts.shap!.features).toHaveLength(want.size);
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
