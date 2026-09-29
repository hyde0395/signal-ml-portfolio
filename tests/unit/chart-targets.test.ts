// 판 → 3D 좌표 변환 검사: 화면 가운데는 원점, 모서리는 시야 끝. 점 배정은 출발일 점 우선·중복 없음·제거 레이어 제외.
// 슬롯 버퍼는 쓰는 점만 차트 자리·모양을 받고, 나머지는 지형 자리에서 알파 0.
import { describe, expect, it } from 'vitest';
import type { ChartEntry } from '@/charts/types';
import { assignPoints, chartShiftY, screenToWorld, slotBuffers } from '@/three/chartTargets';

const HALF_H = 24 * Math.tan((40 * Math.PI) / 360);

describe('screenToWorld', () => {
  it('화면 가운데 = 원점, 왼쪽 위 = (-halfW, +halfH)', () => {
    expect(screenToWorld(500, 400, 1000, 800, 24, 40)).toEqual([0, 0]);
    const [x, y] = screenToWorld(0, 0, 1000, 800, 24, 40);
    expect(y).toBeCloseTo(HALF_H, 6);
    expect(x).toBeCloseTo(-HALF_H * (1000 / 800), 6);
  });
});

describe('assignPoints', () => {
  // 점 구름: 출발일 0 두 개, 출발일 1 한 개, 제거 레이어(kind 2, 출발일 0) 한 개, 출발일 2 한 개
  const date = Int16Array.from([0, 0, 1, 0, 2]);
  const kind = Float32Array.from([0, 1, 0, 2, 1]);
  it('group이 있으면 그 출발일 점부터, 모자라면 남은 점을 앞에서부터, 제거 레이어는 출발일 원에 안 쓴다', () => {
    const a = assignPoints(Int16Array.from([1, 1, 0]), 3, date, kind);
    expect(a[0]).toBe(2);             // 출발일 1의 유일한 점
    expect([0, 1]).toContain(a[1]);   // 출발일 1이 떨어져 남은 점 중 앞 번호
    expect(a[2]).not.toBe(3);         // 제거 레이어 점은 출발일 0 원에 쓰지 않는다
    expect(new Set(Array.from(a)).size).toBe(3);
  });
  it('점 구름보다 배치가 많으면 남는 배치 점은 -1', () => {
    const a = assignPoints(new Int16Array(7).fill(-1), 7, date, kind);
    expect(Array.from(a).filter((v) => v >= 0)).toHaveLength(5);
    expect(a[6]).toBe(-1);
  });
});

describe('slotBuffers', () => {
  const entry: ChartEntry = {
    layout: {
      n: 1, x: Float32Array.from([0.5]), y: Float32Array.from([0.5]), size: Float32Array.from([4]),
      alpha: Float32Array.from([0.8]), tone: Uint8Array.from([2]), group: Int16Array.from([-1]), hl: Int16Array.from([-1]), focusTone: 2, focusDim: 0.25, labels: [],
    },
    rect: { left: 250, top: 200, width: 500, height: 400, vw: 1000, vh: 800 },
  };
  const terrain = Float32Array.from([1, 2, 3, 4, 5, 6]);
  const { pos, style } = slotBuffers(entry, Int32Array.from([1]), terrain, 24, 40);
  it('배정된 점은 판 가운데(= 화면 가운데 = 원점), 모양은 배치 값', () => {
    expect(Array.from(pos.slice(3, 6))).toEqual([0, 0, 0]);
    expect(Array.from(style.slice(3, 6)).map((v) => +v.toFixed(3))).toEqual([0.8, 2, 4]);
  });
  it('안 쓰는 점은 지형 자리에 알파 0', () => {
    expect(Array.from(pos.slice(0, 3))).toEqual([1, 2, 3]);
    expect(style[0]).toBe(0);
  });

  it('강조 번호는 쓰는 점에만, 나머지는 -1', () => {
    const e: ChartEntry = { ...entry, layout: { ...entry.layout, hl: Int16Array.from([3]) } };
    const { hl } = slotBuffers(e, Int32Array.from([1]), terrain, 24, 40);
    expect(Array.from(hl)).toEqual([-1, 3]); // 점 구름 2개 중 1번 점만 배치에 쓰였다
  });
});

describe('chartShiftY', () => {
  it('판이 고정(top 0)이면 0, 판이 화면 맨 위보다 아래에 있으면 음수(점도 아래로)', () => {
    expect(chartShiftY(0, 800, 24, 40)).toBe(0);
    expect(chartShiftY(200, 800, 24, 40)).toBeLessThan(0);
    expect(chartShiftY(-200, 800, 24, 40)).toBeGreaterThan(0);
  });
  it('판이 화면 한 높이만큼 내려가 있으면 시야 높이(halfH×2)만큼 내려간다', () => {
    expect(chartShiftY(800, 800, 24, 40)).toBeCloseTo(-HALF_H * 2, 6);
  });
});
