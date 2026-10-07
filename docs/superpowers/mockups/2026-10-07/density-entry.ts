// 밀도 시안 v2: (1) U자 촘촘함 단계 (2) 차트마다 지금 vs 제안. 실제 배치 함수 + 실제 데이터(표본만 다시 뽑음)
import { buildLayout } from '@/charts/build';
import { drawLayout } from '@/charts/draw2d';
import { CLOUD, SWARM } from '@/charts/layouts';
import { loadCloud } from '@/charts/data';

const W = 900, H = 400;
const S = { locale: 'ko', holidays: {}, axis: '', zero: '', callMin: '', callLast: '' } as any;
const fmt = (n: number) => n.toLocaleString();

function render(parent: HTMLElement, title: string, note: string, key: any, loaded: any, step: number, sub: number,
  tweak: (lay: any) => number) {
  const lay = buildLayout(key, loaded, { w: W, h: H }, S, -1, step, sub);
  const n = tweak(lay);
  const cv = document.createElement('canvas'); const dpr = window.devicePixelRatio || 1;
  cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px';
  const ctx = cv.getContext('2d')!; ctx.scale(dpr, dpr);
  drawLayout(ctx, lay, W, H, lay.initial ?? -1);
  for (const l of lay.lines ?? []) {
    ctx.globalAlpha = l.alpha; ctx.strokeStyle = '#EEF3FF'; ctx.lineWidth = l.width; ctx.beginPath();
    for (let k = 0; k < l.pts.length; k += 2) (k ? ctx.lineTo : ctx.moveTo).call(ctx, l.pts[k] * W, l.pts[k + 1] * H);
    ctx.stroke(); ctx.globalAlpha = 1;
  }
  const cell = document.createElement('figure'); cell.className = 'cell';
  cell.innerHTML = `<figcaption><b>${title}</b><span>${note} · 배경 점 ${fmt(n)}개</span></figcaption>`;
  cell.appendChild(cv); parent.appendChild(cell);
}
// 배경 층 점(크기가 bg 중 하나)만 크기를 바꾼다 — 사이트에서는 배치 함수 상수로 바뀐다
const scaleBg = (bg: number[], to: number[]) => (lay: any) => {
  let n = 0;
  for (let i = 0; i < lay.n; i++) {
    const k = bg.findIndex((b) => Math.abs(lay.size[i] - b) < 0.01);
    if (k >= 0 && lay.alpha[i] > 0) { lay.size[i] = to[k]; n++; }
  }
  return n;
};
const countBg = (bg: number[]) => scaleBg(bg, bg);

