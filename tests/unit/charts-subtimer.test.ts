// 작은 단계 타이머(계획 8-1): 간격마다 +1, 마지막에서 멈춤, 움직임 줄이기면 바로 마지막, 다시 시작하면 0부터
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startSubs } from '@/components/charts/subTimer';

describe('startSubs', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());
  const make = (count: number, reduced = false) => {
    const seen: number[] = [];
    const t = startSubs({ count, ms: 1000, reduced, set: (n) => seen.push(n), setTimeout, clearTimeout });
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
});
