// 이륙하는 점 비행기(설계 2026-09-29 §7, 시안 A) 순수 함수 검사: 모양(점 수·대칭·크기), 스크롤 → 진행도 p,
// 이륙 경로(정지·이륙·상승·되돌림), 흩어짐 진행, 카메라 따라가기.
import { describe, expect, it } from 'vitest';
import { K, runwayPoint, RUNWAY, toWorld } from '@/three/airport';
import { lookToward, PLANE, planeFollow, planePose, planeScatter, planeShape, runwayPhases, stepPlaneClock, takeoffProgress } from '@/three/plane';
import { handoffProgress } from '@/three/scenes';

const apply = (m: number[], v: readonly number[]) =>
  [0, 1, 2].map((r) => m[r] * v[0] + m[4 + r] * v[1] + m[8 + r] * v[2] + m[12 + r]);

describe('planeShape', () => {
  const dots = planeShape();
  it('점 232개(동체 112 + 날개·엔진·수평 꼬리 양쪽 104 + 수직 꼬리 16)', () => {
    expect(dots.length).toBe(232);
  });
  it('좌우 대칭: 점마다 v를 뒤집은 짝이 있다', () => {
    const key = (u: number, v: number, y: number) => `${u.toFixed(4)},${v.toFixed(4)},${y.toFixed(4)}`;
    const set = new Set(dots.map((d) => key(d.pos[0], d.pos[1], d.pos[2])));
    for (const d of dots) expect(set.has(key(d.pos[0], -d.pos[1] + 0, d.pos[2]))).toBe(true);
  });
  it('크기: 길이 약 75m · 날개폭 약 60m(사이트 좌표 = 미터 × K) — 활주로 폭(60m)과 비슷하다', () => {
    const us = dots.map((d) => d.pos[0]), vs = dots.map((d) => d.pos[1]);
    const len = (Math.max(...us) - Math.min(...us)) / K, span = (Math.max(...vs) - Math.min(...vs)) / K;
    expect(len).toBeGreaterThan(72);
    expect(len).toBeLessThan(78);
    expect(span).toBeGreaterThan(57);
    expect(span).toBeLessThan(63);
    expect(span / (RUNWAY.half * 2)).toBeCloseTo(1, 0);
  });
  it('색은 점 파랑(1) 또는 흰색(3), 흩어짐 지연은 0..0.52', () => {
    for (const d of dots) {
      expect([1, 3]).toContain(d.tone);
      expect(d.delay).toBeGreaterThanOrEqual(0);
      expect(d.delay).toBeLessThanOrEqual(0.52);
    }
    expect(dots.filter((d) => d.tone === 3).length).toBe(5);
  });
  it('같은 결과(시드 고정 — 대체 이미지가 매번 같다)', () => {
    expect(planeShape()).toEqual(dots);
  });
});

describe('takeoffProgress', () => {
  const y0 = 900, y1 = 2300;
  it('내려앉기(0..y0)는 시안 0..0.30, 전환(y0..y1)은 0.30..0.96, 그 뒤는 1', () => {
    expect(takeoffProgress(0, y0, y1)).toBe(0);
    expect(takeoffProgress(y0 / 2, y0, y1)).toBeCloseTo(0.15);
    expect(takeoffProgress(y0, y0, y1)).toBeCloseTo(0.3);
    expect(takeoffProgress((y0 + y1) / 2, y0, y1)).toBeCloseTo(0.63);
    expect(takeoffProgress(y1 - 1e-6, y0, y1)).toBeCloseTo(0.96);
    expect(takeoffProgress(y1 + 10, y0, y1)).toBe(1);
    expect(takeoffProgress(-50, y0, y1)).toBe(0);
  });
  it('단조 증가', () => {
    let prev = -1;
    for (let y = 0; y <= 2600; y += 7) {
      const p = takeoffProgress(y, y0, y1);
      expect(p).toBeGreaterThanOrEqual(prev);
      prev = p;
    }
  });
  it('구간이 비었거나 뒤집히면 내려앉기만(y1 없음)', () => {
    expect(takeoffProgress(450, 900, 900)).toBeCloseTo(0.15);
    expect(takeoffProgress(5000, 900, 800)).toBeCloseTo(0.3);
  });
});

