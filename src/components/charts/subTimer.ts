// 그림 판의 작은 단계(sub) 타이머(계획 8-1): 한 단계 안에서 sub를 0 → count−1로 일정 간격마다 올리고 마지막에서 멈춘다.
// loopHoldMs를 주면 마지막에서 그만큼 머문 뒤 0으로 돌아가 반복한다(⑤ 검증 설계 TSS, 설계 2026-10-07 §5).
// React와 떼어 둔 순수 모듈이라 가짜 시계로 시험한다. 판이 화면 밖으로 나가면 stop, 다시 들어오면 restart(0부터).
export function startSubs(o: {
  count: number; ms: number; reduced: boolean; set(n: number): void;
  setTimeout: typeof setTimeout; clearTimeout: typeof clearTimeout;
  loopHoldMs?: number;
}): { restart(): void; stop(): void } {
  const last = Math.max(0, o.count - 1);
  let n = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const stop = () => { if (timer !== undefined) o.clearTimeout(timer); timer = undefined; };
  const tick = () => {
    n = n >= last ? 0 : n + 1;
    o.set(n);
    if (n < last) timer = o.setTimeout(tick, o.ms);
    else timer = o.loopHoldMs !== undefined ? o.setTimeout(tick, o.loopHoldMs) : undefined;
  };
  const restart = () => {
    stop();
    // 움직임 줄이기: 넘어가는 모습 없이 마지막 모습만(TSS 5/5, 걸러내기는 떨어진 뒤) — 반복도 하지 않는다
    if (o.reduced || last === 0) { n = last; o.set(n); return; }
    n = 0;
    o.set(0);
    timer = o.setTimeout(tick, o.ms);
  };
  restart();
  return { restart, stop };
}
