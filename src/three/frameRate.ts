// 프레임 저하 판정(스펙 §8.3/§9.1 "30fps 미만 2초 지속"). React·three와 무관한 순수 함수라 단위 테스트한다.
// 왜 지수 이동 평균(EMA): 예전에는 빠른 프레임이 한 번만 끼어도 누적 시간이 0으로 돌아가, 느렸다 빨랐다
// 들쭉날쭉한 기기(평균 20fps대)에서는 영원히 판정이 안 났다. 프레임 시간을 평활해 평균 fps로 본다.

export type FrameRateState = { avg: number; slowFor: number };

export const FRAME_EMA_ALPHA = 0.1;

export function initialFrameRate(): FrameRateState {
  return { avg: 0, slowFor: 0 };
}

// delta(초) 하나를 반영한다. 평균 fps(1/avg)가 minFps 미만인 채로 seconds초가 이어지면 slow = true를 한 번
// 돌려주고, 누적 시간만 0으로 되돌린다(평균은 유지 → 계속 느리면 다시 seconds초 뒤 다음 단계로 간다).
export function stepFrameRate(
  s: FrameRateState,
  delta: number,
  opts: { minFps: number; seconds: number; alpha?: number },
): { state: FrameRateState; slow: boolean } {
  // 탭 복귀 직후의 큰 delta나 0/음수는 평균을 망가뜨리므로 무시한다
  if (!(delta > 0) || delta > 1) return { state: s, slow: false };
  const alpha = opts.alpha ?? FRAME_EMA_ALPHA;
  const avg = s.avg === 0 ? delta : s.avg + alpha * (delta - s.avg);
  const slowFor = 1 / avg < opts.minFps ? s.slowFor + delta : 0;
  if (slowFor > opts.seconds) return { state: { avg, slowFor: 0 }, slow: true };
  return { state: { avg, slowFor }, slow: false };
}
