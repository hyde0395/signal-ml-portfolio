// 점 스타일 상수와 거리 흐림(설계 2026-09-28 첫 화면 다듬기 §2.2)
import { describe, expect, it } from 'vitest';
import { DEPTH_FADE, FIELD_POINT, fieldAlpha, MAP_POINT, POINT, depthFade, glslFloat } from '@/three/pointStyle';

describe('depthFade', () => {
  it('장면 목표점 거리에서는 기준값', () => {
    expect(depthFade(22.2, 22.2)).toBeCloseTo(DEPTH_FADE.base, 5);
  });
  it('가까울수록 밝아지되 1을 넘지 않는다', () => {
    expect(depthFade(5, 22.2)).toBe(1);
    expect(depthFade(20, 22.2)).toBeGreaterThan(DEPTH_FADE.base);
  });
  it('멀수록 흐려지되 최소값 아래로 내려가지 않는다', () => {
    expect(depthFade(30, 22.2)).toBeLessThan(DEPTH_FADE.base);
    expect(depthFade(80, 22.2)).toBe(DEPTH_FADE.min);
  });
  it('목표점 거리 기준이라 멀리 물러난 장면도 가까운 쪽은 기준값 이상', () => {
    expect(depthFade(33, 34)).toBeGreaterThanOrEqual(DEPTH_FADE.base);
  });
});

describe('POINT', () => {
  it('시안 D 값', () => {
    expect(POINT).toEqual({ signalAlpha: 0.8, noiseAlpha: 0.117, signalSize: 0.9, noiseSize: 0.6 });
  });
});

describe('MAP_POINT', () => {
  it('지도 장면 값(설계 2026-09-29 §1)', () => {
    expect(MAP_POINT).toEqual({ coastAlpha: 0.8, routeAlpha: 0.9, size: 0.55 });
  });
});

describe('glslFloat', () => {
  it('항상 소수점이 있는 GLSL float 글자', () => {
    expect(glslFloat(1)).toBe('1.000');
    expect(glslFloat(0.117)).toBe('0.117');
    expect(glslFloat(18)).toBe('18.000');
  });
});

describe('fieldAlpha(잡음 밭, 계획 9-3)', () => {
  it('가까운 점일수록 밝고, 가라앉으면 30% 어두워진다', () => {
    expect(fieldAlpha(1, 1, 0)).toBeGreaterThan(fieldAlpha(0, 1, 0));
    expect(fieldAlpha(1, 1, 0)).toBeCloseTo(FIELD_POINT.alphaMin + FIELD_POINT.alphaAdd);
    expect(fieldAlpha(0.5, 1, 1) / fieldAlpha(0.5, 1, 0)).toBeCloseTo(0.7);
  });
  it('가장 밝은 점도 0.6을 넘지 않는다(글 뒤 대비 — 글자 번짐과 함께 지킨다)', () => {
    expect(fieldAlpha(1, 1, 0)).toBeLessThanOrEqual(0.6);
  });
});
