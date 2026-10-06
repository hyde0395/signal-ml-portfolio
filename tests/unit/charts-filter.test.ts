// ② 걸러내기 배치(계획 8-1): 규칙마다 호박색 → 떨어짐, 거꾸로 가면 되돌아옴, 범위 밖 처리, 점 개수 불변
import { describe, expect, it } from 'vitest';
import type { ChartsData } from '@/charts/data';
import { FILTER, filterLayout, filterState } from '@/charts/filter';
import { TONE } from '@/charts/types';

// dur·pct·rule 한 쌍씩: 통과 2개, ① 1개(400분 초과), ② 1개, ③ 1개, 960분 초과 통과 1개(칸), 범위 밖 %(+500%) 1개
const data = {
  dates: ['2026-05-15', '2026-05-16'],
  filter: {
    dur: [150, 140, 665, 150, 320, 1200, 150],
    pct: [100, -200, 50, 0, 2350, 0, 5000],
    rule: [0, 0, 1, 2, 3, 1, 0],
  },
} as unknown as ChartsData;
const S = { axisX: '소요', axisY: '평균 대비', box: '직항인데 오래', rowsRaw: '258,829 ROWS', rowsKept: '242,874 ROWS', minutes: (v: number) => `${v}`, pct: (v: number) => `${v}%`,
  rules: ['단위 오류', '시각 불일치', '직항인데 오래'] as [string, string, string], counts: ['5,742', '826', '9,387'] as [string, string, string] };
const size = { w: 1080, h: 414 };
const pointOf = (L: ReturnType<typeof filterLayout>, k: number) => {
  // 표본 점은 규칙 선·상자 점 뒤에 온다 — 표본 k번째 = 뒤에서 (n - k)번째
  const i = L.n - data.filter!.dur.length + k;
  return { x: L.x[i], y: L.y[i], a: L.alpha[i], tone: L.tone[i] };
};

describe('filterState', () => {
  it('규칙 ①·②는 단계 1에서 켜지고 sub 1부터 떨어진다, ③은 단계 2', () => {
    expect(filterState(1, 0, 0)).toBe('plain');
    expect(filterState(1, 1, 0)).toBe('lit');
    expect(filterState(2, 1, 1)).toBe('fallen');
    expect(filterState(1, 2, 0)).toBe('fallen'); // 앞 단계에서 떨어진 점은 그대로
    expect(filterState(3, 1, 1)).toBe('plain');
    expect(filterState(3, 2, 0)).toBe('lit');
    expect(filterState(3, 2, 1)).toBe('fallen');
    expect(filterState(0, 2, 1)).toBe('plain');
  });
});