describe('planePose', () => {
  const at0 = runwayPoint(0, 0);
  const threshold = toWorld(at0[0], 0, at0[1]);
  it('p = 0: 활주로 시작점에 서 있다(고도 0), 활주로 방향을 본다', () => {
    const P = planePose(0);
    expect(P.pos[0]).toBeCloseTo(threshold[0]);
    expect(P.pos[1]).toBeCloseTo(0);
    expect(P.pos[2]).toBeCloseTo(threshold[2]);
    // 앞(로컬 u = 행렬 첫 열)이 활주로 방향(사이트 좌표: x = sin, z = −cos)
    expect(P.matrix[0]).toBeCloseTo(Math.sin(RUNWAY.angle));
    expect(P.matrix[2]).toBeCloseTo(-Math.cos(RUNWAY.angle));
  });
  it('굴러가기 전(p < 0.02)에는 움직이지 않는다', () => {
    expect(planePose(0.015).pos).toEqual(planePose(0).pos);
  });
  it('이륙(p ≈ 0.19) 전 고도 0, 뒤에는 오르고 계속 높아진다', () => {
    expect(planePose(0.1).pos[1]).toBeCloseTo(0);
    expect(planePose(0.18).pos[1]).toBeCloseTo(0);
    let prev = 0;
    for (let p = 0.2; p <= 1; p += 0.02) {
      const y = planePose(p).pos[1];
      expect(y).toBeGreaterThan(prev);
      prev = y;
    }
  });
  it('활주로를 따라 멀어지는 거리 s는 단조 증가', () => {
    let prev = -1;
    for (let p = 0; p <= 1; p += 0.01) {
      const s = planePose(p).s;
      expect(s).toBeGreaterThanOrEqual(prev);
      prev = s;
    }
  });
  it('순수 함수: 되돌려도 같은 자세', () => {
    const a = planePose(0.42);
    planePose(0.9);
    planePose(0.1);
    expect(planePose(0.42)).toEqual(a);
  });
  it('행렬: 로컬 원점 = 위치, 로컬 앞 1 = 위치 + 앞 방향(단위 벡터)', () => {
    const P = planePose(0.3);
    expect(apply(P.matrix, [0, 0, 0]).map((v, i) => v - P.pos[i]).every((d) => Math.abs(d) < 1e-9)).toBe(true);
    const f = apply(P.matrix, [1, 0, 0]).map((v, i) => v - P.pos[i]);
    expect(Math.hypot(f[0], f[1], f[2])).toBeCloseTo(1);
  });
  it('출발 자리 start: 활주로를 따라 그만큼 옮기기만 한다(s·고도·방향 행렬은 그대로)', () => {
    for (const p of [0, 0.1, 0.25, 0.5, 0.9]) {
      const a = planePose(p), b = planePose(p, PLANE.portraitStart);
      expect(b.s).toBe(a.s);
      expect(b.pos[1]).toBeCloseTo(a.pos[1]);
      for (let i = 0; i < 12; i++) expect(b.matrix[i]).toBeCloseTo(a.matrix[i]);
      const d = runwayPoint(PLANE.portraitStart, 0), o = runwayPoint(0, 0);
      expect(b.pos[0] - a.pos[0]).toBeCloseTo((d[0] - o[0]) * K);
      expect(b.pos[2] - a.pos[2]).toBeCloseTo(-(d[1] - o[1]) * K);
    }
  });
  it('out 자리에 써서 돌려준다(매 프레임 새 객체를 만들지 않게) — 값은 새로 만든 것과 같다', () => {
    const out = planePose(0);
    const r = planePose(0.47, 600, out);
    expect(r).toBe(out);
    expect(r).toEqual(planePose(0.47, 600));
  });
  it('이륙 뒤 오른쪽으로 돈다(사이트 x가 활주로 직선보다 오른쪽)', () => {
    const P = planePose(0.6);
    const straight = runwayPoint(P.s, 0);
    // 사이트 좌표로 옆 거리: 활주로 오른쪽(RN = (cos, −sin)) 방향 성분
    const dx = P.pos[0] / K - straight[0], dz = -P.pos[2] / K - straight[1];
    const side = dx * Math.cos(RUNWAY.angle) - dz * Math.sin(RUNWAY.angle);
    expect(side).toBeGreaterThan(50);
  });
});

describe('planeScatter · planeFollow', () => {
  it('도착 보장: 가장 늦은 점(지연 최대)도 흩어짐이 끝날 때(uPlaneGo 1) 제자리에 닿는다 — max(delay) + dotMove ≤ 1', () => {
    const maxDelay = Math.max(...planeShape().map((d) => d.delay));
    expect(maxDelay + PLANE.dotMove).toBeLessThanOrEqual(1);
  });
  it('흩어짐: 0.26 전 0, 0.54 뒤 1, 사이 단조', () => {
    expect(planeScatter(0.2)).toBe(0);
    expect(planeScatter(0.4)).toBeCloseTo(0.5);
    expect(planeScatter(0.6)).toBe(1);
  });
  it('따라가기: 서 있을 때 0, 오르는 동안 켜지고, 지형으로 넘어가면(p ≥ 0.72) 0 — ① 카메라 C는 그대로', () => {
    expect(planeFollow(0)).toBe(0);
    expect(planeFollow(0.3)).toBe(1);
    expect(planeFollow(0.72)).toBe(0);
    expect(planeFollow(1)).toBe(0);
    expect(planeFollow(0.5)).toBeGreaterThan(0);
    expect(planeFollow(0.5)).toBeLessThan(1);
  });
});

