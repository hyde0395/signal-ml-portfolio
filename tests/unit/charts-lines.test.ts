// 선·별 도우미 검사: 별은 빛 번짐 + 심 두 점, 꺾은선 경로, 3D에서만 선이 늦게 나타난다
import { describe, expect, it } from 'vitest';
import { addStar, LINE, linePath, linesDelay, STAR } from '@/charts/lines';
import { Pts } from '@/charts/layouts';
import { TONE } from '@/charts/types';

describe('addStar', () => {
  it('같은 자리에 빛 번짐(크고 옅게)을 먼저, 심을 나중에 — 심이 위에 그려진다', () => {
    const p = new Pts();
    addStar(p, 0.5, 0.25, 4, TONE.text, 1, 7, 3);
    const L = p.done([], TONE.text, 1);
    expect(L.n).toBe(2);
    expect([L.x[0], L.y[0], L.x[1], L.y[1]]).toEqual([0.5, 0.25, 0.5, 0.25]);
    expect(L.size[0]).toBeCloseTo(4 * STAR.haloScale);
    expect(L.alpha[0]).toBeCloseTo(STAR.haloAlpha);
    expect(L.size[1]).toBe(4);
    expect(L.alpha[1]).toBe(1);
    expect([L.group[0], L.hl[0], L.group[1], L.hl[1]]).toEqual([7, 3, 7, 3]);
  });
});

describe('linePath', () => {
  it('정규화 좌표를 판 px로 바꿔 M·L 경로를 만든다(소수 한 자리)', () => {
    expect(linePath([0, 0, 0.5, 1, 1, 0.25], 200, 100)).toBe('M0 0L100 100L200 25');
  });
  it('점이 둘보다 적으면 빈 경로', () => {
    expect(linePath([0.2, 0.3], 200, 100)).toBe('');
    expect(linePath([], 200, 100)).toBe('');
  });
});

describe('linesDelay', () => {
  it('3D가 켜져 있으면 점이 자리 잡을 시간만큼 기다리고, 2D·움직임 줄이기는 바로', () => {
    expect(linesDelay(true, false)).toBe(LINE.delay3dMs);
    expect(linesDelay(false, false)).toBe(0);
    expect(linesDelay(true, true)).toBe(0);
  });
});