describe('filterLayout', () => {
  it('단계·sub마다 점 개수가 같고 variant가 다르다, 좌표는 판 안(떨어진 점만 아래 밖)', () => {
    const all = [[0, 0], [1, 0], [1, 1], [2, 0], [2, 1]].map(([st, sb]) => filterLayout(data, size, st, sb, S));
    expect(new Set(all.map((l) => l.n)).size).toBe(1);
    expect(new Set(all.map((l) => l.variant))).toEqual(new Set(['stage:0:0', 'stage:1:0', 'stage:1:1', 'stage:2:0', 'stage:2:1']));
    for (const L of all) for (let i = 0; i < L.n; i++) {
      expect(L.x[i]).toBeGreaterThanOrEqual(0); expect(L.x[i]).toBeLessThanOrEqual(1);
      if (L.alpha[i] > 0) { expect(L.y[i]).toBeGreaterThanOrEqual(0); expect(L.y[i]).toBeLessThanOrEqual(1); }
    }
  });
  it('걸린 점은 켜질 때 호박색, 떨어지면 알파 0에 판 아래, 거꾸로 가면 제자리', () => {
    const lit = filterLayout(data, size, 1, 0, S), fell = filterLayout(data, size, 1, 1, S), back = filterLayout(data, size, 0, 0, S);
    expect(pointOf(lit, 2).tone).toBe(TONE.amber);
    expect(pointOf(fell, 2).a).toBe(0);
    expect(pointOf(fell, 2).y).toBeGreaterThan(1);
    expect(pointOf(back, 2).tone).toBe(TONE.dot);
    expect(pointOf(back, 2).y).toBeCloseTo(pointOf(lit, 2).y);
    expect(pointOf(fell, 4).a).toBeGreaterThan(0); // ③은 아직
  });
  it('960분 넘는 행은 오른쪽 "960+" 칸, 세로 범위 밖(+500%)은 알파 0', () => {
    const L = filterLayout(data, size, 0, 0, S);
    const main = pointOf(L, 0).x, over = pointOf(L, 5).x;
    expect(over).toBeGreaterThan(main);
    expect(L.labels.some((l) => l.type === 'text' && l.text === '960+')).toBe(true);
    expect(pointOf(L, 6).a).toBe(0);
  });
  it('첫 이름표는 행 수 — 마지막(단계 2, sub 1)에만 걸러낸 뒤 값', () => {
    const first = (st: number, sb: number) => filterLayout(data, size, st, sb, S).labels[0];
    expect(first(0, 0)).toMatchObject({ cls: 'stat', text: '258,829 ROWS' });
    expect(first(2, 0)).toMatchObject({ text: '258,829 ROWS' });
    expect(first(2, 1)).toMatchObject({ text: '242,874 ROWS' });
  });
  it('규칙 이름표: 적용된 규칙은 ruleOn', () => {
    const cls = (st: number) => filterLayout(data, size, st, 0, S).labels.filter((l) => l.type === 'text' && /^RULE/.test(l.text)).map((l) => (l as { cls: string }).cls);
    expect(cls(0)).toEqual(['rule', 'rule', 'rule']);
    expect(cls(1)).toEqual(['ruleOn', 'ruleOn', 'rule']);
    expect(cls(2)).toEqual(['ruleOn', 'ruleOn', 'ruleOn']);
  });
  // 정보 전달 2 §8: 넓은 판 "RULE n · 이름 · 개수", 켜지기 전에는 개수 없음, 좁은 판은 이름 생략
  it('규칙 이름표 글자: 넓은 판은 이름 + 켜진 뒤 개수, 좁은 판은 RULE n · 개수', () => {
    const text = (st: number, w = 1080) => filterLayout(data, { w, h: 414 }, st, 0, S).labels
      .filter((l) => l.type === 'text' && /^RULE/.test(l.text)).map((l) => (l as { text: string }).text);
    expect(text(0)).toEqual(['RULE 1 · 단위 오류', 'RULE 2 · 시각 불일치', 'RULE 3 · 직항인데 오래']);
    expect(text(1)).toEqual(['RULE 1 · 단위 오류 · 5,742', 'RULE 2 · 시각 불일치 · 826', 'RULE 3 · 직항인데 오래']);
    expect(text(2)).toEqual(['RULE 1 · 단위 오류 · 5,742', 'RULE 2 · 시각 불일치 · 826', 'RULE 3 · 직항인데 오래 · 9,387']);
    expect(text(0, 358)).toEqual(['RULE 1', 'RULE 2', 'RULE 3']);
    expect(text(2, 358)).toEqual(['RULE 1 · 5,742', 'RULE 2 · 826', 'RULE 3 · 9,387']);
  });
  it('좁은 판(390px)도 이름표가 판 안', () => {
    const L = filterLayout(data, { w: 358, h: 354 }, 2, 1, S);
    for (const l of L.labels) { expect(l.x).toBeGreaterThanOrEqual(0); expect(l.x).toBeLessThanOrEqual(1); expect(l.y).toBeGreaterThanOrEqual(0); expect(l.y).toBeLessThanOrEqual(1); }
  });
  it('filter가 없으면 던진다', () => {
    expect(() => filterLayout({ dates: [] } as unknown as ChartsData, size, 0, 0, S)).toThrow();
  });
  it('남는 점은 배경 층(FILTER.keptA), 걸려 켜진 점은 FILTER.litA', () => {
    const all = [[0, 0], [1, 0], [1, 1], [2, 0], [2, 1]].map(([st, sb]) => filterLayout(data, size, st, sb, S));
    for (const L of all) for (let i = 0; i < L.n; i++) {
      if (L.alpha[i] === 0 || L.size[i] === 1.5) continue; // 숨은 점·규칙 점선
      expect(L.alpha[i]).toBeCloseTo(L.tone[i] === TONE.amber ? FILTER.litA : FILTER.keptA);
    }
  });
});
