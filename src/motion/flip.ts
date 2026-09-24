// 플립 글자판(스펙 §4): 숫자·영문 대문자가 잠깐 뒤섞였다가 앞에서부터 차례로 최종 글자에 자리 잡는다.
// GSAP 없이 requestAnimationFrame만 써서 초기 JS에 넣어도 가볍다(데모 예측가·로딩 카운터가 바로 쓴다).
// 스크린리더에는 완성값만 읽히게 한다(스펙 §9.3): 완성값은 sr-only, 움직이는 글자는 aria-hidden.
export const FLIP = { charMs: 40, maxMs: 800 } as const;

const DIGITS = '0123456789';
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

// 글자마다 자리 잡는 시각(ms). 글자당 40ms씩 늦게, 글자가 많아 0.8초를 넘으면 간격을 줄인다
export function settleTimes(n: number): number[] {
  if (n <= 0) return [];
  const step = Math.min(FLIP.charMs, FLIP.maxMs / n);
  return Array.from({ length: n }, (_, i) => Math.round((i + 1) * step));
}

function scramble(c: string, rand: () => number): string {
  const pool = /[0-9]/.test(c) ? DIGITS : /[A-Z]/.test(c) ? LETTERS : null;
  return pool ? pool[Math.floor(rand() * pool.length)] : c;
}

export function frameAt(final: string, t: number, times: number[], rand: () => number): string {
  return [...final].map((c, i) => (t >= times[i] ? c : scramble(c, rand))).join('');
}

function reducedMotion(): boolean {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return true; }
}

// el의 내용을 final로 플립한다. 되돌리는 함수(애니메이션 취소)를 돌려준다.
export function flip(el: HTMLElement, final: string): () => void {
  const sr = document.createElement('span');
  sr.className = 'sr-only';
  sr.textContent = final;
  const vis = document.createElement('span');
  vis.setAttribute('aria-hidden', 'true');
  el.replaceChildren(sr, vis);
  if (reducedMotion()) {
    vis.textContent = final;
    return () => {};
  }
  const times = settleTimes([...final].length);
  const end = times.at(-1) ?? 0;
  const start = performance.now();
  let raf = 0;
  const tick = (now: number) => {
    const t = now - start;
    vis.textContent = frameAt(final, t, times, Math.random);
    if (t < end) raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return () => { cancelAnimationFrame(raf); vis.textContent = final; };
}
