// 프레임 저하 판정 검사: 평균 fps가 30 미만으로 2초 이어질 때만 느림으로 본다(한 번의 빠른 프레임에 초기화되지 않는다).
import { describe, expect, it } from 'vitest';
import { initialFrameRate, stepFrameRate, type FrameRateState } from '@/three/frameRate';

const opts = { minFps: 30, seconds: 2 };

function run(deltas: number[], start: FrameRateState = initialFrameRate()) {
  let s = start;
  let slowCount = 0;
  let firstSlowAt = -1;
  let t = 0;
  for (const d of deltas) {
    const r = stepFrameRate(s, d, opts);
    s = r.state;
    t += d;
    if (r.slow) { slowCount++; if (firstSlowAt < 0) firstSlowAt = t; }
  }
  return { s, slowCount, firstSlowAt };
}

describe('stepFrameRate', () => {
  it('60fps가 이어지면 느리지 않다', () => {
    expect(run(Array(600).fill(1 / 60)).slowCount).toBe(0);
  });
  it('20fps가 이어지면 약 2초 뒤 한 번 느림', () => {
    const r = run(Array(50).fill(1 / 20)); // 2.5초
    expect(r.slowCount).toBe(1);
    expect(r.firstSlowAt).toBeGreaterThan(2);
    expect(r.firstSlowAt).toBeLessThan(2.2);
  });
  it('느린 프레임 사이에 빠른 프레임이 섞여도(평균 약 22fps) 초기화되지 않고 느림으로 판정', () => {
    // 예전 방식(빠른 프레임 한 번에 0으로)은 이 패턴을 끝내 잡지 못했다
    const pattern: number[] = [];
    for (let i = 0; i < 60; i++) pattern.push(1 / 15, 1 / 15, 1 / 60);
    expect(run(pattern).slowCount).toBeGreaterThanOrEqual(1);
  });
  it('짧은 끊김(0.3초간 10fps) 한 번은 느림이 아니다', () => {
    const d = [...Array(120).fill(1 / 60), ...Array(3).fill(1 / 10), ...Array(300).fill(1 / 60)];
    expect(run(d).slowCount).toBe(0);
  });
  it('계속 느리면 약 2초마다 다시 알린다(1단계 → 2단계)', () => {
    expect(run(Array(90).fill(1 / 20)).slowCount).toBe(2); // 4.5초
  });
  it('1초 넘는 delta(탭 복귀)와 0은 무시한다', () => {
    const s = initialFrameRate();
    expect(stepFrameRate(s, 5, opts).state).toBe(s);
    expect(stepFrameRate(s, 0, opts).state).toBe(s);
  });
});
