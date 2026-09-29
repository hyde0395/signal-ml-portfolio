// 플립 보드 글자 순서 검사: 정해진 순서로만 한 칸씩 넘어가고, 최대 횟수를 넘지 않으며, 전체 약 2초 안에 끝난다(2026-09-29 느리게 한 뒤 약 1.8초).
import { describe, expect, it } from 'vitest';
import { BOARD, boardDurationMs, flipPath, SEQ } from '@/motion/board';

describe('flipPath', () => {
  it('빈칸이면 넘기지 않는다', () => expect(flipPath(' ')).toEqual([' ']));
  it('가까운 글자는 빈칸부터 순서대로', () => expect(flipPath('C')).toEqual([' ', 'A', 'B', 'C']));
  it('먼 글자는 최대 횟수 앞에서 출발한다', () => {
    const p = flipPath('9');
    expect(p).toHaveLength(BOARD.maxFlips + 1);
    expect(p.at(-1)).toBe('9');
  });
  it('이어지는 두 글자는 순서표에서 바로 옆이다', () => {
    for (const target of ['⇄', ',', 'Y', '0']) {
      const p = flipPath(target);
      for (let i = 1; i < p.length; i++) expect(SEQ.indexOf(p[i])).toBe(SEQ.indexOf(p[i - 1]) + 1);
    }
  });
  it('순서표에 없는 글자는 그대로 둔다', () => expect(flipPath('→')).toEqual(['→']));
});

describe('boardDurationMs', () => {
  it('칸 100개여도 2초 안(프레임 여유 빼고)', () => expect(boardDurationMs(100)).toBeLessThanOrEqual(2000));
  // 사용자 요청(2026-09-29): 예전(60ms)보다 1.5배 이상 느리게
  it('한 번 넘김은 90ms 이상', () => expect(BOARD.flipMs).toBeGreaterThanOrEqual(90));
  // 예산이 정상 속도의 연출을 자르지 않게 — 이론값보다 넉넉히 길어야 한다
  it('예산은 칸 100개 이론값의 2배 이상', () => expect(BOARD.budgetMs).toBeGreaterThanOrEqual(boardDurationMs(100) * 2));
});
