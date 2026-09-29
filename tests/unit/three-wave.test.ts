// ① 물결 줄 배치 검사(설계 2026-09-29 §6): 신호 점이 30줄 × C칸에 하나씩, 정렬 규칙, 높이 식(참조 계산과 대조),
// 줄 묶음 = 그 줄에 놓인 점(정렬 순서로 C개씩), 호박색 규칙, 잡음·제거 점은 지형 자리. 셰이더용 속성 묶기(packMeta).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildPointCloud, buildWave, packMeta, terrainSchema, WAVE, WORLD, type MapData, type Terrain, type WavePoint } from '@/three/data';
import { facts } from '@/lib/facts';

const R = WAVE.rows;
const X = (c: number, C: number) => (c / (C - 1) - 0.5) * WORLD.width;
const Z = (r: number) => (r / (R - 1) - 0.5) * WORLD.depth;
const ripple = (r: number, c: number) => Math.sin(r * 1.3 + c * 0.21) * WAVE.ripple;

// 출발일 30개 × 남은 일수 3개 = 신호 90개(→ 30줄 × 3칸). pct는 인자로 정한다
function fixture(pct: (date: number, dtd: number) => number, holiday: number[] = []): { t: Terrain; pts: WavePoint[] } {
  const dtd: number[] = [], date: number[] = [], p: number[] = [];
  for (let d = 0; d < 30; d++) for (const k of [0, 20, 40]) { dtd.push(k); date.push(d); p.push(pct(d, k)); }
  const t: Terrain = {
    asOf: '2026-09-22', maxDtd: 40, clip: { min: -60, max: 200 },
    dates: Array.from({ length: 30 }, (_, i) => `2026-10-${String(i + 1).padStart(2, '0')}`), holiday,
    signal: { dtd, date, pct: p },
    noise: { dtd: [20], date: [3], pct: [50] },
    removed: { dtd: [10], date: [5], pct: [900] },
  };
  const pts: WavePoint[] = [
    ...dtd.map((v, i) => ({ dtd: v, date: date[i], pct: p[i], kind: 0 })),
    { dtd: 20, date: 3, pct: 50, kind: 1 },
    { dtd: 10, date: 5, pct: 900, kind: 2 },
  ];
  return { t, pts };
}
const terrainOf = (pts: WavePoint[]) => new Float32Array(pts.flatMap((_, i) => [i, i + 0.5, -i]));

// 출발일마다 점 개수를 따로 정하는 신호 점 묶음(출발일 d에 counts[d]개, 남은 일수는 40·30·20·10·0을 돌려 쓴다).
// 출발일마다 점 수가 다른 실제 데이터처럼, 정렬 순서로 C개씩 자른 줄이 출발일 경계와 어긋나게 만든다
function uneven(counts: number[], pct: (date: number) => number, holiday: number[] = []): { t: Terrain; pts: WavePoint[] } {
  const pts: WavePoint[] = [];
  counts.forEach((n, d) => { for (let j = 0; j < n; j++) pts.push({ dtd: [40, 30, 20, 10, 0][j % 5], date: d, pct: pct(d), kind: 0 }); });
  const t: Terrain = {
    asOf: '2026-09-22', maxDtd: 40, clip: { min: -60, max: 200 },
    dates: counts.map((_, i) => `d${i}`), holiday,
    signal: { dtd: pts.map((p) => p.dtd), date: pts.map((p) => p.date), pct: pts.map((p) => p.pct) },
    noise: { dtd: [], date: [], pct: [] }, removed: { dtd: [], date: [], pct: [] },
  };
  return { t, pts };
}
// 물결 z → 줄 번호
const rowAt = (w: { pos: Float32Array }, i: number) => Math.round((w.pos[i * 3 + 2] / WORLD.depth + 0.5) * (R - 1));

