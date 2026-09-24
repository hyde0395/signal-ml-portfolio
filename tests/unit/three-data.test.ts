// JSON → 점 좌표 변환 검사: 좌표계, 레이어 순서, 잡음 솎아내기, 공휴일·노선 표시, 로딩 실패.
import { describe, expect, it, vi } from 'vitest';
import { buildPointCloud, curveWeight, dateIndex, loadSceneData, mapPosition, terrainPosition, type Band, type MapData, type Terrain } from '@/three/data';

const terrain: Terrain = {
  asOf: '2026-09-22', maxDtd: 100, clip: { min: -60, max: 200 },
  dates: ['2026-10-01', '2026-10-02', '2026-10-03'], holiday: [2],
  signal: { dtd: [100, 0], date: [0, 2], pct: [0, 500] },
  noise: { dtd: [50, 50, 50, 50], date: [1, 1, 1, 1], pct: [10, 20, 30, 40] },
  removed: { dtd: [10], date: [1], pct: [2000] },
  curve: { dtd: [50], pct: [-80], n: [40] },
};
const map: MapData = {
  bbox: [124.5, 30, 146, 45.6],
  coast: [13525, 3780, 13600, 3700],
  routes: [{ from: 'ICN', to: 'NRT', pts: [12645, 3746, 14039, 3577] }],
  airports: [{ code: 'ICN', lon: 126.45, lat: 37.46 }],
};
const band: Band = { asOf: '2026-09-22', dates: ['2026-10-02', '2026-12-01'], lo: [-100, 0], hi: [100, 0] };

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
      curve: { dtd: [], pct: [], n: [] },
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

describe('curveWeight (예약 곡선 표본 수 가중치)', () => {
  it('가장 많은 dtd는 1, 적을수록 로그 척도로 작아진다', () => {
    expect(curveWeight(13392, 13392)).toBe(1);
    const w41 = curveWeight(41, 13392);
    expect(w41).toBeGreaterThan(0.35);
    expect(w41).toBeLessThan(0.45);
    expect(curveWeight(500, 13392)).toBeGreaterThan(w41);
    expect(curveWeight(500, 13392)).toBeLessThan(1);
  });
  it('n이 0이거나 이상하면 0', () => {
    expect(curveWeight(0, 100)).toBe(0);
    expect(curveWeight(10, 0)).toBe(0);
  });
});

describe('buildPointCloud 가중치', () => {
  it('곡선 점은 표본 수로 가중치를 받고 점을 빼지 않는다, 다른 레이어는 1', () => {
    const t2: Terrain = { ...terrain, curve: { dtd: [5, 80], pct: [100, 200], n: [10000, 40] } };
    const pc = buildPointCloud(t2, map, { noiseStride: 1 });
    const start = 2 + 4 + 1;
    expect(pc.count).toBe(start + 8); // dtd 두 개 × 4점 — 표본이 적은 dtd도 그대로 남는다
    for (let i = 0; i < start; i++) expect(pc.weight[i]).toBe(1);
    for (let j = 0; j < 4; j++) {
      expect(pc.weight[start + j]).toBeCloseTo(1, 6);
      expect(pc.weight[start + 4 + j]).toBeCloseTo(curveWeight(40, 10000), 6);
    }
    expect(pc.weight[start + 4]).toBeLessThan(pc.weight[start]);
  });
});

