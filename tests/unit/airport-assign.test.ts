// 배정 검사: 불빛마다 서로 다른 점 하나, 신호 점부터(모자라면 잡음), 배정 안 된 점은 스타일 알파 0,
// 활주로 거리(runS)와 켜지는 순서가 그 점의 속성으로 들어간다.
import { describe, expect, it } from 'vitest';
import type { AirLight } from '@/three/airport';
import { assignAirport } from '@/three/airportAssign';

const light = (i: number, runS = -1): AirLight => ({ pos: [i, i, i], tone: 3, size: 1, ord: 0.5, runS, kind: 'edge' });

describe('assignAirport', () => {
  const kind = Float32Array.from([1, 0, 2, 0, 1, 0]); // 신호 점: 1, 3, 5
  it('신호 점부터 차례로, 서로 다른 점', () => {
    const r = assignAirport([light(0, 10), light(1), light(2)], kind);
    const used = [1, 3, 5];
    for (const [j, i] of used.entries()) {
      expect(Array.from(r.pos.slice(i * 3, i * 3 + 3))).toEqual([j, j, j]);
      expect(r.style[i * 4]).toBe(1); // 알파(= 공항 불빛)
    }
    expect(r.runS[1]).toBe(10);
    expect(r.runS[3]).toBe(-1);
  });
  it('신호가 모자라면 잡음 점, 제거 레이어(kind 2)는 쓰지 않는다', () => {
    const r = assignAirport([light(0), light(1), light(2), light(3), light(4)], kind);
    const lit = [0, 1, 2, 3, 4, 5].filter((i) => r.style[i * 4] === 1);
    expect(lit).toEqual([0, 1, 3, 4, 5]);
    expect(r.style[2 * 4]).toBe(0);
  });
  it('불빛이 점보다 많으면 남는 불빛은 버리고 개수를 알려 준다', () => {
    const r = assignAirport(Array.from({ length: 9 }, (_, i) => light(i)), kind);
    expect(r.assigned).toBe(5);
  });
});
