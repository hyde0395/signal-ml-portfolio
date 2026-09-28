// 자막 띠(설계 2026-09-28 §2): 그림 판 블록의 글 상자는 CSS sticky로 판 아래 띠에 고정된다. 여기서는 스크롤마다
// 글 상자의 투명도(띠로 들어오며 밝아지고, 떠나며 사라짐)와 지금 보일 문단 번호를 계산해 적용한다.
// 의존성이 없다 — 서버 컴포넌트가 정적으로 부르는 클라이언트 파일(Captions.tsx)이 불러 초기 JS에 들어간다.

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
// 떠날 때는 들어올 때보다 빨리 사라진다 — 판이 먼저 올라간 뒤 글이 위로 따라 올라가며 판 자리를 지나기 때문이다
const LEAVE_FRACTION = 0.15;

// copyTop: 글 상자의 지금 화면 위치(px), stickTop: 고정될 위치(px, CSS top을 풀어 쓴 값)
export function captionOpacity(copyTop: number, vh: number, stickTop: number): number {
  if (copyTop >= stickTop) {
    const range = vh - stickTop;
    return range <= 0 ? 1 : clamp01(1 - (copyTop - stickTop) / range);
  }
  return clamp01(1 - (stickTop - copyTop) / (vh * LEAVE_FRACTION));
}

// 판이 고정된 스크롤 구간(블록 높이 − 화면 높이)을 문단 수로 나눠 지금 문단을 고른다
export function activeParagraph(blockTop: number, blockHeight: number, vh: number, count: number): number {
  if (count <= 1) return 0;
  const hold = blockHeight - vh;
  if (hold <= 0) return 0;
  const p = clamp01(-blockTop / hold);
  return Math.min(count - 1, Math.floor(p * count));
}

// 문서의 모든 그림 판 블록에 자막을 붙인다. 돌려준 함수로 떼어 낸다(인라인 스타일·클래스도 되돌린다).
export function startCaptions(doc: Document): () => void {
  const root = doc.documentElement;
  const blocks = Array.from(doc.querySelectorAll<HTMLElement>('.chart-block'));
  root.classList.add('has-captions');
  let raf = 0;
  const update = () => {
    raf = 0;
    const vh = window.innerHeight;
    for (const block of blocks) {
      const copy = block.querySelector<HTMLElement>('.chart-copy');
      if (!copy) continue;
      const r = block.getBoundingClientRect();
      if (r.bottom < -vh || r.top > 2 * vh) continue; // 멀리 있는 블록은 건너뛴다
      const stickTop = parseFloat(getComputedStyle(copy).top) || 0;
      copy.style.opacity = String(captionOpacity(copy.getBoundingClientRect().top, vh, stickTop));
      const paras = copy.querySelectorAll<HTMLElement>('.chart-para');
      const on = activeParagraph(r.top, r.height, vh, paras.length);
      paras.forEach((p, i) => p.classList.toggle('is-on', i === on));
    }
  };
  const schedule = () => { if (!raf) raf = requestAnimationFrame(update); };
  update();
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  return () => {
    window.removeEventListener('scroll', schedule);
    window.removeEventListener('resize', schedule);
    if (raf) cancelAnimationFrame(raf);
    root.classList.remove('has-captions');
    for (const block of blocks) {
      block.querySelector<HTMLElement>('.chart-copy')?.style.removeProperty('opacity');
      block.querySelectorAll('.chart-para').forEach((p) => p.classList.remove('is-on'));
    }
  };
}
