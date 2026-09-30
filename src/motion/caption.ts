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

// 짧은 화면(예: 844×390)에서는 글 상자가 CSS 고정 위치(cssTop)보다 커서 화면 아래로 넘칠 수 있다 —
// 그러면 마지막 줄과 "코드 보기" 링크가 한 번도 화면에 들어오지 못한 채 자막이 흐려진다. 이때는 상자를
// 위로 올려 전체가 화면 안에 들어오게 한다(판의 아래쪽과 겹칠 수 있지만, 판이 덜 가려지는 것보다 글을
// 끝까지 읽을 수 있는 쪽이 낫다). 화면보다도 큰 극단적인 경우엔 위쪽 여백 8px만 남긴다
export function stickTopFor(cssTop: number, copyH: number, vh: number): number {
  if (copyH <= vh - cssTop - 8) return cssTop;
  return Math.max(8, vh - copyH - 8);
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
      // 인라인 top을 먼저 지워야 CSS 고정값(cssTop)을 다시 읽을 수 있다(지난 프레임 값이 남아 있으면
      // getComputedStyle이 그 인라인 값을 돌려준다)
      copy.style.removeProperty('top');
      const cssTop = parseFloat(getComputedStyle(copy).top) || 0;
      const stickTop = stickTopFor(cssTop, copy.offsetHeight, vh);
      if (stickTop !== cssTop) copy.style.top = `${stickTop}px`;
      copy.style.opacity = String(captionOpacity(copy.getBoundingClientRect().top, vh, stickTop));
      const paras = copy.querySelectorAll<HTMLElement>('.chart-para');
      const on = activeParagraph(r.top, r.height, vh, paras.length);
      paras.forEach((p, i) => p.classList.toggle('is-on', i === on));
      // 지금 문단 번호를 블록에도 적는다 — 단계가 있는 그림 판(③ 모델 구조, 계획 7-2)이 이것을 지켜보다 점 배치를 바꾼다.
      // 바뀔 때만 쓴다(매 스크롤 프레임마다 쓰면 판의 MutationObserver가 헛돈다)
      if (block.dataset.para !== String(on)) block.dataset.para = String(on);
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
      const copy = block.querySelector<HTMLElement>('.chart-copy');
      copy?.style.removeProperty('opacity');
      copy?.style.removeProperty('top');
      block.querySelectorAll('.chart-para').forEach((p) => p.classList.remove('is-on'));
      delete block.dataset.para;
    }
  };
}
