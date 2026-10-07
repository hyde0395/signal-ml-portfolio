// 작은 단계 타이머(계획 8-1): 간격마다 +1, 마지막에서 멈춤, 움직임 줄이기면 바로 마지막, 다시 시작하면 0부터
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startSubs } from '@/components/charts/subTimer';

describe('startSubs', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());
  const make = (count: number, reduced = false, loopHoldMs?: number) => {
    const seen: number[] = [];
    const t = startSubs({ count, ms: 1000, reduced, set: (n) => seen.push(n), setTimeout, clearTimeout, loopHoldMs });
    return { t, seen };
  };
  it('0에서 시작해 1초마다 +1, 마지막(4)에서 멈춘다', () => {
    const { seen } = make(5);
    expect(seen).toEqual([0]);
    vi.advanceTimersByTime(10_000);
    expect(seen).toEqual([0, 1, 2, 3, 4]);
  });
  it('움직임 줄이기면 곧바로 마지막, 타이머 없음', () => {
    const { seen } = make(5, true);
    vi.advanceTimersByTime(10_000);
    expect(seen).toEqual([4]);
  });
  it('작은 단계가 하나면 0만', () => {
    const { seen } = make(1);
    vi.advanceTimersByTime(5000);
    expect(seen).toEqual([0]);
  });
  it('stop하면 멈추고 restart하면 0부터 다시', () => {
    const { t, seen } = make(5);
    vi.advanceTimersByTime(2000);
    t.stop();
    vi.advanceTimersByTime(5000);
    expect(seen).toEqual([0, 1, 2]);
    t.restart();
    vi.advanceTimersByTime(1000);
    expect(seen).toEqual([0, 1, 2, 0, 1]);
  });
  it('loopHoldMs를 주면 마지막에서 그만큼 머문 뒤 0으로 돌아가 다시 올라간다', () => {
    const { seen } = make(3, false, 2500);
    vi.advanceTimersByTime(2000);
    expect(seen).toEqual([0, 1, 2]);
    vi.advanceTimersByTime(2499);
    expect(seen).toEqual([0, 1, 2]);
    vi.advanceTimersByTime(1);
    expect(seen).toEqual([0, 1, 2, 0]);
    vi.advanceTimersByTime(2000);
    expect(seen).toEqual([0, 1, 2, 0, 1, 2]);
  });
  it('머무는 중에 restart하면 0부터 한 줄로 다시(타이머가 겹치지 않는다)', () => {
    const { t, seen } = make(3, false, 2500);
    vi.advanceTimersByTime(3000); // 2에서 머무는 중
    t.restart();
    vi.advanceTimersByTime(2000);
    expect(seen).toEqual([0, 1, 2, 0, 1, 2]);
    vi.advanceTimersByTime(2499);
    expect(seen).toEqual([0, 1, 2, 0, 1, 2]);
  });
  it('반복 중 stop하면 멈춘다', () => {
    const { t, seen } = make(3, false, 2500);
    vi.advanceTimersByTime(3000);
    t.stop();
    vi.advanceTimersByTime(20_000);
    expect(seen).toEqual([0, 1, 2]);
  });
  it('움직임 줄이기면 loopHoldMs가 있어도 마지막에 머문다', () => {
    const { seen } = make(5, true, 2500);
    vi.advanceTimersByTime(20_000);
    expect(seen).toEqual([4]);
  });
});
