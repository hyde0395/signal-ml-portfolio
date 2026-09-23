// JSON → 점 좌표 변환 검사: 좌표계, 레이어 순서, 잡음 솎아내기, 공휴일·노선 표시, 로딩 실패.
import { describe, expect, it, vi } from 'vitest';
import { buildPointCloud, loadSceneData, mapPosition, terrainPosition, type MapData, type Terrain } from '@/three/data';

const terrain: Terrain = {
  asOf: '2026-09-22', maxDtd: 100, clip: { min: -60, max: 200 },
  dates: ['2026-10-01', '2026-10-02', '2026-10-03'], holiday: [2],
  signal: { dtd: [100, 0], date: [0, 2], pct: [0, 500] },
  noise: { dtd: [50, 50, 50, 50], date: [1, 1, 1, 1], pct: [10, 20, 30, 40] },
  removed: { dtd: [10], date: [1], pct: [2000] },
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
  it('신호 → 잡음 → 제거 순서, 잡음은 stride로 솎는다', () => {
    const pc = buildPointCloud(terrain, map, { noiseStride: 2 });
    expect(pc.count).toBe(2 + 2 + 1);
    expect(Array.from(pc.kind)).toEqual([0, 0, 1, 1, 2]);
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
});
