// ② 플립 보드 연출(설계 2026-09-25 §3.2). 칸마다 위 날개(지금 글자)가 경첩에서 0→-90° 접히고, 아래 날개(다음 글자)가
// 90→0° 펴진다. 글자는 공항 보드처럼 정해진 순서로만 넘어간다.
// 이 보드만 기존 플립 규칙(글자당 40ms·0.8초·튕김 금지)의 예외다: 펴질 때 살짝 튕김(사용자 승인 2026-09-25).
// 2026-09-29 사용자 요청으로 더 느리게: 한 번 넘김 60 → 100ms, 전체 약 1.8초(칸 87개 기준 boardDurationMs 1830ms, 예전 1270ms).
// run.ts가 불러오므로 움직임 줄이기에서는 아예 실행되지 않는다(서버가 그린 완성 글자가 그대로 보인다).
export const SEQ = ' ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789,.-⇄';
// 빈칸부터 모두 넘기면 숫자 칸이 40번 가까이 넘어가 5초를 넘긴다(시안 실측). 14번으로 잘라 약 1.8초
// budgetMs: 메인 스레드가 느리면(3D 렌더링과 겹침 등) Web Animations의 .finished가 선언한 duration보다
// 오래 걸려 칸마다 순서대로 기다리는 시간이 눈덩이처럼 불어난다. 보드 시작 이후 이 시간을 넘기면 남은 칸은
// 애니메이션 없이 바로 완성 글자로 건너뛰어, 느린 환경에서도 전체 연출이 일정 시간 안에 끝나게 한다.
// flipMs를 늘릴 때 같은 비율로 함께 늘린다(2500 → 4200) — 안 그러면 정상 속도에서도 끝부분이 잘린다
export const BOARD = { flipMs: 100, maxFlips: 14, staggerMs: 5, budgetMs: 4200 } as const;

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
  try {
    // 취소되면 .finished가 AbortError로 reject된다. 콘솔 에러 없이 조용히 돌아간다
    await h.fold.animate(
      [{ transform: 'rotateX(0deg)', filter: 'brightness(1)' }, { transform: 'rotateX(-90deg)', filter: 'brightness(.45)' }],
      { duration: half, easing: 'ease-in', fill: 'forwards' },
    ).finished;
    await h.unfold.animate(
      [{ transform: 'rotateX(90deg)', filter: 'brightness(.6)' }, { transform: 'rotateX(0deg)', filter: 'brightness(1)' }],
      { duration: half, easing: 'cubic-bezier(.3,1.5,.6,1)', fill: 'forwards' }, // 살짝 튕김(이 보드만 허용)
    ).finished;
    write(h.bot, next);
  } catch (e) {
    // 취소 시 AbortError가 throw되므로 묵시적으로 반환 (reset()이 완성 글자를 이미 썼으므로 덮어쓰지 않는다).
    // 다른 에러는 위로 올려 보낸다
    const err = e as DOMException | unknown;
    if (err instanceof DOMException && err.name === 'AbortError') return;
    throw e;
  }
}

const flapsOf = (board: HTMLElement) => [...board.querySelectorAll<HTMLElement>('.flap')];

// 연출 준비: 칸마다 출발 글자로 돌려 둔다. 화면에 들어오기 전에 불러야 완성 글자 → 출발 글자로 튀는 게 안 보인다
export function prepareBoard(board: HTMLElement): void {
  for (const f of flapsOf(board)) reset(halves(f), flipPath(f.dataset.c ?? ' ')[0]);
}

// 정리(teardown) 전용: 칸을 최종(완성) 글자로 되돌린다. animateBoard가 돌려주는 취소 함수도 같은 일을
// 하지만, 그건 화면에 들어와 애니메이션을 실제로 시작한 보드에만 존재한다. prepareBoard로 출발 글자를
// 깔아만 두고 아직 화면에 들어오지 않은 보드는 그 취소 함수가 없어, run.ts가 정리될 때 출발 글자에
// 그대로 멈춰 있었다(최종 리뷰 #7). 애니메이션을 시작하지 않고 값만 되돌리므로 비용이 거의 없다
export function finalizeBoard(board: HTMLElement): void {
  for (const f of flapsOf(board)) reset(halves(f), f.dataset.c ?? ' ');
}

// 글자를 넘긴다. 되돌리는 함수(취소 → 완성 글자)를 돌려준다
export function animateBoard(board: HTMLElement): () => void {
  let cancelled = false;
  const timers: number[] = [];
  const flaps = flapsOf(board);
  const start = performance.now(); // 보드 전체 기준 시작 시각(칸마다 다른 stagger 지연과 무관하게 예산을 잰다)
  flaps.forEach((f, i) => {
    const path = flipPath(f.dataset.c ?? ' ');
    const h = halves(f);
    timers.push(window.setTimeout(async () => {
      for (let k = 1; k < path.length && !cancelled; k++) {
        if (performance.now() - start > BOARD.budgetMs) { reset(h, path.at(-1)!); break; } // 예산 초과: 바로 완성값
        await flipOnce(h, path[k - 1], path[k]);
      }
    }, i * BOARD.staggerMs));
  });
  return () => {
    cancelled = true;
    timers.forEach((t) => window.clearTimeout(t));
    for (const f of flaps) reset(halves(f), f.dataset.c ?? ' ');
  };
}
