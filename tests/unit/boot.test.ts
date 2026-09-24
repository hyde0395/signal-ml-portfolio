// 부트 스크립트 검사: 실제로 <head>에 들어가는 문자열(BOOT_SCRIPT)을 가짜 window로 실행해 본다.
import { describe, expect, it, vi } from 'vitest';
import { BOOT_SCRIPT, PENDING_TIMEOUT_MS } from '@/lib/boot';

function fakeWindow({ reduced = false, search = '', visited = false, storageThrows = false } = {}) {
  const attrs = new Map<string, string>();
  const classes = new Set<string>();
  const store = new Map<string, string>(visited ? [['signal.loaded', '1']] : []);
  const timers: (() => void)[] = [];
  const win = {
    document: { documentElement: {
      setAttribute: (k: string, v: string) => attrs.set(k, v),
      getAttribute: (k: string) => attrs.get(k) ?? null,
      classList: { add: (c: string) => classes.add(c) },
    } },
    matchMedia: () => ({ matches: reduced }),
    location: { search },
    sessionStorage: {
      getItem: (k: string) => { if (storageThrows) throw new Error('blocked'); return store.get(k) ?? null; },
      setItem: (k: string, v: string) => { store.set(k, v); },
    },
    setTimeout: (fn: () => void, ms: number) => { expect(ms).toBe(PENDING_TIMEOUT_MS); timers.push(fn); },
  };
  new Function('window', BOOT_SCRIPT)(win);
  return { attrs, classes, store, runTimers: () => timers.forEach((f) => f()) };
}

describe('BOOT_SCRIPT', () => {
  it('처음 방문: 로딩 화면을 보이고 방문 표시, 3D 판정 대기', () => {
    const w = fakeWindow();
    expect(w.classes.has('no-loader')).toBe(false);
    expect(w.store.get('signal.loaded')).toBe('1');
    expect(w.attrs.get('data-3d')).toBe('pending');
  });
  it('같은 세션 재방문이면 로딩 화면 생략', () => {
    expect(fakeWindow({ visited: true }).classes.has('no-loader')).toBe(true);
  });
  it('움직임 줄이기: 로딩 화면 생략, 판정 대기 없음(대체 이미지가 곧바로 보인다)', () => {
    const w = fakeWindow({ reduced: true });
    expect(w.classes.has('no-loader')).toBe(true);
    expect(w.attrs.has('data-3d')).toBe(false);
  });
  it('캡처 모드(?capture=)에서는 로딩 화면 생략', () => {
    expect(fakeWindow({ search: '?capture=hero' }).classes.has('no-loader')).toBe(true);
  });
  it('판정이 끝나지 않으면 제한 시간 뒤 off(대체 화면)', () => {
    const w = fakeWindow();
    w.runTimers();
    expect(w.attrs.get('data-3d')).toBe('off');
  });
  it('이미 on이 됐으면 제한 시간이 지나도 그대로', () => {
    const w = fakeWindow();
    w.attrs.set('data-3d', 'on');
    w.runTimers();
    expect(w.attrs.get('data-3d')).toBe('on');
  });
  it('저장소가 막혀 있어도 멈추지 않고 로딩 화면만 생략', () => {
    const w = fakeWindow({ storageThrows: true });
    expect(w.classes.has('no-loader')).toBe(true);
    expect(w.attrs.get('data-3d')).toBe('pending');
  });
});
