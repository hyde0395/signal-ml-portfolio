// JSON → 점 좌표 변환 검사: 좌표계, 레이어 순서, 잡음 솎아내기, 공휴일·노선 표시, 로딩 실패.
import { describe, expect, it, vi } from 'vitest';
import { buildPointCloud, loadSceneData, mapPosition, terrainPosition, type MapData, type Terrain } from '@/three/data';

const terrain: Terrain = {
  asOf: '2026-09-22', maxDtd: 100, clip: { min: -60, max: 200 },
  dates: ['2026-10-01', '2026-10-02', '2026-10-03'], holiday: [2],
  signal: { dtd: [100, 0], date: [0, 2], pct: [0, 500] },
  noise: { dtd: [50, 50, 50, 50], date: [1, 1, 1, 1], pct: [10, 20, 30, 40] },
  removed: { dtd: [10], date: [1], pct: [2000] },
  curve: { dtd: [50], pct: [-80] },
};
const map: MapData = {
  bbox: [124.5, 30, 146, 45.6],
  coast: [13525, 3780, 13600, 3700],
  routes: [{ from: 'ICN', to: 'NRT', pts: [12645, 3746, 14039, 3577] }],
  airports: [{ code: 'ICN', lon: 126.45, lat: 37.46 }],
};

describe('terrainPosition', () => {
  it('147일 전은 왼쪽 끝, 출발 당일은 오른쪽 끝, +50%는 높이 2', () => {
    expect(terrainPosition(100, 0, 0, 100, 3)).toEqual([-8, 0, -10]);
    expect(terrainPosition(0, 2, 500, 100, 3)).toEqual([8, 2, 10]);
  });
});

describe('mapPosition', () => {
  it('지도 중심은 원점, 북쪽은 -z', () => {
    expect(mapPosition(135.25, 37.8)).toEqual([0, 0]);
    expect(mapPosition(135.25, 38.8)[1]).toBeLessThan(0);
  });
});

