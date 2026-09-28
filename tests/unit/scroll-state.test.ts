// 스크롤 → 상단 바·스크롤 표시 상태(설계 2026-09-28 첫 화면 다듬기 §3·§4)
import { describe, expect, it } from 'vitest';
import { INITIAL_SCROLL, nextScroll } from '@/lib/scrollState';

const run = (...ys: number[]) => ys.reduce(nextScroll, INITIAL_SCROLL);

describe('nextScroll', () => {
  it('처음은 맨 위, 스크롤 표시 켜짐', () => {
    expect(INITIAL_SCROLL).toMatchObject({ header: 'top', hint: 'on' });
  });
  it('80px 미만이면 방향과 상관없이 top', () => {
    expect(run(50).header).toBe('top');
    expect(run(70, 20).header).toBe('top');
  });
  it('아래로 내리면 hidden', () => {
    expect(run(100, 300).header).toBe('hidden');
  });
  it('위로 8px 이상 올리면 peek', () => {
    expect(run(300, 600, 592).header).toBe('peek');
  });
  it('위로 8px 미만이면 그대로 hidden — 손 떨림에 흔들리지 않게', () => {
    expect(run(300, 600, 596).header).toBe('hidden');
  });
  it('올리는 양은 누적된다', () => {
    expect(run(300, 600, 596, 592).header).toBe('peek');
  });
  it('peek 뒤 다시 내리면 hidden, 누적은 처음부터', () => {
    const s = run(300, 600, 580, 590);
    expect(s.header).toBe('hidden');
    expect(nextScroll(s, 585).header).toBe('hidden');
  });
  it('스크롤 표시: 40px 미만만 on', () => {
    expect(run(39).hint).toBe('on');
    expect(run(40).hint).toBe('off');
    expect(run(400, 10).hint).toBe('on');
  });
});
