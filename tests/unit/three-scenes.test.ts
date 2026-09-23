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
  it('예약 곡선은 3-2(insight)에서만 보인다', () => {
    for (const k of KEYS) expect(SCENES[k].curve).toBe(k === 'insight' ? 1 : 0);
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
    // problem·insight도 ×1.6 규칙은 그대로 적용된다(세로 화면 카메라는 PORTRAIT_OVERRIDE의 camera·target을
    // 기준으로 스케일된다). 다만 오버라이드는 target도 가로 화면과 달라져 거리 비교가 복잡해지므로,
    // 오버라이드가 없어 camera·target이 동일한 키(hero)로 일반 규칙만 검사한다.
    const land = sceneFor('hero', 0, false), port = sceneFor('hero', 0, true);
    const dist = (s: typeof land) => Math.hypot(...s.camera.map((v, i) => v - s.target[i]));
    expect(dist(port) / dist(land)).toBeCloseTo(1.6, 5);
  });
  it('세로 화면 insight 카메라는 곡선(z=10.5)에서 30~42 거리(예전 약 54는 곡선이 안 보였다)', () => {
    const s = sceneFor('insight', 0, true);
    const d = Math.hypot(...s.camera.map((v, i) => v - [3.1, 0, 10.5][i]));
    expect(d).toBeGreaterThan(30);
    expect(d).toBeLessThan(42);
  });
  it('problem은 세로 화면에서 목표점(target)이 가운데로 되돌아가고, insight는 곡선 쪽으로 옮긴다', () => {
    // 데스크톱은 왼쪽 글 카드를 피해 x를 -4.5로 밀지만, 세로 화면은 카드가 아래에 있어 밀 필요가 없다
    expect(sceneFor('problem', 0, true).target).toEqual([0, 0, 0]);
    expect(sceneFor('insight', 0, true).target).toEqual([3.1, -3.5, 10.5]); // 곡선 한가운데, 곡선이 화면 위쪽에 오도록 낮춤
    expect(sceneFor('problem', 0, false).target).toEqual([-4.5, 0, 0]);
  });
});