describe('buildPointCloud', () => {
  it('신호 → 잡음 → 제거 → 예약 곡선 순서, 잡음은 stride로 솎는다, 곡선은 dtd당 4점', () => {
    const pc = buildPointCloud(terrain, map, { noiseStride: 2 });
    expect(pc.count).toBe(2 + 2 + 1 + 4);
    expect(Array.from(pc.kind)).toEqual([0, 0, 1, 1, 2, 3, 3, 3, 3]);
  });
  it('공휴일 출발일 점만 holiday = 1', () => {
    const pc = buildPointCloud(terrain, map, { noiseStride: 1 });
    expect(pc.holiday[0]).toBe(0);
    expect(pc.holiday[1]).toBe(1);
  });
  it('모든 점이 지도 목표 좌표를 받고, 일부는 노선 궤적 점이다', () => {
    const pc = buildPointCloud(terrain, map, { noiseStride: 1 });
    expect(pc.map.length).toBe(pc.count * 3);
    expect(Array.from(pc.route).some((v) => v === 1)).toBe(true);
    expect(Array.from(pc.map).every(Number.isFinite)).toBe(true);
  });
  it('시드가 같으면 흩어짐 좌표도 같다', () => {
    const a = buildPointCloud(terrain, map, { noiseStride: 1, seed: 7 });
    const b = buildPointCloud(terrain, map, { noiseStride: 1, seed: 7 });
    expect(Array.from(a.scatter)).toEqual(Array.from(b.scatter));
  });
  it('예약 곡선(kind 3)은 z가 고정이고 지형보다 높이 배율이 크며, 지도 목표가 지형과 같다(uMap 무시)', () => {
    const pc = buildPointCloud(terrain, map, { noiseStride: 1 });
    const start = (2 + 4 + 1) * 3; // 신호 2 + 잡음 4(stride 1) + 제거 1, 그다음이 곡선
    for (let i = 0; i < 4; i++) {
      const o = start + i * 3;
      expect(pc.terrain[o + 2]).toBe(10.5); // CURVE_Z
      expect(pc.terrain[o + 1]).toBeCloseTo((-80 / 10) * 0.12, 6); // pct10=-80 → -0.96
      // uMap이 커져도 움직이지 않아야 하므로 지도 목표 = 지형 목표
      expect(pc.map[o]).toBe(pc.terrain[o]);
      expect(pc.map[o + 1]).toBe(pc.terrain[o + 1]);
      expect(pc.map[o + 2]).toBe(pc.terrain[o + 2]);
    }
  });
  it('신호 점의 해안선 인덱스가 앞쪽 1/3과 뒤쪽 1/3에 고루 퍼진다 (프리픽스에 몰리지 않는다)', () => {
    // 결함 A 재현: coast[i % coast.length]였다면 신호(항상 앞쪽 인덱스)는 coast 앞부분에만 몰린다.
    // 해안선 각 인덱스에 서로 다른 경도(정수)를 줘서, 배정된 인덱스를 역산해 분포를 확인한다.
    const N = 30, M = 10;
    const coastPts: number[] = [];
    for (let idx = 0; idx < N; idx++) coastPts.push(idx * 100, 0); // pairs()가 100으로 나누므로 *100 (lon=idx, lat=0)
    const bigMap: MapData = { ...map, coast: coastPts, routes: [] }; // 노선 없음 → 전부 해안선 목표
    const bigTerrain: Terrain = {
      ...terrain,
      signal: { dtd: Array(M).fill(50), date: Array(M).fill(1), pct: Array(M).fill(0) },
      noise: { dtd: [], date: [], pct: [] },
      removed: { dtd: [], date: [], pct: [] },
      curve: { dtd: [], pct: [] },
    };
    const pc = buildPointCloud(bigTerrain, bigMap, { noiseStride: 1 });
    const MAP_SCALE = 0.75, MAP_COS = Math.cos((37.8 * Math.PI) / 180);
    const idxs: number[] = [];
    for (let i = 0; i < pc.count; i++) {
      const lon = pc.map[i * 3] / (MAP_SCALE * MAP_COS) + 135.25;
      idxs.push(Math.round(lon));
    }
    expect(idxs.some((v) => v < N / 3)).toBe(true);
    expect(idxs.some((v) => v >= (N * 2) / 3)).toBe(true);
  });
});

describe('loadSceneData', () => {
  const ok = (body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
  it('기준일로 파일을 찾아 두 JSON을 검사해 돌려준다', async () => {
    const fetcher = vi.fn((url: string) => ok(url.includes('terrain') ? terrain : map));
    const data = await loadSceneData('2026-09-22', fetcher as unknown as typeof fetch);
    expect(fetcher).toHaveBeenCalledWith('/data/terrain.2026-09-22.json');
    expect(data.terrain.dates).toHaveLength(3);
  });
  it('404면 reject (빈 캔버스로 텍스트를 가리지 않도록 호출 측이 대체 화면으로 간다)', async () => {
    const fetcher = vi.fn(() => Promise.resolve(new Response('no', { status: 404 })));
    await expect(loadSceneData('2026-09-22', fetcher as unknown as typeof fetch)).rejects.toThrow();
  });
  it('형식이 틀리면 reject', async () => {
    const fetcher = vi.fn(() => ok({ nope: true }));
    await expect(loadSceneData('2026-09-22', fetcher as unknown as typeof fetch)).rejects.toThrow();
  });
  it('coast가 비어 있으면 reject (buildPointCloud에서 NaN 방지)', async () => {
    const badMap = { ...map, coast: [] };
    const fetcher = vi.fn((url: string) => ok(url.includes('terrain') ? terrain : badMap));
    await expect(loadSceneData('2026-09-22', fetcher as unknown as typeof fetch)).rejects.toThrow();
  });
});
