// 2D 그리기와 키별 조립 검사: 점마다 원 하나, 색 번호 → 색, 키별로 알맞은 배치 함수를 부른다.
import { describe, expect, it } from 'vitest';
import { buildLayout } from '@/charts/build';
import { drawLayout, TONE_COLOR } from '@/charts/draw2d';
import { TONE, type ChartLayout } from '@/charts/types';
import { facts } from '@/lib/facts';

function fakeCtx() {
  const calls: { x: number; y: number; r: number; color: string; alpha: number }[] = [];
  let pending = { x: 0, y: 0, r: 0 };
  const ctx = {
    fillStyle: '', globalAlpha: 1,
    clearRect() {}, beginPath() {},
    arc(x: number, y: number, r: number) { pending = { x, y, r }; },
    fill() { calls.push({ ...pending, color: ctx.fillStyle, alpha: ctx.globalAlpha }); },
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
}

describe('drawLayout', () => {
  it('점마다 원 하나, 판 px 좌표, 반지름 = 지름/2, 색 번호별 색', () => {
    const L: ChartLayout = {
      n: 2, x: Float32Array.from([0.5, 1]), y: Float32Array.from([0, 0.5]), size: Float32Array.from([4, 6]),
      alpha: Float32Array.from([0.5, 1]), tone: Uint8Array.from([TONE.dot, TONE.amber]), group: Int16Array.from([-1, -1]), waffle: Int16Array.from([-1, -1]), labels: [],
    };
    const { ctx, calls } = fakeCtx();
    drawLayout(ctx, L, 200, 100);
    expect(calls).toEqual([
      { x: 100, y: 0, r: 2, color: TONE_COLOR[TONE.dot], alpha: 0.5 },
      { x: 200, y: 50, r: 3, color: TONE_COLOR[TONE.amber], alpha: 1 },
    ]);
  });

  it('강조 그룹이 있으면 그 그룹은 호박색, 다른 와플 그룹은 알파 × 0.25, 와플 아닌 점은 그대로', () => {
    const L: ChartLayout = {
      n: 3, x: Float32Array.from([0, 0.5, 1]), y: Float32Array.from([0, 0, 0]), size: Float32Array.from([4, 4, 4]),
      alpha: Float32Array.from([0.8, 0.8, 0.8]), tone: Uint8Array.from([TONE.dot, TONE.dot, TONE.dot]),
      group: Int16Array.from([-1, -1, -1]), waffle: Int16Array.from([0, 1, -1]), labels: [],
    };
    const { ctx, calls } = fakeCtx();
    drawLayout(ctx, L, 100, 100, 1);
    // alpha는 Float32Array를 거쳐 온 값이라 그대로 비교하면 float32→float64 오차가 남는다(0.8 → 0.800000011920929) — 셋째 자리로 반올림해 비교한다
    const rounded = calls.map((c) => ({ color: c.color, alpha: +c.alpha.toFixed(3) }));
    expect(rounded[0]).toEqual({ color: TONE_COLOR[TONE.dot], alpha: 0.2 });
    expect(rounded[1]).toEqual({ color: TONE_COLOR[TONE.amber], alpha: 0.8 });
    expect(rounded[2]).toEqual({ color: TONE_COLOR[TONE.dot], alpha: 0.8 });
  });
});

describe('buildLayout', () => {
  it('features는 facts의 그룹으로 와플 600점, 이름표에 언어별 개수 단위', () => {
    const groups = facts.model.featureGroups.map((g) => ({ id: g.id, gain: g.gain, features: g.features, name: g.id }));
    const L = buildLayout('features', {}, { w: 1080, h: 414 }, { locale: 'en', holidays: {}, groups, countUnit: ' features' });
    expect(L.n).toBe(600);
    expect(L.labels[0]).toMatchObject({ type: 'group', count: `${groups[0].features.length} features` });
  });
});