describe('lookToward', () => {
  const cam: [number, number, number] = [0, 1, 0], tgt: [number, number, number] = [0, 0, -10];
  it('세기 0이면 목표점 그대로', () => {
    expect(lookToward(cam, tgt, [10, 5, -10], 0, 0)).toEqual(tgt);
  });
  it('방향 35%·높이 30%: 오른쪽 위 점 쪽으로 그만큼 돌아보고, 카메라~목표점 거리는 유지', () => {
    const r = lookToward(cam, tgt, [10, 1, -10], 1, 0);
    const d = [r[0] - cam[0], r[1] - cam[1], r[2] - cam[2]];
    expect(Math.hypot(...d)).toBeCloseTo(Math.hypot(0, -1, -10));
    expect(Math.atan2(d[0], -d[2])).toBeCloseTo(Math.PI / 4);
    const half = lookToward(cam, tgt, [10, 1, -10], 0.5, 0);
    expect(Math.atan2(half[0] - cam[0], -(half[2] - cam[2]))).toBeCloseTo(Math.PI / 8);
  });
  it('방향 차이는 −π..π로 감아 짧은 쪽으로 돈다', () => {
    const r = lookToward(cam, [0, 1, 10], [-1, 1, -10], 0.5, 0); // 뒤(+z)를 보다가 앞(−z) 약간 왼쪽 점
    const yaw = Math.atan2(r[0] - cam[0], -(r[2] - cam[2]));
    expect(Math.abs(Math.abs(yaw) - Math.PI / 2)).toBeLessThan(0.1);
  });
});

describe('PLANE 상수', () => {
  it('시안 단계 값', () => {
    expect(PLANE.landEnd).toBe(0.3);
    expect(PLANE.handoffEnd).toBe(0.96);
  });
});

// 비행기 시계(계획 6-6): 스크롤은 그대로 두고 이륙 연출만 최대 속도로 따라간다
describe('stepPlaneClock', () => {
  it('한 걸음에 rate × dt보다 많이 움직이지 않는다(앞으로·뒤로 모두)', () => {
    expect(stepPlaneClock(0, 1, 0.1, 0.28)).toBeCloseTo(0.028, 10);
    expect(stepPlaneClock(1, 0, 0.1, 0.28)).toBeCloseTo(0.972, 10);
  });
  it('목표가 가까우면 넘치지 않고 목표에 멈춘다', () => {
    expect(stepPlaneClock(0.5, 0.51, 0.1, 0.28)).toBe(0.51);
    expect(stepPlaneClock(0.5, 0.49, 0.1, 0.28)).toBe(0.49);
    expect(stepPlaneClock(0.3, 0.3, 0.1)).toBe(0.3);
  });
  it('dt가 0이거나 음수면 그대로', () => {
    expect(stepPlaneClock(0.2, 1, 0)).toBe(0.2);
    expect(stepPlaneClock(0.2, 1, -1)).toBe(0.2);
  });
  it('굴러가기(take0) → 지형(m1)은 60fps로 최소 2.5초 걸린다', () => {
    let p: number = PLANE.take0, frames = 0;
    while (p < PLANE.m1) { p = stepPlaneClock(p, 1, 1 / 60); frames++; }
    expect(frames / 60).toBeGreaterThanOrEqual(2.5);
    expect(frames / 60).toBeLessThan(3); // 너무 느리지도 않게(①이 올라온 뒤 공항이 한참 남지 않게)
  });
});

describe('runwayPhases', () => {
  it('스크롤로 구한 p를 넣으면 내려앉기·전환 진행도가 스크롤 계산과 같다', () => {
    const vh = 900, y0 = 0.9 * vh, y1 = 2400;
    for (let y = 0; y <= 2600; y += 37) {
      const { land, h } = runwayPhases(takeoffProgress(y, y0, y1));
      expect(land).toBeCloseTo(Math.min(1, y / y0), 6);
      expect(h).toBeCloseTo(handoffProgress(y, y0, y1), 6);
    }
  });
});