async function main() {
  const J = async (u: string) => (await fetch(u)).json();
  const x1 = await J('charts.x1.json'), x2 = await J('charts.x2.json'), x4 = await J('charts.x4.json');
  const c12 = await J('curve.12000.json'), c24 = await J('curve.24000.json');
  const cloud = await loadCloud('2026-09-22', ((u: string) => fetch(u.replace('/data/', ''))) as any);
  const withCurve = (base: any, sample: any) => ({ charts: { ...base, curve: { ...base.curve, sample } } });

  // (1) U자 단계
  const u = document.getElementById('u')!;
  const U = [
    { t: '지금', note: '표본 4,000 · 점 2.4', data: x1.curve.sample, dot: 2.4, gap: 0.5 },
    { t: 'U1', note: '표본 8,000 · 점 2.0', data: x2.curve.sample, dot: 2.0, gap: 0.42 },
    { t: 'U2', note: '표본 12,000 · 점 1.7', data: c12, dot: 1.7, gap: 0.35 },
    { t: 'U3', note: '표본 16,000 · 점 1.5', data: x4.curve.sample, dot: 1.5, gap: 0.3 },
    { t: 'U4', note: '표본 24,000 · 점 1.25', data: c24, dot: 1.25, gap: 0.25 },
  ];
  for (const v of U) {
    (SWARM as any).dot = v.dot; (SWARM as any).gap = v.gap;
    render(u, v.t, v.note, 'chartCurve', withCurve(x1, v.data), 0, 0, countBg([v.dot]));
  }
  (SWARM as any).dot = 2.4; (SWARM as any).gap = 0.5;

  // (2) 차트마다 지금 vs 제안
  const all = document.getElementById('all')!;
  const pair = (title: string, now: () => void, next: () => void) => {
    const row = document.createElement('div'); row.className = 'pair';
    const h = document.createElement('h3'); h.textContent = title; all.appendChild(h);
    all.appendChild(row); (now as any)(row); (next as any)(row);
  };
  pair('③ 모델 구조 — 모은 가격', (r: any) => render(r, '지금', '출발일마다 12 · 점 2.2', 'chartModel', { charts: x1 }, 0, 0, countBg([2.2])),
    (r: any) => render(r, '제안', '출발일마다 48 · 점 1.55', 'chartModel', { charts: x4 }, 0, 0, scaleBg([2.2], [1.55])));
  pair('③ 모델 구조 — 기준 가격', (r: any) => render(r, '지금', '', 'chartModel', { charts: x1 }, 0, 1, countBg([2.2])),
    (r: any) => render(r, '제안', '', 'chartModel', { charts: x4 }, 0, 1, scaleBg([2.2], [1.55])));
  pair('③ 모델 구조 — 벗어난 몫', (r: any) => render(r, '지금', '', 'chartModel', { charts: x1 }, 1, 0, countBg([2.2])),
    (r: any) => render(r, '제안', '', 'chartModel', { charts: x4 }, 1, 0, scaleBg([2.2], [1.55])));
  pair('⑤ 차트 4 예측 구간', (r: any) => { (CLOUD as any).perDate = 30; render(r, '지금', '출발일마다 30 · 점 2.5/2', 'chartCloud', { cloud }, 0, 0, countBg([2.5, 2])); },
    (r: any) => { (CLOUD as any).perDate = 60; render(r, '제안', '출발일마다 60 · 점 2.1/1.7', 'chartCloud', { cloud }, 0, 0, scaleBg([2.5, 2], [2.1, 1.7])); (CLOUD as any).perDate = 30; });
  for (const [t, step, sub] of [['② 걸러내기 — 모은 그대로', 0, 0], ['② 걸러내기 — 규칙 1·2', 1, 1], ['② 걸러내기 — 규칙 3까지', 2, 1]] as const)
    pair(t, (r: any) => render(r, '지금', '표본 4,000 · 점 2.2', 'chartFilter', { charts: x1 }, step, sub, countBg([2.2])),
      (r: any) => render(r, '제안', '표본 8,000 · 점 1.9', 'chartFilter', { charts: x2 }, step, sub, scaleBg([2.2], [1.9])));
  for (const [t, step, sub] of [['⑤ 검증 설계 — K-Fold', 0, 0], ['⑤ 검증 설계 — GroupKFold', 1, 0], ['⑤ 검증 설계 — TSS', 2, 4]] as const)
    pair(t, (r: any) => render(r, '지금', '표본 4,000 · 점 2.2', 'chartSplit', { charts: x1 }, step, sub, countBg([2.2])),
      (r: any) => render(r, '제안', '표본 8,000 · 점 1.9', 'chartSplit', { charts: x2 }, step, sub, scaleBg([2.2], [1.9])));
  // (3) TSS 반복: 폴드 1→5를 1.2초마다, 마지막에서 2.4초 멈춘 뒤 처음부터
  const loopEl = document.getElementById('loop')!;
  const row = document.createElement('div'); row.className = 'pair'; loopEl.appendChild(row);
  const mk = (title: string, note: string, data: any, size: number) => {
    const cell = document.createElement('figure'); cell.className = 'cell';
    cell.innerHTML = `<figcaption><b>${title}</b><span>${note}</span><span class="fold"></span></figcaption>`;
    const cv = document.createElement('canvas'); const dpr = window.devicePixelRatio || 1;
    cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px';
    cell.appendChild(cv); row.appendChild(cell);
    const ctx = cv.getContext('2d')!; ctx.scale(dpr, dpr);
    return (sub: number) => {
      const lay: any = buildLayout('chartSplit', { charts: data } as any, { w: W, h: H }, S, -1, 2, sub);
      scaleBg([2.2], [size])(lay); drawLayout(ctx, lay, W, H, -1);
      (cell.querySelector('.fold') as HTMLElement).textContent = `폴드 ${sub + 1}/5`;
    };
  };
  const draws = [mk('지금', '마지막 폴드에서 멈춤', x1, 2.2), mk('제안', '반복 · 마지막에서 2.4초 멈춘 뒤 처음부터', x2, 1.9)];
  let sub = 0, stopped = false;
  draws.forEach((d) => d(0));
  const tick = () => {
    if (sub < 4) { sub++; draws[1](sub); if (!stopped) draws[0](sub); if (sub === 4) stopped = true; setTimeout(tick, sub === 4 ? 2400 : 1200); }
    else { sub = 0; draws[1](0); setTimeout(tick, 1200); }
  };
  setTimeout(tick, 1200);
}
main();
