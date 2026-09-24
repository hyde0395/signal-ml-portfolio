// 리빌용 단어 나누기: 공백 기준으로 나누되 공백은 보존한다(다시 이어 붙이면 원문과 같다).
import { describe, expect, it } from 'vitest';
import { splitWords } from '@/motion/words';

describe('splitWords', () => {
  it('단어와 공백을 번갈아 보존', () => {
    expect(splitWords('한·일 항공권, 언제 사야 할까?')).toEqual(['한·일', ' ', '항공권,', ' ', '언제', ' ', '사야', ' ', '할까?']);
  });
  it('이어 붙이면 원문', () => {
    const s = '  Buy now  or wait? ';
    expect(splitWords(s).join('')).toBe(s);
  });
  it('공백 없는 일본어는 한 덩어리', () => expect(splitWords('今買う?')).toEqual(['今買う?']));
});
