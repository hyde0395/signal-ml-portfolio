'use client';
// 스크롤을 듣고 <html data-header data-hint>만 바꾼다. 상단 바·스크롤 표시의 모양은 CSS가 맡는다
// (설계 2026-09-28 첫 화면 다듬기 §3·§4). data-header 속성이 없으면(JS 전·없음) CSS는 맨 위 상태로 보여 준다.
// data-hint는 반대다 — JS가 맨 위임을 확인해야("on") 보이므로 속성이 없으면 숨는다(globals.css 참고).
import { useEffect } from 'react';
import { INITIAL_SCROLL, nextScroll } from '@/lib/scrollState';

export function ScrollState() {
  useEffect(() => {
    const html = document.documentElement;
    let s = INITIAL_SCROLL;
    let raf = 0;
    const apply = () => {
      raf = 0;
      s = nextScroll(s, window.scrollY);
      if (html.dataset.header !== s.header) html.dataset.header = s.header;
      if (html.dataset.hint !== s.hint) html.dataset.hint = s.hint;
    };
    // 한 프레임에 한 번만 계산한다(스크롤 이벤트는 프레임보다 자주 온다)
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(apply); };
    apply();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
      delete html.dataset.header;
      delete html.dataset.hint;
    };
  }, []);
  return null;
}
