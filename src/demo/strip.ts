// 출발일 막대의 순수 계산: 고를 수 있는 날(예측이 있는 날)만 오가기, 누른 위치 → 막대 번호, 막대 높이.
// 예측이 없는 날은 키보드로 이동할 때도 건너뛴다(스펙 §6.4).
type Day = { price: number | null };
const selectable = (d: Day | undefined) => d !== undefined && d.price !== null;

// dir 방향의 다음 고를 수 있는 날. 없으면 제자리(끝에서 더 가지 않는다)
export function stepSelectable(days: Day[], from: number, dir: 1 | -1): number {
  for (let i = from + dir; i >= 0 && i < days.length; i += dir) if (selectable(days[i])) return i;
  return from;
}

export function edgeSelectable(days: Day[], edge: 'first' | 'last'): number {
  if (edge === 'first') return days.findIndex(selectable);
  for (let i = days.length - 1; i >= 0; i--) if (selectable(days[i])) return i;
  return -1;
}

// 예측 없는 날을 누르거나 노선을 바꿔 고른 날이 비었을 때, 가장 가까운 고를 수 있는 날(같은 거리면 앞쪽)
export function nearestSelectable(days: Day[], i: number): number {
  for (let r = 0; r < days.length; r++) {
    if (selectable(days[i - r])) return i - r;
    if (selectable(days[i + r])) return i + r;
  }
  return -1;
}

export function indexFromX(x: number, width: number, n: number): number {
  if (n <= 0 || width <= 0) return 0;
  return Math.min(n - 1, Math.max(0, Math.floor((x / width) * n)));
}

// 막대 높이(0..1). 가장 싼 날도 막대가 보이도록 바닥을 0.15로 둔다
const FLOOR = 0.15;
export function barScale(prices: (number | null)[]): (p: number) => number {
  const vals = prices.filter((p): p is number => p !== null);
  if (vals.length === 0) return () => FLOOR;
  const min = Math.min(...vals), max = Math.max(...vals);
  if (max === min) return () => 0.6;
  return (p) => FLOOR + ((1 - FLOOR) * (p - min)) / (max - min);
}
