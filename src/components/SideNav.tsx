'use client';
// 옆 목차(설계 2026-09-25 §2.1): 데스크톱 왼쪽 가장자리에 섹션 번호를 세로로 두고, 화면 가운데를 지나는 섹션을 호박색으로
// 표시한다. 번호와 이름은 섹션 목록(sections.ts)에서 만든다 — 섹션을 더하면 목차도 저절로 늘어난다.
// 휴대폰에서는 CSS로 숨긴다(메뉴 버튼 없음 결정 유지). 이동은 브라우저 기본 앵커 점프(Lenis anchors: false와 같은 길).
import { useEffect, useRef, useState } from 'react';
import { SECTIONS, sectionNumber, type SectionId } from '@/lib/sections';

export function SideNav({ label }: { label: string }) {
  const [active, setActive] = useState<SectionId | null>(null);
  // 목차로 옮겨 간 섹션. 사용자가 직접 스크롤하기 전까지만 기억한다
  const jumped = useRef<HTMLElement | null>(null);
  useEffect(() => {
    // 3D 판정(pending → on)이나 프레임 저하(on → off)로 <html data-3d>가 바뀌면 .chapter 높이(min-height 100vh)가 한꺼번에
    // 바뀐다. 목차로 막 옮겨 간 섹션 자신의 높이도 바뀌어 브라우저의 스크롤 고정(scroll anchoring)이 꺼지므로,
    // 로딩 직후 목차를 누르면 판정이 끝나는 순간 목적지가 460px쯤 아래로 밀려나 한 섹션 앞에 멈춰 있었다.
    // 사용자가 그사이 스스로 움직이지 않았다면 목적지로 다시 맞춘다
    const forget = () => { jumped.current = null; };
    const mo = new MutationObserver(() => {
      const el = jumped.current;
      if (el) requestAnimationFrame(() => { if (jumped.current === el) el.scrollIntoView({ block: 'start' }); });
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-3d'] });
    const opts = { passive: true } as const;
    window.addEventListener('wheel', forget, opts);
    window.addEventListener('touchstart', forget, opts);
    window.addEventListener('keydown', forget);
    return () => {
      mo.disconnect();
      window.removeEventListener('wheel', forget);
      window.removeEventListener('touchstart', forget);
      window.removeEventListener('keydown', forget);
    };
  }, []);
  useEffect(() => {
    // 화면 세로 가운데 한 줄에 걸친 섹션만 "보는 중"으로 친다(rootMargin으로 위아래 절반씩 깎음)
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const id = e.target.id as SectionId;
        setActive((cur) => (e.isIntersecting ? id : cur === id ? null : cur));
      }
    }, { rootMargin: '-50% 0px -50% 0px' });
    for (const s of SECTIONS) {
      const el = document.getElementById(s.id);
      if (el) io.observe(el);
    }
    return () => io.disconnect();
  }, []);
  return (
    <nav className="side-nav" aria-label={label}>
      <ol>
        {SECTIONS.map((s) => (
          <li key={s.id}>
            <a href={`#${s.id}`} onClick={() => { jumped.current = document.getElementById(s.id); }} aria-current={active === s.id ? 'true' : undefined} aria-label={`${sectionNumber(s.id)} ${s.label}`}>
              {sectionNumber(s.id)}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
