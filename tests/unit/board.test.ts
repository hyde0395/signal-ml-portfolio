// 플립 보드 글자 순서 검사: 정해진 순서로만 한 칸씩 넘어가고, 최대 횟수를 넘지 않으며, 전체 약 2초 안에 끝난다(2026-09-29 느리게 한 뒤 약 1.8초).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { animateBoard, BOARD, boardDurationMs, flipPath, SEQ } from '@/motion/board';

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

// 프레임이 거의 안 그려지는 환경(소프트웨어 3D가 GPU를 붙잡은 CI·저사양 기기)에서는 날개 애니메이션의 .finished가
// 몇 초씩 끝나지 않는다. 예산 검사를 넘김 사이에만 하면 끝나지 않는 넘김 하나에 막혀 보드가 중간 글자에 멈춰 있었다.
// DOM 없이(vitest node 환경) 보드에 필요한 만큼만 흉내 낸다: animate()의 .finished는 cancel() 전까지 끝나지 않는다
describe('animateBoard 예산', () => {
  type Half = { firstElementChild: { textContent: string }; anims: { cancel: () => void }[]; animate: () => unknown; getAnimations: () => { cancel: () => void }[] };
  const half = (): Half => {
    const h: Half = {
      firstElementChild: { textContent: '' }, anims: [],
      animate() {
        let reject!: (e: unknown) => void;
        const finished = new Promise((_, r) => { reject = r; });
        finished.catch(() => {});
        const a = { finished, cancel: () => { reject(new DOMException('cancel', 'AbortError')); h.anims = h.anims.filter((x) => x !== a); } };
        h.anims.push(a);
        return a;
      },
      getAnimations: () => [...h.anims],
    };
    return h;
  };
  const flap = (c: string) => {
    const hs = [half(), half(), half(), half()];
    return { dataset: { c }, hs, querySelectorAll: () => hs };
  };
  beforeEach(() => { vi.useFakeTimers(); vi.stubGlobal('window', globalThis); });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it('넘김이 끝나지 않아도 예산 시간이 지나면 모든 칸이 완성 글자다', async () => {
    const flaps = ['I', 'C', 'N', '9'].map(flap);
    const board = { querySelectorAll: () => flaps } as unknown as HTMLElement;
    animateBoard(board);
    await vi.advanceTimersByTimeAsync(BOARD.budgetMs + 50);
    // [top, bot, fold, unfold] 중 정지한 아래 반쪽(bot)이 완성 글자인지 본다
    for (const f of flaps) expect(f.hs[1].firstElementChild.textContent).toBe(f.dataset.c);
    for (const f of flaps) for (const h of f.hs) expect(h.anims).toHaveLength(0);
  });
});