describe('loadSceneData', () => {
  const ok = (body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
  it('기준일로 파일을 찾아 세 JSON(지형·지도·띠)을 검사해 돌려준다', async () => {
    const fetcher = vi.fn((url: string) => ok(url.includes('terrain') ? terrain : url.includes('band') ? band : map));
    const data = await loadSceneData('2026-09-22', fetcher as unknown as typeof fetch);
    expect(fetcher).toHaveBeenCalledWith('/data/terrain.2026-09-22.json');
    expect(fetcher).toHaveBeenCalledWith('/data/band.2026-09-22.json');
    expect(data.terrain.dates).toHaveLength(3);
    expect(data.band.dates).toHaveLength(2);
  });
  it('404면 reject (빈 캔버스로 텍스트를 가리지 않도록 호출 측이 대체 화면으로 간다)', async () => {
    const fetcher = vi.fn(() => Promise.resolve(new Response('no', { status: 404 })));
    await expect(loadSceneData('2026-09-22', fetcher as unknown as typeof fetch)).rejects.toThrow();
  });
  it('형식이 틀리면 reject', async () => {
    const fetcher = vi.fn(() => ok({ nope: true }));
    await expect(loadSceneData('2026-09-22', fetcher as unknown as typeof fetch)).rejects.toThrow();
  });
  it('curve.n이 없거나 길이가 다르면 reject', async () => {
    for (const curve of [{ dtd: [50], pct: [-80] }, { dtd: [50], pct: [-80], n: [] }]) {
      const fetcher = vi.fn((url: string) => ok(url.includes('terrain') ? { ...terrain, curve } : map));
      await expect(loadSceneData('2026-09-22', fetcher as unknown as typeof fetch)).rejects.toThrow();
    }
  });
  it('coast가 비어 있으면 reject (buildPointCloud에서 NaN 방지)', async () => {
    const badMap = { ...map, coast: [] };
    const fetcher = vi.fn((url: string) => ok(url.includes('terrain') ? terrain : badMap));
    await expect(loadSceneData('2026-09-22', fetcher as unknown as typeof fetch)).rejects.toThrow();
  });
});

describe('예측 구간 띠(band, kind 4)', () => {
  it('dateIndex: 이웃한 두 출발일 사이를 날수로 보간하고, 범위 밖은 null', () => {
    expect(dateIndex(['2026-10-01', '2026-10-03', '2026-10-07'], '2026-10-02')).toBe(0.5);
    expect(dateIndex(['2026-10-01', '2026-10-03', '2026-10-07'], '2026-10-06')).toBe(1.75);
    expect(dateIndex(['2026-10-01', '2026-10-03'], '2026-10-01')).toBe(0);
    expect(dateIndex(['2026-10-01', '2026-10-03'], '2026-12-01')).toBeNull();
  });

  it('출발일마다 lo~hi를 점 6개 세로 줄로, 기준일 시점 예약 일수 자리에 세운다', () => {
    const plain = buildPointCloud(terrain, map, { noiseStride: 1 });
    const pc = buildPointCloud(terrain, map, { noiseStride: 1, band });
    expect(pc.count).toBe(plain.count + 6); // 12-01은 지형 출발일 범위 밖이라 건너뛴다
    const s = plain.count;
    for (let k = 0; k < 6; k++) expect(pc.kind[s + k]).toBe(4);
    // 10-02는 기준일 10일 뒤 → x = ((100-10)/100-0.5)*16 = 6.4, 출발일 번호 1(가운데) → z = 0, lo -10% → y = -0.4
    const at = (arr: Float32Array, i: number) => [arr[i * 3], arr[i * 3 + 1], arr[i * 3 + 2]];
    at(pc.terrain, s).forEach((v, i) => expect(v).toBeCloseTo([6.4, -0.4, 0][i], 5));
    expect(pc.terrain[(s + 5) * 3 + 1]).toBeCloseTo(0.4, 5); // hi +10%
    at(pc.map, s).forEach((v, i) => expect(v).toBeCloseTo(at(pc.terrain, s)[i], 5)); // 지도 장면에서도 제자리
  });

  it('띠를 더해도 앞 레이어의 좌표·난수 순서는 그대로다(대체 이미지 불변)', () => {
    // band 유무를 비교하면(이전 테스트) 둘 다 "band 없음" 경로를 타서 항상 통과하는 동어반복이었다.
    // 실제로 band를 넣었을 때 앞쪽(신호~예약 곡선) 점들의 좌표와 난수 순서가 그대로인지 검사한다.
    const plain = buildPointCloud(terrain, map, { noiseStride: 1, seed: 7 });
    const withBand = buildPointCloud(terrain, map, { noiseStride: 1, seed: 7, band });
    expect(Array.from(withBand.scatter.slice(0, plain.count * 3))).toEqual(Array.from(plain.scatter));
    expect(Array.from(withBand.terrain.slice(0, plain.count * 3))).toEqual(Array.from(plain.terrain));
    expect(Array.from(withBand.map.slice(0, plain.count * 3))).toEqual(Array.from(plain.map));
  });
});
