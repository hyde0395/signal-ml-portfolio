// 3D 가능 여부 검사: 스펙 §9.1의 대체 화면 조건.
import { describe, expect, it } from 'vitest';
import { canRender3D, detectEnv, parseCapture } from '@/three/capability';

const base = { reducedMotion: false, webgl: true, deviceMemory: 8, forced: false };

describe('canRender3D', () => {
  it('기본 환경은 3D', () => expect(canRender3D(base)).toBe(true));
  it('움직임 줄이기 → 대체 화면', () => expect(canRender3D({ ...base, reducedMotion: true })).toBe(false));
  it('WebGL 없음 → 대체 화면', () => expect(canRender3D({ ...base, webgl: false })).toBe(false));
  it('메모리 2GB 이하 → 대체 화면', () => expect(canRender3D({ ...base, deviceMemory: 2 })).toBe(false));
  it('deviceMemory를 모르면(사파리 등) 3D', () => expect(canRender3D({ ...base, deviceMemory: undefined })).toBe(true));
  it('캡처 모드는 움직임 줄이기여도 3D (WebGL은 있어야 함)', () => {
    expect(canRender3D({ ...base, reducedMotion: true, forced: true })).toBe(true);
    expect(canRender3D({ ...base, webgl: false, forced: true })).toBe(false);
  });
});

describe('detectEnv', () => {
  it('matchMedia 실패 시 안전 쪽으로 기울인다 (reducedMotion: true)', () => {
    const fakeWin = {
      matchMedia: () => { throw new Error('matchMedia not available'); },
      document: { createElement: () => ({ getContext: () => null }) },
      navigator: {},
      location: { search: '?capture=hero' },
    } as unknown as Window;
    const env = detectEnv(fakeWin);
    expect(env.reducedMotion).toBe(true);
    expect(env.webgl).toBe(false);
    expect(env.forced).toBe(true);
  });
});

describe('parseCapture', () => {
  it('대체 이미지가 있는 다섯 장면만 받는다', () => {
    for (const k of ['hero', 'problem', 'insight', 'bubble', 'interval']) expect(parseCapture(`?capture=${k}`)).toBe(k);
  });
  it('모르는 값·빈 값·없음은 null', () => {
    expect(parseCapture('?capture=bogus')).toBeNull();
    expect(parseCapture('?capture=')).toBeNull();
    expect(parseCapture('?capture=contact')).toBeNull(); // 장면 표에는 있지만 대체 이미지가 없는 장면
    expect(parseCapture('')).toBeNull();
  });
  it('틀린 capture 값은 움직임 줄이기를 건너뛰지 못한다(forced = false)', () => {
    const fakeWin = {
      matchMedia: () => ({ matches: true }),
      document: { createElement: () => ({ getContext: () => ({}) }) },
      navigator: {},
      location: { search: '?capture=bogus' },
    } as unknown as Window;
    const env = detectEnv(fakeWin);
    expect(env.forced).toBe(false);
    expect(canRender3D(env)).toBe(false);
  });
});
