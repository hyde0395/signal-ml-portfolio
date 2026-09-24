// 출발일 막대 계산 검사: 예측 없는 날 건너뛰기, 처음·끝, 누른 위치 → 막대 번호, 높이 비율.
import { describe, expect, it } from 'vitest';
import { barScale, dayFormat, edgeSelectable, indexFromX, nearestSelectable, stepSelectable } from '@/demo/strip';

const d = (prices: (number | null)[]) => prices.map((price) => ({ price }));

describe('stepSelectable', () => {
  it('예측 없는 날을 건너뛴다', () => {
    expect(stepSelectable(d([1, null, 3]), 0, 1)).toBe(2);
    expect(stepSelectable(d([1, null, 3]), 2, -1)).toBe(0);
  });
  it('끝에서는 제자리', () => {
    expect(stepSelectable(d([1, null, 3]), 2, 1)).toBe(2);
    expect(stepSelectable(d([1, 2]), 0, -1)).toBe(0);
  });
});

describe('edgeSelectable', () => {
  it('처음·끝 고를 수 있는 날, 없으면 -1', () => {
    expect(edgeSelectable(d([null, 2, 3, null]), 'first')).toBe(1);
    expect(edgeSelectable(d([null, 2, 3, null]), 'last')).toBe(2);
    expect(edgeSelectable(d([null, null]), 'first')).toBe(-1);
    expect(edgeSelectable(d([null, null]), 'last')).toBe(-1);
  });
});

describe('nearestSelectable', () => {
  it('가까운 쪽, 같은 거리면 앞쪽', () => {
    expect(nearestSelectable(d([1, null, null, 4]), 2)).toBe(3);
    expect(nearestSelectable(d([1, null, null, 4]), 1)).toBe(0);
    expect(nearestSelectable(d([1, null, 3]), 1)).toBe(0);
    expect(nearestSelectable(d([1, 2]), 1)).toBe(1);
  });
  it('하나도 없으면 -1', () => expect(nearestSelectable(d([null]), 0)).toBe(-1));
});

describe('indexFromX', () => {
  it('막대 폭으로 나누고 범위를 벗어나면 양 끝', () => {
    expect(indexFromX(0, 100, 10)).toBe(0);
    expect(indexFromX(99.9, 100, 10)).toBe(9);
    expect(indexFromX(150, 100, 10)).toBe(9);
    expect(indexFromX(-5, 100, 10)).toBe(0);
    expect(indexFromX(10, 0, 10)).toBe(0);
  });
});

describe('barScale', () => {
  it('최저가는 바닥 0.15, 최고가는 1', () => {
    const s = barScale([100, null, 200]);
    expect(s(100)).toBeCloseTo(0.15);
    expect(s(200)).toBe(1);
    expect(s(150)).toBeCloseTo(0.575);
  });
  it('값이 모두 같으면 가운데 높이', () => expect(barScale([5, 5])(5)).toBe(0.6));
});

describe('dayFormat', () => {
  it('같은 해 안이면 월·일(md), 해를 넘기면 연도까지(date)', () => {
    expect(dayFormat(['2026-09-25', '2026-12-21'])).toBe('md');
    expect(dayFormat(['2026-11-02', '2027-01-29'])).toBe('date');
    expect(dayFormat([])).toBe('md');
  });
});
