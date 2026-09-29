// ① 물결 줄 배치 검사(설계 2026-09-29 §6): 신호 점이 30줄 × C칸에 하나씩, 정렬 규칙, 높이 식,
// 잡음·제거 점은 지형 자리, 지금 데이터에서 호박색 줄이 두 줄. 셰이더용 속성 묶기(packMeta).
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
});

describe('buildWave — 지금 데이터(terrain.json)', () => {
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

  it('호박색 줄은 두 줄(69 × 2 점)', () => {
    const amber = Array.from(pc.waveHoliday).filter((v, i) => v === 1 && pc.kind[i] === 0).length;
    expect(amber).toBe(69 * 2);
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
