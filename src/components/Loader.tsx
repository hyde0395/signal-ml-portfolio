'use client';
// 로딩 화면(스펙 §3-0, §8.1): 최대 1.2초의 고정 연출이며 실제 로딩과 무관하다. 서버 HTML에 들어 있고
// CSS 애니메이션만으로 사라지므로 JS가 늦거나 실패해도 화면을 막지 않는다. 숫자 플립만 여기서 얹는다.
// 같은 세션 재방문·움직임 줄이기·캡처 모드·JS 없음에서는 부트 스크립트/noscript가 숨긴다(src/lib/boot.ts).
import { useEffect, useRef } from 'react';
import { flip } from '@/motion/flip';

export function Loader({ rows }: { rows: string }) {
  const count = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!count.current || document.documentElement.classList.contains('no-loader')) return;
    return flip(count.current, rows);
  }, [rows]);
  return (
    <div className="loader" aria-hidden="true">
      <p>LOADING <span data-count ref={count}>{rows}</span> ROWS</p>
    </div>
  );
}
