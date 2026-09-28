// 스크롤 위치 → 상단 바 상태(top·hidden·peek)와 첫 화면 스크롤 표시(on·off)를 정하는 순수 함수
// (설계 2026-09-28 첫 화면 다듬기 §3·§4). 브라우저 없이 단위 테스트하려고 컴포넌트와 나눴다.

export type HeaderMode = 'top' | 'hidden' | 'peek';
export type ScrollSnapshot = { header: HeaderMode; hint: 'on' | 'off'; lastY: number; upAcc: number };

const TOP_Y = 80; // 이보다 위면 상단 바 전부(SIGNAL 포함)
const HINT_Y = 40; // 이보다 위면 SCROLL 표시
// 위로 이만큼은 올려야 다시 보인다 — 트랙패드 관성·손 떨림으로 1~2px 되돌아갈 때마다 깜빡이지 않게
const PEEK_UP = 8;

export const INITIAL_SCROLL: ScrollSnapshot = { header: 'top', hint: 'on', lastY: 0, upAcc: 0 };

export function nextScroll(prev: ScrollSnapshot, y: number): ScrollSnapshot {
  const hint = y < HINT_Y ? 'on' : 'off';
  if (y < TOP_Y) return { header: 'top', hint, lastY: y, upAcc: 0 };
  const dy = y - prev.lastY;
  if (dy > 0) return { header: 'hidden', hint, lastY: y, upAcc: 0 };
  const upAcc = prev.upAcc - dy;
  // 여기 오면 prev.header는 'hidden' 아니면 'peek'뿐이다 — 'top'이면 prev.lastY < 80이라 dy > 0이 되어 위에서 이미 'hidden'으로 반환됐다
  const header = upAcc >= PEEK_UP ? 'peek' : prev.header;
  return { header, hint, lastY: y, upAcc };
}
