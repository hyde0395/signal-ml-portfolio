// 배정 검사: 불빛마다 서로 다른 점 하나, 신호 점부터(모자라면 잡음), 배정 안 된 점은 스타일 알파 0,
// 활주로 거리(runS)와 켜지는 순서가 그 점의 속성으로 들어간다.
import { describe, expect, it } from 'vitest';
import type { AirLight } from '@/three/airport';
import { assignAirport } from '@/three/airportAssign';
import { planeShape } from '@/three/plane';

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
  // 이륙 비행기(설계 2026-09-29 §7): 첫 화면에서 숨은 신호 점 중 몇 개를 비행기 점으로(aAirStyle.x = 2).
  // 신호 점 전체에 고르게 흩어 뽑는다 — ①에서 물결 줄 전체로 퍼져 들어가게(시안: 비행기 몫 칸을 격자 전체에 고르게)
  const dot = (i: number) => ({ pos: [i, -i, i * 2] as [number, number, number], tone: 3, delay: 0.1 * i });
  it('비행기 점: 신호 점에 고르게, 표시 2·색·지연·로컬 좌표, 불빛과 겹치지 않는다', () => {
    const k = Float32Array.from([0, 0, 0, 0, 0, 0, 0, 0, 1, 1]); // 신호 8개
    const r = assignAirport([light(0), light(1), light(2)], k, [dot(0), dot(1)]);
    expect(r.plane).toBe(2);
    const planeIdx = [...Array(10).keys()].filter((i) => r.style[i * 4] === 2);
    expect(planeIdx).toEqual([2, 6]); // 8개를 둘로 나눈 칸의 가운데(어느 점이 어느 칸에 갈지는 섞는다)
    const at1 = planeIdx.find((i) => r.pos[i * 3] === 1)!;
    expect(Array.from(r.pos.slice(at1 * 3, at1 * 3 + 3))).toEqual([1, -1, 2]);
    expect(r.style[at1 * 4 + 1]).toBe(3);
    expect(r.style[at1 * 4 + 3]).toBeCloseTo(0.1);
    expect(r.runS[at1]).toBe(-1);
    const lit = [...Array(10).keys()].filter((i) => r.style[i * 4] === 1);
    expect(lit).toEqual([0, 1, 3]); // 불빛은 비행기 점을 건너뛰고 신호 점부터
  });
  it('비행기 점은 칸을 섞어 짝짓는다: 동체 앞쪽 점이 신호 점 순서의 한쪽 절반에 몰리지 않는다(시드 고정)', () => {
    const shape = planeShape();
    const k = new Float32Array(2070); // 신호 점 2,070개(실제 데이터와 같은 수)
    const r = assignAirport([], k, shape);
    const a = assignAirport([], k, shape);
    expect(Array.from(r.style)).toEqual(Array.from(a.style));
    const front = [...Array(k.length).keys()].filter((i) => r.style[i * 4] === 2 && r.pos[i * 3] > 0);
    const early = front.filter((i) => i < k.length / 2).length / front.length;
    expect(front.length).toBeGreaterThan(40);
    expect(early).toBeGreaterThan(0.3);
    expect(early).toBeLessThan(0.7);
  });
  it('비행기 점이 없으면 예전과 같다', () => {
    const a = assignAirport([light(0), light(1)], kind), b = assignAirport([light(0), light(1)], kind, []);
    expect(b).toEqual(a);
    expect(a.plane).toBe(0);
  });
});

