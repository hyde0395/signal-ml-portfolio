// 3D 가능 여부 검사: 스펙 §9.1의 대체 화면 조건.
import { describe, expect, it } from 'vitest';
import { canRender3D } from '@/three/capability';

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
