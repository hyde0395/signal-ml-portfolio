// 스크롤 연출 시작/정리. GSAP·ScrollTrigger·Lenis를 이 파일에만 모아, Motion.tsx가 첫 그리기 뒤 import()로
// 불러온다(초기 JS 150KB 유지). 움직임 줄이기에서는 이 파일을 아예 불러오지 않는다.
// - Lenis: 부드러운 스크롤. 브라우저 기본 스크롤을 움직이므로 3D 카메라(scroll 이벤트)는 그대로 따라온다
// - [data-reveal] 제목: 단어 단위로 아래에서 떠오름(0.9초, 단어당 60ms, expo.out = cubic-bezier(.16,1,.3,1))
// - [data-flip-on-enter] GATE 제목: 화면에 들어오면 한 번 플립
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { flip } from './flip';
import { splitWords } from './words';

const ENTER = 'top 85%'; // 요소 윗변이 화면 85% 높이에 닿을 때 — 완전히 보이기 조금 전에 시작해 늦어 보이지 않게

function wrapWords(el: HTMLElement): HTMLElement[] {
  const inners: HTMLElement[] = [];
  const parts = splitWords(el.textContent ?? '');
  el.replaceChildren(...parts.map((part) => {
    if (/^\s+$/.test(part)) return document.createTextNode(part);
    const outer = document.createElement('span');
    outer.className = 'reveal-word';
    const inner = document.createElement('span');
    inner.textContent = part;
    outer.append(inner);
    inners.push(inner);
    return outer;
  }));
  return inners;
}

export function startMotion(doc: Document): () => void {
  gsap.registerPlugin(ScrollTrigger);
  // anchors는 끈다: 페이지 안 링크는 건너뛰기 링크(#main) 하나뿐인데, Lenis가 가로채 부드럽게 옮기면 브라우저 기본
  // 점프와 겹쳐 목적지에 닿지 못했다(900px에서 누르면 885px에 멈춤). 기본 점프는 즉시 옮기고 포커스 시작점도 옮기며,
  // Lenis는 그 네이티브 스크롤을 받아 자기 위치를 맞춘다(프로그램 스크롤·키보드 스크롤도 같은 길).
  const lenis = new Lenis({ autoRaf: false, anchors: false });
  const raf = (time: number) => lenis.raf(time * 1000);
  gsap.ticker.add(raf);
  gsap.ticker.lagSmoothing(0);
  lenis.on('scroll', ScrollTrigger.update);

  const cancels: (() => void)[] = [];
  const ctx = gsap.context(() => {
    doc.querySelectorAll<HTMLElement>('[data-reveal]').forEach((el) => {
      gsap.from(wrapWords(el), {
        yPercent: 110, opacity: 0, duration: 0.9, stagger: 0.06, ease: 'expo.out',
        scrollTrigger: { trigger: el, start: ENTER, once: true },
      });
    });
    doc.querySelectorAll<HTMLElement>('[data-flip-on-enter]').forEach((el) => {
      const text = el.textContent ?? '';
      ScrollTrigger.create({ trigger: el, start: ENTER, once: true, onEnter: () => cancels.push(flip(el, text)) });
    });
  });

  return () => {
    cancels.forEach((c) => c());
    ctx.revert();
    gsap.ticker.remove(raf);
    lenis.destroy();
  };
}
