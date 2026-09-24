'use client';
// 스크롤 연출(run.ts)을 첫 그리기 뒤 한가할 때 불러온다. 움직임 줄이기면 아무것도 불러오지 않는다.
import { useEffect } from 'react';

export function Motion() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let stop: (() => void) | undefined;
    let cancelled = false;
    const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 300));
    idle(() => {
      import('@/motion/run').then((m) => { if (!cancelled) stop = m.startMotion(document); }).catch((e) => console.warn('연출 없이 진행', e));
    });
    return () => { cancelled = true; stop?.(); };
  }, []);
  return null;
}
