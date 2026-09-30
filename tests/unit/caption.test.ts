// @vitest-environment jsdom
// 자막 띠 계산 검사: 글 상자가 띠로 들어오며 밝아지고, 고정되면 1, 떠나며 빨리 흐려진다.
// 문단 번호는 판이 고정된 구간을 문단 수로 나눠 정하고, 끝까지 가면 마지막 문단이다.
import { describe, expect, it, vi } from 'vitest';
import { activeParagraph, captionOpacity, startCaptions, stickTopFor } from '@/motion/caption';

describe('captionOpacity', () => {
  const vh = 1000, stick = 610;
  it('띠에 고정되면 1', () => {
    expect(captionOpacity(610, vh, stick)).toBe(1);
    expect(captionOpacity(610.4, vh, stick)).toBeCloseTo(1, 2);
  });
  it('화면 아래 끝에서는 0, 띠로 올라오며 밝아진다', () => {
    expect(captionOpacity(1000, vh, stick)).toBe(0);
    expect(captionOpacity(1200, vh, stick)).toBe(0);
    expect(captionOpacity(805, vh, stick)).toBeCloseTo(0.5, 5);
  });
  it('띠보다 위로 떠나면 화면 높이의 15% 안에 사라진다', () => {
    expect(captionOpacity(610 - 75, vh, stick)).toBeCloseTo(0.5, 5);
    expect(captionOpacity(610 - 150, vh, stick)).toBe(0);
    expect(captionOpacity(-400, vh, stick)).toBe(0);
  });
});

// 짧은 화면 보정: 글 상자가 CSS 고정 위치 아래로 넘치면 화면 안에 다 들어오도록 위로 올린다
describe('stickTopFor', () => {
  it('화면 안에 다 들어오면 CSS 고정 위치를 그대로 쓴다', () => {
    expect(stickTopFor(610, 300, 1000)).toBe(610); // 610 + 300 = 910 <= 1000 - 8
    expect(stickTopFor(610, 382, 1000)).toBe(610); // 딱 맞는 경계(610 + 382 = 992 = 1000 - 8)
  });
  it('CSS 고정 위치로는 너무 커서 넘치면 아래 여백 8px만 남기고 올린다', () => {
    expect(stickTopFor(610, 500, 1000)).toBe(492); // 1000 - 500 - 8
    expect(stickTopFor(464, 600, 844)).toBe(236); // 844 - 600 - 8
  });
  it('글 상자가 화면보다도 크면 위쪽 여백 8px만 남긴다', () => {
    expect(stickTopFor(200, 1200, 1000)).toBe(8); // 1000 - 1200 - 8 = -208 → 8로 바닥
  });
});

describe('activeParagraph', () => {
  const vh = 1000;
  it('문단이 하나면 항상 0', () => {
    expect(activeParagraph(-300, 2500, vh, 1)).toBe(0);
  });
  it('고정 구간(블록 높이 − 화면 높이)을 문단 수로 나눈다', () => {
    // 고정 구간 = 3000 − 1000 = 2000 → 문단 3개면 0~666 / 667~1333 / 1334~2000
    expect(activeParagraph(500, 3000, vh, 3)).toBe(0);   // 아직 들어오는 중
    expect(activeParagraph(-100, 3000, vh, 3)).toBe(0);
    expect(activeParagraph(-1000, 3000, vh, 3)).toBe(1);
    expect(activeParagraph(-1900, 3000, vh, 3)).toBe(2);
    expect(activeParagraph(-2600, 3000, vh, 3)).toBe(2); // 지나간 뒤에도 마지막 문단
  });
  it('블록이 화면보다 짧아도 0으로 나누지 않는다', () => {
    expect(activeParagraph(0, 800, vh, 3)).toBe(0);
  });
});

// 블록의 data-para: 단계가 있는 판(계획 7-2)이 지켜보는 값이라, 바뀔 때만 쓰고 떼어 낼 때 지워야 한다
describe('startCaptions data-para', () => {
  it('문단이 바뀔 때만 data-para를 쓰고, 떼어 내면 지운다', () => {
    document.body.innerHTML = '<section class="chart-block"><div class="chart-copy">'
      + '<p class="chart-para">a</p><p class="chart-para">b</p></div></section>';
    const block = document.querySelector<HTMLElement>('.chart-block')!;
    let top = 0;
    // jsdom은 레이아웃이 없다 — 블록 위치·높이를 직접 주고, 프레임 예약은 바로 실행한다
    block.getBoundingClientRect = () => ({ top, height: 3000, bottom: top + 3000 } as DOMRect);
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { cb(0); return 1; });
    Object.defineProperty(window, 'innerHeight', { value: 1000, configurable: true });
    const mo = new MutationObserver(() => {});
    mo.observe(block, { attributes: true, attributeFilter: ['data-para'] });

    const stop = startCaptions(document);
    expect(block.dataset.para).toBe('0');
    top = -1500; // 고정 구간(2000)의 3/4 → 둘째 문단
    window.dispatchEvent(new Event('scroll'));
    expect(block.dataset.para).toBe('1');
    top = -1600; // 같은 문단 안 — 다시 쓰지 않는다
    window.dispatchEvent(new Event('scroll'));
    expect(mo.takeRecords()).toHaveLength(2); // 0 쓰기, 1 쓰기 — 그 뒤 스크롤은 쓰기 없음

    stop();
    expect('para' in block.dataset).toBe(false);
    mo.disconnect();
    vi.unstubAllGlobals();
  });
});
