// 그림 판 → 3D 저장소 검사: 올린 배치를 꺼낼 수 있고, 올릴 때마다 구독자에게 알린다.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getChart, onChartsChange, publishChart, resetCharts } from '@/charts/registry';
import type { ChartEntry } from '@/charts/types';

const entry = (w: number): ChartEntry => ({
  layout: { n: 0, x: new Float32Array(), y: new Float32Array(), size: new Float32Array(), alpha: new Float32Array(), tone: new Uint8Array(), group: new Int16Array(), labels: [] },
  rect: { left: 0, top: 0, width: w, height: 100, vw: 1000, vh: 800 },
});

describe('차트 저장소', () => {
  beforeEach(() => resetCharts());
  it('올린 배치를 키로 꺼낸다, 없으면 undefined', () => {
    publishChart('chartCurve', entry(300));
    expect(getChart('chartCurve')?.rect.width).toBe(300);
    expect(getChart('chartDepart')).toBeUndefined();
  });
  it('올릴 때마다 알리고, 구독을 풀면 더 알리지 않는다', () => {
    const fn = vi.fn();
    const off = onChartsChange(fn);
    publishChart('features', entry(1));
    publishChart('features', entry(2));
    off();
    publishChart('features', entry(3));
    expect(fn).toHaveBeenCalledTimes(2);
    expect(getChart('features')?.rect.width).toBe(3);
  });
});
