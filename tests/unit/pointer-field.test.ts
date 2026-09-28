// 배경 점 밀기·물결(설계 2026-09-25 §4.1, 계획 5-3a). 셰이더와 같은 식을 순수 함수로 검사한다
import { describe, expect, it } from 'vitest';
import { PUSH, RIPPLE, pushAmount, rippleAmount, toNdc } from '@/three/pointerField';

describe('pushAmount', () => {
  it('포인터 바로 위에서 가장 세고 반경 밖은 0', () => {
    expect(pushAmount(0)).toBeCloseTo(PUSH.strength, 6);
    expect(pushAmount(PUSH.radius)).toBe(0);
    expect(pushAmount(PUSH.radius * 2)).toBe(0);
  });
  it('멀어질수록 줄어든다', () => {
    expect(pushAmount(PUSH.radius * 0.25)).toBeGreaterThan(pushAmount(PUSH.radius * 0.5));
    expect(pushAmount(PUSH.radius * 0.5)).toBeGreaterThan(pushAmount(PUSH.radius * 0.75));
  });
  it('이동량은 반경보다 작다 — 점이 포인터를 넘어 반대편으로 튀지 않는다', () => {
    for (let d = 0; d <= PUSH.radius; d += PUSH.radius / 20) expect(pushAmount(d)).toBeLessThan(PUSH.radius);
  });
});

describe('rippleAmount', () => {
  it('고리 위(거리 = 속도 × 경과)에서 가장 세다', () => {
    const age = 0.3;
    const ring = RIPPLE.speed * age;
    expect(rippleAmount(ring, age)).toBeGreaterThan(rippleAmount(ring + RIPPLE.width, age));
    expect(rippleAmount(ring, age)).toBeGreaterThan(rippleAmount(ring - RIPPLE.width, age));
  });
  it('시간이 지나면 사라진다', () => {
    expect(rippleAmount(RIPPLE.speed * RIPPLE.life, RIPPLE.life)).toBe(0);
    expect(rippleAmount(0.1, -1)).toBe(0); // 물결이 없을 때(음수 경과)
  });
});

describe('toNdc', () => {
  it('화면 px → NDC(y는 위가 +)', () => {
    expect(toNdc(0, 0, 800, 600)).toEqual([-1, 1]);
    expect(toNdc(800, 600, 800, 600)).toEqual([1, -1]);
    expect(toNdc(400, 300, 800, 600)).toEqual([0, 0]);
  });
});
