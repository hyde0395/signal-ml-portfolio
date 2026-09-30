// ⑤ 검증 설계 배치(계획 8-1): 방식마다 평가 점, TSS sub마다 평가 구간이 밀려 감, 첫 이름표 5개는 수치, 점 개수 불변
import { describe, expect, it } from 'vitest';
import type { ChartsData } from '@/charts/data';
import { SPLIT, splitLayout, splitRole } from '@/charts/split';
import { TONE } from '@/charts/types';

// 수집 0~5일 × 출발일 3개. kf: 가운데 폴드 2, gkf: 폴드 0, tss: −1, 0..4
const split = {
  fetch: [0, 1, 2, 3, 4, 5], date: [0, 1, 2, 0, 1, 2],
  kf: [0, 1, 2, 2, 3, 4], gkf: [0, 1, 0, 2, 3, 0], tss: [-1, 0, 1, 2, 3, 4],
  fetchDays: 6, show: { kf: 2, gkf: 0 },
};
const data = { asOf: '2026-09-22', dates: ['2026-10-01', '2026-11-01', '2027-01-15'], split } as unknown as ChartsData;
const m = (name: string) => ({ name, r2: 'R² 0.6', mae: 'MAE 1원', tag: name.toLowerCase() });
const S = { month: (iso: string) => iso.slice(5, 7), axisX: '수집일', axisY: '출발일', legend: ['학습', '평가', '아직 안 씀'] as [string, string, string], methods: [m('K-FOLD'), m('GROUPKFOLD'), m('TIMESERIESSPLIT')] as const };
const size = { w: 1080, h: 414 };

describe('splitRole', () => {
  it('K-Fold는 show.kf 폴드가 평가, GroupKFold는 show.gkf', () => {
    expect([0, 1, 2, 3, 4, 5].map((i) => splitRole(split, i, 0, 0))).toEqual([0, 0, 1, 1, 0, 0]);
    expect([0, 1, 2, 3, 4, 5].map((i) => splitRole(split, i, 1, 0))).toEqual([1, 0, 1, 0, 0, 1]);
  });
  it('TSS sub k: 폴드 k 평가, 앞(−1 포함)은 학습, 뒤는 아직 안 씀', () => {
    expect([0, 1, 2, 3, 4, 5].map((i) => splitRole(split, i, 2, 0))).toEqual([0, 1, 2, 2, 2, 2]);
    expect([0, 1, 2, 3, 4, 5].map((i) => splitRole(split, i, 2, 4))).toEqual([0, 0, 0, 0, 0, 1]);
  });
});

describe('splitLayout', () => {
  const all = [[0, 0], [1, 0], [2, 0], [2, 2], [2, 4]].map(([st, sb]) => splitLayout(data, size, st, sb, S));
  it('점 개수가 같고 좌표는 판 안, variant는 단계·sub', () => {
    expect(new Set(all.map((l) => l.n)).size).toBe(1);
    expect(all.map((l) => l.variant)).toEqual(['stage:0:0', 'stage:1:0', 'stage:2:0', 'stage:2:2', 'stage:2:4']);
    for (const L of all) for (let i = 0; i < L.n; i++) {
      expect(L.x[i]).toBeGreaterThanOrEqual(0); expect(L.x[i]).toBeLessThanOrEqual(1);
      expect(L.y[i]).toBeGreaterThanOrEqual(0); expect(L.y[i]).toBeLessThanOrEqual(1);
    }
  });
  it('평가 점은 호박색, 아직 안 씀은 흐림, 점 자리는 단계와 무관', () => {
    const [kf, , tss0] = all;
    expect(Array.from(kf.tone)).toEqual([TONE.dot, TONE.dot, TONE.amber, TONE.amber, TONE.dot, TONE.dot]);
    expect(tss0.alpha[5]).toBeLessThan(kf.alpha[5]);
    expect(Array.from(tss0.x)).toEqual(Array.from(kf.x));
    expect(Array.from(tss0.y)).toEqual(Array.from(kf.y));
  });
  it('가로 = 수집일(늦을수록 오른쪽), 세로 = 출발일(늦을수록 위), group = 출발일 번호', () => {
    const L = all[0];
    expect(L.x[5]).toBeGreaterThan(L.x[0]);
    expect(L.y[2]).toBeLessThan(L.y[0]);
    expect(Array.from(L.group)).toEqual(split.date);
  });
  it('앞 이름표 5개는 방식 이름·R²·MAE·설명·폴드 — TSS에서만 폴드 글자', () => {
    const head = (L: ReturnType<typeof splitLayout>) => L.labels.slice(0, 5).map((l) => (l.type === 'text' ? l.text : ''));
    expect(head(all[0])).toEqual(['K-FOLD', 'R² 0.6', 'MAE 1원', 'k-fold', '']);
    expect(head(all[4])[4]).toBe('FOLD 5 / 5');
    expect(head(all[3])[4]).toBe('FOLD 3 / 5');
    expect(all[0].labels[1]).toMatchObject({ cls: 'stat' });
  });
  it('범례 셋째(아직 안 씀)는 TSS에서만 글자가 있다', () => {
    const dim = (L: ReturnType<typeof splitLayout>) => L.labels.find((l) => l.type === 'text' && l.cls === 'keyDim');
    expect(dim(all[0])).toMatchObject({ text: '' });
    expect(dim(all[2])).toMatchObject({ text: '아직 안 씀' });
  });
  it('좁은 판도 이름표가 판 안, split이 없으면 던진다', () => {
    const L = splitLayout(data, { w: 358, h: 354 }, 2, 4, S);
    for (const l of L.labels) { expect(l.x).toBeGreaterThanOrEqual(0); expect(l.x).toBeLessThanOrEqual(1); expect(l.y).toBeGreaterThanOrEqual(0); expect(l.y).toBeLessThanOrEqual(1); }
    expect(() => splitLayout({ dates: [] } as unknown as ChartsData, size, 0, 0, S)).toThrow();
  });
  it('좁은 판: 세로축 이름이 수치 줄(설명·FOLD)과 범례 사이에 따로 있다', () => {
    const L = splitLayout(data, { w: 358, h: 354 }, 2, 4, S);
    const y = (pred: (l: ReturnType<typeof splitLayout>['labels'][number]) => boolean) => L.labels.find(pred)!.y * 354;
    const tag = y((l) => l.type === 'text' && l.cls === 'note');
    const axisY = y((l) => l.type === 'text' && l.text === '출발일');
    const legend = y((l) => l.type === 'text' && l.cls === 'keyDot');
    expect(axisY - tag).toBeGreaterThanOrEqual(14);
    expect(axisY - legend).toBeGreaterThanOrEqual(14);
  });
  it('SPLIT 상수: TSS 단계만 sub 5개', () => expect(SPLIT.subs).toEqual([1, 1, 5]));
});
