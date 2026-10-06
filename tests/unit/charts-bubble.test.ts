// ⑤ 차트 3 아령 배치(정보 전달 2 §6): 단계마다 보이는 쌍 수, 후 별은 호박, 전 점은 덧그림의 속 빈 점, 차이 값, 점 수 불변, 판 안
import { describe, expect, it } from 'vitest';
import { BUBBLE, bubbleLayout, type BubbleTexts } from '@/charts/bubble';
import { TONE } from '@/charts/types';

const S: BubbleTexts = {
  rows: [
    { name: '첫 정정', note: '하네다 고가 행', before: 0.93, after: 0.71 },
    { name: '둘째 정정', note: '경유 9,387행', before: 0.84, after: 0.64 },
  ],
  legendBefore: '걸러내기 전', legendAfter: '걸러낸 뒤', maeSame: '거의 그대로', maeChange: '48,442 → 48,235원',
  r2: (v) => v.toFixed(2), tick: (v) => v.toFixed(1), diff: (v) => `−${v.toFixed(2)}`,
};
const wide = { w: 1080, h: 414 }, narrow = { w: 358, h: 354 };
const at = (st: number, size = wide) => bubbleLayout(size, st, S);
const cores = (L: ReturnType<typeof at>) => Array.from({ length: L.n }, (_, i) => i).filter((i) => L.tone[i] === TONE.amber && L.alpha[i] === 1);

describe('bubbleLayout', () => {
  it('단계마다 보이는 쌍 수 1 · 2 · 2(선 개수, 호박 별 심)', () => {
    expect([0, 1, 2].map((s) => at(s).lines?.length)).toEqual([1, 2, 2]);
    expect([0, 1, 2].map((s) => cores(at(s)).length)).toEqual([1, 2, 2]);
  });
  it('단계 사이 점 개수가 같고(3D 슬롯 전환) variant는 단계', () => {
    expect(new Set([0, 1, 2].map((s) => at(s).n)).size).toBe(1);
    expect([0, 1, 2].map((s) => at(s).variant)).toEqual(['stage:0', 'stage:1', 'stage:2']);
  });
  it('후 별은 전 점보다 왼쪽(R²가 내려갔다), 선은 전 → 후', () => {
    const L = at(1);
    const [c0, c1] = cores(L);
    const hollow = L.overlay!(-1).filter((o) => o.type === 'dot' && o.hollow);
    const line0 = L.lines![0].pts;
    expect(L.x[c0]).toBeCloseTo(line0[2], 6);
    expect(line0[0]).toBeGreaterThan(line0[2]);
    expect(hollow.some((o) => o.type === 'dot' && Math.abs(o.x - line0[0]) < 1e-6)).toBe(true);
    expect(L.y[c1]).toBeGreaterThan(L.y[c0]); // 둘째 정정은 아래 줄
  });
  it('전 점은 덧그림의 속 빈 점 — 단계 2에서 흐려진다', () => {
    const before = (st: number) => at(st).overlay!(-1).filter((o) => o.type === 'dot' && o.hollow).map((o) => (o as { alpha: number }).alpha);
    expect(before(0)).toEqual([BUBBLE.beforeA]);
    expect(before(2).slice(0, 2)).toEqual([BUBBLE.pastA, BUBBLE.pastA]);
  });
  it('차이 값은 결론 이름표(callout) 설명 줄: −0.22 · −0.20', () => {
    const notes = (st: number) => at(st).labels.filter((l) => l.type === 'callout').map((l) => (l as { value: string; note: string }));
    expect(notes(0)).toEqual([{ type: 'callout', x: expect.any(Number), y: expect.any(Number), value: '0.71', note: '−0.22', tone: 'amber', place: 'above' }]);
    expect(notes(1).map((n) => n.note)).toEqual(['−0.22', '−0.20']);
  });
  it('MAE 칸: 둘째 정정 값은 단계 1부터', () => {
    const has = (st: number) => at(st).labels.some((l) => l.type === 'text' && l.text.includes('48,442'));
    expect([0, 1, 2].map(has)).toEqual([false, true, true]);
  });
  it('넓은 판·좁은 판 모두 점·이름표가 판 안', () => {
    for (const size of [wide, narrow]) for (const st of [0, 1, 2]) {
      const L = at(st, size);
      for (let i = 0; i < L.n; i++) {
        expect(L.x[i]).toBeGreaterThanOrEqual(0); expect(L.x[i]).toBeLessThanOrEqual(1);
        expect(L.y[i]).toBeGreaterThanOrEqual(0); expect(L.y[i]).toBeLessThanOrEqual(1);
      }
      for (const l of L.labels) {
        expect(l.x).toBeGreaterThanOrEqual(0); expect(l.x).toBeLessThanOrEqual(1);
        expect(l.y).toBeGreaterThanOrEqual(0); expect(l.y).toBeLessThanOrEqual(1);
      }
    }
  });
  it('범례: 속 빈 점(keyRing)과 호박 별(keyAmber)', () => {
    const cls = at(0).labels.filter((l) => l.type === 'text' && l.cls.startsWith('key')).map((l) => (l as { cls: string }).cls);
    expect(cls).toEqual(['keyRing', 'keyAmber']);
  });
});