describe('buildWave', () => {
  it('신호 점은 30줄 × C칸 격자에 하나씩 놓인다(x = (u − 0.5)·16, z = (r/29 − 0.5)·20)', () => {
    const { t, pts } = fixture(() => 0);
    const w = buildWave(t, pts, terrainOf(pts));
    expect(w.cols).toBe(3);
    const cells = new Set<string>();
    for (let i = 0; i < 90; i++) {
      const x = w.pos[i * 3], z = w.pos[i * 3 + 2];
      const c = [0, 1, 2].find((k) => Math.abs(X(k, 3) - x) < 1e-3);
      const r = Array.from({ length: R }, (_, k) => k).find((k) => Math.abs(Z(k) - z) < 1e-3);
      expect(c, `x ${x}`).toBeDefined();
      expect(r, `z ${z}`).toBeDefined();
      cells.add(`${r},${c}`);
    }
    expect(cells.size).toBe(90);
  });

  it('출발일 오름차순, 같은 출발일 안에서는 남은 일수 내림차순(왼쪽 = 먼 예약)으로 채운다', () => {
    const { t, pts } = fixture(() => 0);
    const w = buildWave(t, pts, terrainOf(pts));
    // 출발일 0·남은 일수 40 → 줄 0 칸 0, 출발일 0·남은 일수 0 → 줄 0 칸 2, 출발일 29·남은 일수 0 → 줄 29 칸 2
    const at = (date: number, dtd: number) => pts.findIndex((p) => p.kind === 0 && p.date === date && p.dtd === dtd);
    const xz = (i: number) => [w.pos[i * 3], w.pos[i * 3 + 2]];
    expect(xz(at(0, 40))[0]).toBeCloseTo(X(0, 3), 3);
    expect(xz(at(0, 40))[1]).toBeCloseTo(Z(0), 3);
    expect(xz(at(0, 0))[0]).toBeCloseTo(X(2, 3), 3);
    expect(xz(at(29, 0))[1]).toBeCloseTo(Z(29), 3);
  });

  it('높이 = (B + 0.7·O + 잔물결)·0.04 — 모든 가격이 같으면 B = 그 값, O = 0이라 잔물결만 더해진다', () => {
    const { t, pts } = fixture(() => 100); // pct는 10배 정수 → 10%
    const w = buildWave(t, pts, terrainOf(pts));
    for (let i = 0; i < 90; i++) {
      const r = Math.round((w.pos[i * 3 + 2] / WORLD.depth + 0.5) * (R - 1));
      const c = Math.round((w.pos[i * 3] / WORLD.width + 0.5) * 2);
      expect(w.pos[i * 3 + 1]).toBeCloseTo((10 + ripple(r, c)) * WORLD.heightPerPct, 3);
    }
  });

  it('높이 참조 계산: B는 남은 일수 σ=6 가우스(점 수 가중), O는 줄 평균 편차를 줄 사이 σ=1.2로 평활한 뒤 ×0.7', () => {
    // 가격이 출발일·남은 일수마다 다르다 → B·O·평활이 모두 결과에 드러난다
    const price = (d: number, k: number) => ((d * 37 + k * 11) % 97) * 7 - 150;
    const { t, pts } = fixture(price);
    const w = buildWave(t, pts, terrainOf(pts));
    const g = (x: number, s: number) => Math.exp(-(x * x) / (2 * s * s));
    // B: 남은 일수 0·20·40에만 점(각 30개)이 있다. 칸 d의 B = Σ g(k−d, 6)·30·평균(k) / Σ g(k−d, 6)·30
    const mean = (k: number) => pts.filter((p) => p.kind === 0 && p.dtd === k).reduce((a, p) => a + p.pct / 10, 0) / 30;
    const B = (d: number) => {
      const ks = [0, 20, 40];
      return ks.reduce((a, k) => a + g(k - d, 6) * mean(k), 0) / ks.reduce((a, k) => a + g(k - d, 6), 0);
    };
    for (const d of [0, 7, 10, 20, 33, 40]) expect(w.base[d]).toBeCloseTo(B(d), 6);
    // O: 줄 r = 출발일 r(3점). 줄 평균 편차 dev → 줄 하나를 한 표로 σ=1.2 평활 → ×0.7
    const dev = Array.from({ length: R }, (_, r) => [0, 20, 40].reduce((a, k) => a + price(r, k) / 10 - B(k), 0) / 3);
    const O = dev.map((_, r) => 0.7 * dev.reduce((a, v, k) => a + g(k - r, 1.2) * v, 0) / dev.reduce((a, _v, k) => a + g(k - r, 1.2), 0));
    for (let r = 0; r < R; r++) expect(w.offset[r]).toBeCloseTo(O[r], 6);
    // 평활·×0.7이 실제로 효과가 있는 자료인지(평활 전 편차와 다르다)
    expect(Math.max(...O.map((o, r) => Math.abs(o - dev[r])))).toBeGreaterThan(1);
    // 점 높이 = (B(칸의 남은 일수) + O + 잔물결)·0.04
    for (let i = 0; i < 90; i++) {
      const r = rowAt(w, i), c = Math.round((w.pos[i * 3] / WORLD.width + 0.5) * 2);
      expect(w.pos[i * 3 + 1]).toBeCloseTo((B([40, 20, 0][c]) + O[r] + ripple(r, c)) * WORLD.heightPerPct, 3);
    }
  });

  it('출발일 묶음이 평균보다 비싸면 그 줄이 높다(O)', () => {
    const { t, pts } = fixture((d) => (d < 5 ? 300 : 0));
    const w = buildWave(t, pts, terrainOf(pts));
    expect(w.offset[0]).toBeGreaterThan(0);
    expect(w.offset[R - 1]).toBeLessThan(0);
  });

  it('잡음·제거 점은 지형 자리 그대로, 공휴일 줄 아님', () => {
    const { t, pts } = fixture(() => 0);
    const terr = terrainOf(pts);
    const w = buildWave(t, pts, terr);
    for (const i of [90, 91]) {
      expect(Array.from(w.pos.subarray(i * 3, i * 3 + 3))).toEqual(Array.from(terr.subarray(i * 3, i * 3 + 3)));
      expect(w.holiday[i]).toBe(0);
    }
  });

  it('호박색 줄: 공휴일이 반 이상이고 O > 4인 줄이 이어진 묶음마다 O가 가장 높은 줄 하나', () => {
    // 출발일 0~5(줄 0~5)가 공휴일이고 비싸다 → 이어진 한 묶음 → 한 줄만 호박색
    const { t, pts } = fixture((d) => (d < 6 ? 600 : 0), [0, 1, 2, 3, 4, 5]);
    const w = buildWave(t, pts, terrainOf(pts));
    expect(w.holidayRows).toHaveLength(1);
    const best = w.holidayRows[0];
    for (let r = 0; r < 6; r++) expect(w.offset[best]).toBeGreaterThanOrEqual(w.offset[r]);
    // 그 줄의 점만 공휴일 표시
    const amber = Array.from(w.holiday.subarray(0, 90)).filter((v) => v === 1).length;
    expect(amber).toBe(3);
  });

  it('호박색 줄: 공휴일 점이 반 미만인 줄은 O가 커도 빠진다', () => {
    // 출발일 5는 점 1개(공휴일, 매우 비쌈), 출발일 6은 5개 → 줄 5 = 출발일 5 한 점 + 출발일 6 두 점(공휴일 1/3)
    const counts = Array.from({ length: 30 }, (_, d) => (d === 5 ? 1 : d === 6 ? 5 : 3));
    const { t, pts } = uneven(counts, (d) => (d === 5 ? 3000 : 0), [5]);
    const w = buildWave(t, pts, terrainOf(pts));
    expect(w.share[5]).toBeCloseTo(1 / 3, 6);
    expect(w.offset[5]).toBeGreaterThan(WAVE.minOffset);
    expect(w.holidayRows).toEqual([]);
  });

  it('호박색 줄: 공휴일 줄이어도 O(×0.7 뒤)가 4 이하면 빠진다', () => {
    const { t, pts } = fixture((d) => (d < 6 ? 60 : 0), [0, 1, 2, 3, 4, 5]);
    const w = buildWave(t, pts, terrainOf(pts));
    const top = Math.max(...w.offset);
    expect(top).toBeGreaterThan(0);
    expect(top).toBeLessThanOrEqual(WAVE.minOffset);
    expect(w.holidayRows).toEqual([]);
  });

  it('호박색 줄: 떨어진 두 묶음이면 묶음마다 한 줄씩 두 줄', () => {
    const hol = [2, 3, 4, 20, 21, 22];
    const { t, pts } = fixture((d) => (hol.includes(d) ? 800 : 0), hol);
    const w = buildWave(t, pts, terrainOf(pts));
    expect(w.holidayRows).toHaveLength(2);
    expect(w.holidayRows[0]).toBeGreaterThanOrEqual(2);
    expect(w.holidayRows[0]).toBeLessThanOrEqual(4);
    expect(w.holidayRows[1]).toBeGreaterThanOrEqual(20);
    expect(w.holidayRows[1]).toBeLessThanOrEqual(22);
  });

  it('줄 묶음 = 그 줄에 놓인 점: 편차·공휴일 비율을 그 점들로 세고, 호박색 줄의 점이 곧 그 묶음이다', () => {
    // 출발일 0에 점이 몰려(40개) 정렬 순서의 줄과 출발일 번호가 어긋난다. 출발일 25(공휴일, 비쌈, 12점)는
    // 정렬 순서로 88~99번째 = 줄 22~24(C = 4)에 놓인다 — 출발일 번호를 30등분하면 줄 25로 잘못 묶인다
    const counts = Array.from({ length: 30 }, (_, d) => (d === 0 ? 40 : d === 25 ? 12 : 2));
    const { t, pts } = uneven(counts, (d) => (d === 25 ? 600 : 0), [25]);
    const w = buildWave(t, pts, terrainOf(pts));
    expect(w.cols).toBe(4);
    const byRow = Array.from({ length: R }, () => [] as number[]);
    pts.forEach((_, i) => byRow[rowAt(w, i)].push(i));
    for (let r = 0; r < R; r++) {
      const ids = byRow[r];
      if (!ids.length) continue;
      const dev = ids.reduce((a, i) => a + pts[i].pct / 10 - w.base[pts[i].dtd], 0) / ids.length;
      expect(w.dev[r], `줄 ${r} 편차`).toBeCloseTo(dev, 6);
      expect(w.share[r], `줄 ${r} 공휴일 비율`).toBeCloseTo(ids.filter((i) => pts[i].date === 25).length / ids.length, 6);
    }
    expect(w.holidayRows).toHaveLength(1);
    const amberRow = w.holidayRows[0];
    expect(amberRow).toBeGreaterThanOrEqual(22);
    expect(amberRow).toBeLessThanOrEqual(24);
    // 호박색으로 칠한 점 = 그 줄에 놓인 점 전부, 모두 공휴일 출발일
    const flagged = pts.map((_, i) => i).filter((i) => w.holiday[i] === 1);
    expect(flagged).toEqual(byRow[amberRow]);
    for (const i of flagged) expect(pts[i].date).toBe(25);
  });
});

