// 장면 표 검사: 모든 키 존재, 3-1은 지도, 3-3은 진행도에 따라 떨어짐, 세로 화면은 카메라가 더 멀다.
import { describe, expect, it } from 'vitest';
import { SCENES, sceneFor, type SceneKey } from '@/three/scenes';

const KEYS: SceneKey[] = ['hero', 'about', 'problem', 'insight', 'bubble', 'validation', 'interval', 'limits', 'stack', 'contact'];

describe('SCENES', () => {
  it('모든 섹션·챕터 키가 있다', () => expect(Object.keys(SCENES).sort()).toEqual([...KEYS].sort()));
  it('3-1(problem)만 지도 장면', () => {
    for (const k of KEYS) expect(SCENES[k].map).toBe(k === 'problem' ? 1 : 0);
  });
  it('제거 레이어는 3-3(bubble)에서만 보인다', () => {
    for (const k of KEYS) expect(SCENES[k].removed).toBe(k === 'bubble' ? 1 : 0);
  });
});

describe('sceneFor', () => {
  it('bubble은 챕터 진행도로 drop이 0→1', () => {
    expect(sceneFor('bubble', 0, false).drop).toBe(0);
    expect(sceneFor('bubble', 1, false).drop).toBe(1);
    expect(sceneFor('bubble', 0.5, false).drop).toBeGreaterThan(0);
  });
  it('다른 장면은 drop 0', () => expect(sceneFor('insight', 0.9, false).drop).toBe(0));
  it('세로 화면은 카메라가 목표점에서 1.6배 멀다', () => {
    const land = sceneFor('insight', 0, false), port = sceneFor('insight', 0, true);
    const dist = (s: typeof land) => Math.hypot(...s.camera.map((v, i) => v - s.target[i]));
    expect(dist(port) / dist(land)).toBeCloseTo(1.6, 5);
  });
});
