// 활성 장면 고르기 검사: 뷰포트 중앙을 포함하는 가장 짧은 요소, 진행도, 해당 없음.
import { describe, expect, it } from 'vitest';
import { pickActive } from '@/three/activeScene';

describe('pickActive', () => {
  it('챕터가 섹션 안에 있으면 챕터가 이긴다', () => {
    const r = pickActive([
      { key: 'about', top: -2000, bottom: 2000 },
      { key: 'insight', top: 0, bottom: 800 },
    ], 800);
    expect(r).toEqual({ key: 'insight', progress: 0.5 });
  });
  it('진행도는 0~1로 자른다', () => {
    expect(pickActive([{ key: 'hero', top: 390, bottom: 1400 }], 800)?.progress).toBeCloseTo(10 / 1010, 5);
  });
  it('중앙을 포함하는 요소가 없으면 null', () => {
    expect(pickActive([{ key: 'hero', top: 500, bottom: 900 }], 800)).toBeNull();
  });
});