describe(`buildWave — 지금 데이터 스냅숏(terrain.${facts.dataVersion}) 검사`, () => {
  // 데이터를 다시 뽑으면 바뀔 수 있는 값이다(스냅숏에 묶인 기대값). 줄 10 = 바다의 날(일본) 무렵(공휴일 점 80%),
  // 줄 14 = 산의 날(일본)·광복절 무렵, 줄 25 = 개천절·한글날 무렵
  const AMBER_ROWS = [10, 14, 25];
  const t = terrainSchema.parse(JSON.parse(readFileSync(`public/data/terrain.${facts.dataVersion}.json`, 'utf8')));
  const map: MapData = { bbox: [124.5, 30, 146, 45.6], coast: [13525, 3780, 13600, 3700], routes: [], airports: [] };
  const pc = buildPointCloud(t, map, { noiseStride: 1 });

  it('신호 2,070개가 30줄 × 69칸에 하나씩', () => {
    const sig = Array.from(pc.kind).filter((k) => k === 0).length;
    expect(sig).toBe(2070);
    const cells = new Set<string>();
    for (let i = 0; i < pc.count; i++) {
      if (pc.kind[i] !== 0) continue;
      cells.add(`${pc.wave[i * 3].toFixed(3)},${pc.wave[i * 3 + 2].toFixed(3)}`);
    }
    expect(cells.size).toBe(30 * 69);
  });

  it(`이 스냅숏에서 호박색 줄은 ${AMBER_ROWS.join('·')}번(69점씩), 줄마다 공휴일 무렵 출발일 점이 반 이상`, () => {
    const hs = new Set(t.holiday);
    const rowOf = (i: number) => Math.round((pc.wave[i * 3 + 2] / WORLD.depth + 0.5) * (R - 1));
    const amber = Array.from({ length: pc.count }, (_, i) => i).filter((i) => pc.waveHoliday[i] === 1);
    expect(amber.every((i) => pc.kind[i] === 0)).toBe(true);
    expect([...new Set(amber.map(rowOf))].sort((a, b) => a - b)).toEqual(AMBER_ROWS);
    for (const r of AMBER_ROWS) {
      const ids = amber.filter((i) => rowOf(i) === r);
      expect(ids).toHaveLength(69);
      expect(ids.filter((i) => hs.has(pc.date[i])).length / ids.length).toBeGreaterThanOrEqual(WAVE.holFrac);
    }
  });
});

describe('packMeta', () => {
  it('점마다 (종류, 공휴일, 노선, 물결 공휴일) 순서로 vec4 하나에 담는다', () => {
    const m = packMeta({
      count: 2, kind: Float32Array.of(0, 2), holiday: Float32Array.of(1, 0),
      route: Float32Array.of(-1, 1), waveHoliday: Float32Array.of(1, 0),
    });
    expect(Array.from(m)).toEqual([0, 1, -1, 1, 2, 0, 1, 0]);
  });
});
