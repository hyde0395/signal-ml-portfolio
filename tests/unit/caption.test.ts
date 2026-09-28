// 자막 띠 계산 검사: 글 상자가 띠로 들어오며 밝아지고, 고정되면 1, 떠나며 빨리 흐려진다.
// 문단 번호는 판이 고정된 구간을 문단 수로 나눠 정하고, 끝까지 가면 마지막 문단이다.
import { describe, expect, it } from 'vitest';
import { activeParagraph, captionOpacity } from '@/motion/caption';

describe('captionOpacity', () => {
  const vh = 1000, stick = 610;
  it('띠에 고정되면 1', () => {
    expect(captionOpacity(610, vh, stick)).toBe(1);
    expect(captionOpacity(610.4, vh, stick)).toBeCloseTo(1, 2);
  });
  it('화면 아래 끝에서는 0, 띠로 올라오며 밝아진다', () => {
    expect(captionOpacity(1000, vh, stick)).toBe(0);
    expect(captionOpacity(1200, vh, stick)).toBe(0);
    expect(captionOpacity(805, vh, stick)).toBeCloseTo(0.5, 5);
  });
  it('띠보다 위로 떠나면 화면 높이의 15% 안에 사라진다', () => {
    expect(captionOpacity(610 - 75, vh, stick)).toBeCloseTo(0.5, 5);
    expect(captionOpacity(610 - 150, vh, stick)).toBe(0);
    expect(captionOpacity(-400, vh, stick)).toBe(0);
  });
});

describe('activeParagraph', () => {
  const vh = 1000;
  it('문단이 하나면 항상 0', () => {
    expect(activeParagraph(-300, 2500, vh, 1)).toBe(0);
  });
  it('고정 구간(블록 높이 − 화면 높이)을 문단 수로 나눈다', () => {
    // 고정 구간 = 3000 − 1000 = 2000 → 문단 3개면 0~666 / 667~1333 / 1334~2000
    expect(activeParagraph(500, 3000, vh, 3)).toBe(0);   // 아직 들어오는 중
    expect(activeParagraph(-100, 3000, vh, 3)).toBe(0);
    expect(activeParagraph(-1000, 3000, vh, 3)).toBe(1);
    expect(activeParagraph(-1900, 3000, vh, 3)).toBe(2);
    expect(activeParagraph(-2600, 3000, vh, 3)).toBe(2); // 지나간 뒤에도 마지막 문단
  });
  it('블록이 화면보다 짧아도 0으로 나누지 않는다', () => {
    expect(activeParagraph(0, 800, vh, 3)).toBe(0);
  });
});
