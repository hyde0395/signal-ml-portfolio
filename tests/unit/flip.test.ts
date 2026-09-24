// 플립 글자판의 순수 계산: 글자별 자리 잡는 시각(글자당 40ms, 전체 0.8초 이내)과 중간 프레임.
import { describe, expect, it } from 'vitest';
import { FLIP, frameAt, settleTimes } from '@/motion/flip';

describe('settleTimes', () => {
  it('글자당 40ms씩 늦게 자리 잡는다', () => {
    expect(settleTimes(3)).toEqual([40, 80, 120]);
  });
  it('글자가 많으면 간격을 줄여 전체가 0.8초를 넘지 않는다', () => {
    const t = settleTimes(40);
    expect(t.at(-1)).toBeLessThanOrEqual(FLIP.maxMs);
    expect(t[1] - t[0]).toBeLessThan(FLIP.charMs);
  });
  it('빈 문자열', () => expect(settleTimes(0)).toEqual([]));
});

describe('frameAt', () => {
  const zero = () => 0; // 무작위 자리를 늘 첫 후보로
  it('자리 잡은 글자는 최종 글자, 아직이면 같은 종류의 다른 글자', () => {
    expect(frameAt('A1', 50, [40, 80], zero)).toBe('A0');
    expect(frameAt('A1', 100, [40, 80], zero)).toBe('A1');
  });
  it('숫자·영문 대문자만 섞고 나머지(쉼표·공백·한글·기호)는 그대로', () => {
    expect(frameAt('9,4 원₩', 0, [10, 10, 10, 10, 10, 10], zero)).toBe('0,0 원₩');
  });
});
