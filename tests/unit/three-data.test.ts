// JSON → 점 좌표 변환 검사: 좌표계, 레이어 순서, 잡음 솎아내기, 공휴일·노선 표시, 점마다 출발일 번호, 로딩 실패.
import { describe, expect, it, vi } from 'vitest';
import { buildPointCloud, loadSceneData, MAP_LINE, mapPosition, resampleLines, terrainPosition, type MapData, type Terrain } from '@/three/data';

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
  it('maxDtd일 전은 왼쪽 끝, 출발 당일은 오른쪽 끝, +50%는 높이 2', () => {
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
  it('점마다 지형 출발일 번호를 가진다(점 달력이 출발일로 묶는다)', () => {
    const pc = buildPointCloud(terrain, map, { noiseStride: 1 });
    expect(Array.from(pc.date)).toEqual([0, 2, 1, 1, 1, 1, 1]);
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
  it('해안선 점이 다시 뽑은 해안선 전체(처음·끝 가까이)를 덮는다', () => {
    // 계획 3 결함 A(해안선 앞부분에만 몰림)의 새 방식 검사: 해안선 점 목록을 앞쪽부터 빠짐없이 쓰므로 선 양 끝까지 닿는다.
    // 경도 0.1도 간격(breakDeg 0.5 안) 30점 = 한 줄로 이어진 해안선
    const N = 30, M = 80;
    const coastPts: number[] = [];
    for (let idx = 0; idx < N; idx++) coastPts.push(13000 + idx * 10, 3800);
    const bigMap: MapData = { ...map, coast: coastPts, routes: [] };
    const bigTerrain: Terrain = {
      ...terrain,
      signal: { dtd: Array(M).fill(50), date: Array(M).fill(1), pct: Array(M).fill(0) },
      noise: { dtd: [], date: [], pct: [] },
      removed: { dtd: [], date: [], pct: [] },
    };
    const pc = buildPointCloud(bigTerrain, bigMap, { noiseStride: 1 });
    const xs: number[] = [];
    for (let i = 0; i < pc.count; i++) if (pc.route[i] === 0) xs.push(pc.map[i * 3]);
    const x0 = mapPosition(130, 38)[0], x1 = mapPosition(130 + (N - 1) / 10, 38)[0];
    expect(xs.length).toBeGreaterThan(0);
    expect(Math.abs(Math.min(...xs) - x0)).toBeLessThanOrEqual(MAP_LINE.step);
    expect(Math.abs(Math.max(...xs) - x1)).toBeLessThanOrEqual(MAP_LINE.step);
  });
});

describe('지도 가는 실선(계획 6-4)', () => {
  it('resampleLines: 0.5도 넘게 떨어진 점 사이는 이어 긋지 않고, 세계 좌표에서 같은 간격', () => {
    // 경도 0.1도 간격 두 점 + 멀리 떨어진 한 점(새 선)
    const pts = resampleLines([13000, 3800, 13010, 3800, 14000, 3800], 0.01);
    const gaps: number[] = [];
    for (let i = 1; i < pts.length; i++) gaps.push(Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    expect(pts.length).toBeGreaterThan(3);
    for (const g of gaps) expect(g).toBeLessThan(0.0101); // 첫 선 안에서는 간격 ≤ step, 두 선 사이 점프가 없다(두 번째 선은 점 하나라 뽑을 선분 없음)
  });
  // 픽스처 map의 해안선 두 점은 0.5도보다 멀어 새 규칙에서는 선이 끊긴다 — 가까운 점 세 개로 된 해안선을 따로 쓴다
  const lineMap: MapData = { ...map, coast: [13000, 3800, 13010, 3800, 13020, 3800] };
  it('앞쪽 점부터 해안선 → 노선, 나머지는 route = −1(지도에서 안 씀)이고 지도 자리 = 지형 자리', () => {
    const pc = buildPointCloud(terrain, lineMap, { noiseStride: 1 });
    const r = Array.from(pc.route);
    const firstRoute = r.indexOf(1), firstUnused = r.indexOf(-1);
    expect(r[0]).toBe(0);
    expect(firstRoute).toBeGreaterThan(0);
    if (firstUnused >= 0) {
      expect(firstUnused).toBeGreaterThan(firstRoute);
      for (let i = firstUnused; i < pc.count; i++) {
        expect(r[i]).toBe(-1);
        expect([pc.map[i * 3], pc.map[i * 3 + 1], pc.map[i * 3 + 2]]).toEqual([pc.terrain[i * 3], pc.terrain[i * 3 + 1], pc.terrain[i * 3 + 2]]);
      }
    }
  });
  it('해안선 점은 높이 0, 노선 점은 가운데가 가장 높다(호)', () => {
    const pc = buildPointCloud(terrain, lineMap, { noiseStride: 1 });
    const ys = (v: number) => Array.from(pc.route).map((x, i) => [x, pc.map[i * 3 + 1]] as const).filter(([x]) => x === v).map(([, y]) => y);
    expect(ys(0).every((y) => y === 0)).toBe(true);
    const ry = ys(1);
    expect(Math.max(...ry)).toBeGreaterThan(ry[0]);
  });
});

describe('loadSceneData', () => {
  const ok = (body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
  it('기준일로 파일을 찾아 두 JSON(지형·지도)을 검사해 돌려준다', async () => {
    const fetcher = vi.fn((url: string) => ok(url.includes('terrain') ? terrain : map));
    const data = await loadSceneData('2026-09-22', fetcher as unknown as typeof fetch);
    expect(fetcher).toHaveBeenCalledWith('/data/terrain.2026-09-22.json');
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(data.terrain.dates).toHaveLength(3);
  });
  it('지형 JSON에 예전 curve 필드가 있어도 받아들인다(추출 스크립트는 검증용으로 계속 만든다)', async () => {
    const fetcher = vi.fn((url: string) => ok(url.includes('terrain') ? { ...terrain, curve: { dtd: [1], pct: [2], n: [3] } } : map));
    await expect(loadSceneData('2026-09-22', fetcher as unknown as typeof fetch)).resolves.toBeTruthy();
  });
  it('404면 reject (호출 측이 대체 화면으로 간다)', async () => {
    const fetcher = vi.fn(() => Promise.resolve(new Response('no', { status: 404 })));
    await expect(loadSceneData('2026-09-22', fetcher as unknown as typeof fetch)).rejects.toThrow();
  });
  it('형식이 틀리면 reject', async () => {
    const fetcher = vi.fn(() => ok({ nope: true }));
    await expect(loadSceneData('2026-09-22', fetcher as unknown as typeof fetch)).rejects.toThrow();
  });
  it('coast가 비어 있으면 reject (buildPointCloud에서 NaN 방지)', async () => {
    const fetcher = vi.fn((url: string) => ok(url.includes('terrain') ? terrain : { ...map, coast: [] }));
    await expect(loadSceneData('2026-09-22', fetcher as unknown as typeof fetch)).rejects.toThrow();
  });
});
