// 활성 장면 고르기 검사: 뷰포트 중앙을 포함하는 가장 짧은 요소, 진행도, 해당 없음.
import { describe, expect, it } from 'vitest';
import { pickActive, readCandidates } from '@/three/activeScene';

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

describe('readCandidates', () => {
  // DOM 없이 querySelectorAll·getBoundingClientRect만 흉내 낸다(vitest 환경이 node)
  const el = (scene: string, top: number, bottom: number) => ({ dataset: { scene }, getBoundingClientRect: () => ({ top, bottom }) });
  const doc = (els: unknown[], seen: string[] = []) => ({
    querySelectorAll: (sel: string) => { seen.push(sel); return els; },
  }) as unknown as Document;

  it('data-scene 요소를 후보로 읽는다', () => {
    const seen: string[] = [];
    expect(readCandidates(doc([el('about', 0, 900), el('insight', 100, 500)], seen))).toEqual([
      { key: 'about', top: 0, bottom: 900 },
      { key: 'insight', top: 100, bottom: 500 },
    ]);
    expect(seen).toEqual(['[data-scene]']);
  });

  it('장면 표에 없는 이름은 버린다', () => {
    expect(readCandidates(doc([el('bogus', 0, 900)]))).toEqual([]);
  });
});
