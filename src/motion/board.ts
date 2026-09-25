// ② 플립 보드 연출(설계 2026-09-25 §3.2). 칸마다 위 날개(지금 글자)가 경첩에서 0→-90° 접히고, 아래 날개(다음 글자)가
// 90→0° 펴진다. 글자는 공항 보드처럼 정해진 순서로만 넘어간다.
// 이 보드만 기존 플립 규칙(글자당 40ms·0.8초·튕김 금지)의 예외다: 전체 약 2초, 펴질 때 살짝 튕김(사용자 승인 2026-09-25).
// run.ts가 불러오므로 움직임 줄이기에서는 아예 실행되지 않는다(서버가 그린 완성 글자가 그대로 보인다).
export const SEQ = ' ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789,.-⇄';
// 빈칸부터 모두 넘기면 숫자 칸이 40번 가까이 넘어가 5초를 넘긴다(시안 실측). 14번으로 잘라 약 2초
export const BOARD = { flipMs: 60, maxFlips: 14, staggerMs: 5 } as const;

export function flipPath(target: string, maxFlips: number = BOARD.maxFlips): string[] {
  const to = SEQ.indexOf(target);
  if (to < 0) return [target];
  return [...SEQ.slice(Math.max(0, to - maxFlips), to + 1)];
}

// 이론상 걸리는 시간(가장 늦게 시작하는 칸이 최대 횟수를 넘길 때). 실제로는 프레임 경계만큼 조금 더 걸린다
export function boardDurationMs(cells: number): number {
  return BOARD.maxFlips * BOARD.flipMs + BOARD.staggerMs * Math.max(0, cells - 1);
}

type Halves = { top: HTMLElement; bot: HTMLElement; fold: HTMLElement; unfold: HTMLElement };

function halves(flap: HTMLElement): Halves {
  const [top, bot, fold, unfold] = flap.querySelectorAll<HTMLElement>(':scope > .flap-half');
  return { top, bot, fold, unfold };
}

function write(h: HTMLElement, c: string) { h.firstElementChild!.textContent = c; }

function reset(h: Halves, c: string) {
  // 지난번 날개 애니메이션을 지우면 CSS 기본값(fold 0°, unfold 90° = 숨김)으로 돌아간다
  h.fold.getAnimations().forEach((a) => a.cancel());
  h.unfold.getAnimations().forEach((a) => a.cancel());
  for (const x of [h.top, h.bot, h.fold, h.unfold]) write(x, c);
}

async function flipOnce(h: Halves, cur: string, next: string) {
  h.fold.getAnimations().forEach((a) => a.cancel());
  h.unfold.getAnimations().forEach((a) => a.cancel());
  write(h.top, next); write(h.bot, cur); write(h.fold, cur); write(h.unfold, next);
  const half = BOARD.flipMs / 2;
  await h.fold.animate(
    [{ transform: 'rotateX(0deg)', filter: 'brightness(1)' }, { transform: 'rotateX(-90deg)', filter: 'brightness(.45)' }],
    { duration: half, easing: 'ease-in', fill: 'forwards' },
  ).finished;
  await h.unfold.animate(
    [{ transform: 'rotateX(90deg)', filter: 'brightness(.6)' }, { transform: 'rotateX(0deg)', filter: 'brightness(1)' }],
    { duration: half, easing: 'cubic-bezier(.3,1.5,.6,1)', fill: 'forwards' }, // 살짝 튕김(이 보드만 허용)
  ).finished;
  write(h.bot, next);
}

const flapsOf = (board: HTMLElement) => [...board.querySelectorAll<HTMLElement>('.flap')];

// 연출 준비: 칸마다 출발 글자로 돌려 둔다. 화면에 들어오기 전에 불러야 완성 글자 → 출발 글자로 튀는 게 안 보인다
export function prepareBoard(board: HTMLElement): void {
  for (const f of flapsOf(board)) reset(halves(f), flipPath(f.dataset.c ?? ' ')[0]);
}

// 글자를 넘긴다. 되돌리는 함수(취소 → 완성 글자)를 돌려준다
export function animateBoard(board: HTMLElement): () => void {
  let cancelled = false;
  const timers: number[] = [];
  const flaps = flapsOf(board);
  flaps.forEach((f, i) => {
    const path = flipPath(f.dataset.c ?? ' ');
    const h = halves(f);
    timers.push(window.setTimeout(async () => {
      for (let k = 1; k < path.length && !cancelled; k++) await flipOnce(h, path[k - 1], path[k]);
    }, i * BOARD.staggerMs));
  });
  return () => {
    cancelled = true;
    timers.forEach((t) => window.clearTimeout(t));
    for (const f of flaps) reset(halves(f), f.dataset.c ?? ' ');
  };
}
