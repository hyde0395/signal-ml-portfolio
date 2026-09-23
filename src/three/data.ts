// 3D 장면 데이터: terrain/map JSON을 zod로 검사하고, 점 하나당 목표 좌표(지형·지도·흩어짐)를
// 담은 Float32Array로 바꾼다. React·three에 의존하지 않는 순수 모듈이라 단위 테스트가 쉽다.
import { z } from 'zod';

const ints = z.array(z.number().int());
const layer = z.object({ dtd: ints, date: ints, pct: ints });

export const terrainSchema = z.object({
  asOf: z.string(),
  maxDtd: z.number().int().positive(),
  clip: z.object({ min: z.number(), max: z.number() }),
  dates: z.array(z.string()).min(2),
  holiday: ints,
  signal: layer,
  noise: layer,
  removed: layer,
});
export const mapSchema = z.object({
  bbox: z.array(z.number()).length(4),
  coast: ints,
  routes: z.array(z.object({ from: z.string(), to: z.string(), pts: ints })),
  airports: z.array(z.object({ code: z.string(), lon: z.number(), lat: z.number() })),
});
export type Terrain = z.infer<typeof terrainSchema>;
export type MapData = z.infer<typeof mapSchema>;

// 좌표계는 계획서 "좌표계" 절과 같다. 바꾸면 scenes.ts의 카메라 지점도 함께 바꿔야 한다.
export const WORLD = { width: 16, depth: 20, heightPerPct: 0.04 } as const;
const MAP_CENTER = { lon: 135.25, lat: 37.8 };
const MAP_SCALE = 0.75;
const MAP_COS = Math.cos((MAP_CENTER.lat * Math.PI) / 180);
const ROUTE_ARC_HEIGHT = 1.5;   // 지도 장면에서 노선 궤적이 떠오르는 높이
const ROUTE_SHARE = 5;          // 다섯 점 중 하나를 노선 궤적에 배정한다

export function terrainPosition(dtd: number, dateIdx: number, pct10: number, maxDtd: number, nDates: number): [number, number, number] {
  // 왼쪽 = 먼 예약 시점, 오른쪽 = 출발 당일. 시간이 흐르는 방향을 왼쪽→오른쪽으로 읽게 한다.
  const x = ((maxDtd - dtd) / maxDtd - 0.5) * WORLD.width;
  const y = (pct10 / 10) * WORLD.heightPerPct;
  const z = (dateIdx / (nDates - 1) - 0.5) * WORLD.depth;
  return [round(x), round(y), round(z)];
}

export function mapPosition(lon: number, lat: number): [number, number] {
  return [round((lon - MAP_CENTER.lon) * MAP_SCALE * MAP_COS), round(-(lat - MAP_CENTER.lat) * MAP_SCALE)];
}

export type PointCloud = {
  count: number;
  terrain: Float32Array;
  map: Float32Array;
  scatter: Float32Array;
  kind: Float32Array;
  holiday: Float32Array;
  route: Float32Array;
};

export function buildPointCloud(t: Terrain, m: MapData, opts: { noiseStride: number; seed?: number }): PointCloud {
  // 신호 → 잡음 → 제거 순서로 한 배열에 담는다(Points 하나로 그리기 위해).
  const rows: { dtd: number; date: number; pct: number; kind: number }[] = [];
  const push = (l: Terrain['signal'], kind: number, stride = 1) => {
    for (let i = 0; i < l.pct.length; i += stride) rows.push({ dtd: l.dtd[i], date: l.date[i], pct: l.pct[i], kind });
  };
  push(t.signal, 0);
  push(t.noise, 1, Math.max(1, Math.floor(opts.noiseStride)));
  push(t.removed, 2);

  const count = rows.length;
  const holidays = new Set(t.holiday);
  const out: PointCloud = {
    count,
    terrain: new Float32Array(count * 3),
    map: new Float32Array(count * 3),
    scatter: new Float32Array(count * 3),
    kind: new Float32Array(count),
    holiday: new Float32Array(count),
    route: new Float32Array(count),
  };

  const coast = pairs(m.coast);
  const routes = m.routes.map((r) => pairs(r.pts));
  const rand = mulberry32(opts.seed ?? 1);

  rows.forEach((r, i) => {
    out.terrain.set(terrainPosition(r.dtd, r.date, r.pct, t.maxDtd, t.dates.length), i * 3);
    out.kind[i] = r.kind;
    out.holiday[i] = holidays.has(r.date) ? 1 : 0;

    // 지도 목표: 점 수가 해안선 샘플보다 많으므로 순환 배정하고, 같은 자리에 겹치지 않게 살짝 흔든다.
    const jitter = () => (rand() - 0.5) * 0.06;
    if (routes.length > 0 && i % ROUTE_SHARE === 0) {
      const line = routes[(i / ROUTE_SHARE) % routes.length | 0];
      const k = Math.floor(rand() * line.length);
      const [x, zz] = mapPosition(line[k][0], line[k][1]);
      const arc = Math.sin((k / (line.length - 1)) * Math.PI) * ROUTE_ARC_HEIGHT;
      out.map.set([x + jitter(), arc, zz + jitter()], i * 3);
      out.route[i] = 1;
    } else {
      const [lon, lat] = coast[i % coast.length];
      const [x, zz] = mapPosition(lon, lat);
      out.map.set([x + jitter(), 0, zz + jitter()], i * 3);
    }

    // 흩어짐: 반지름 14 구 안 균일 분포(시드 고정 → 캡처 이미지가 매번 같다)
    const u = rand() * 2 - 1, th = rand() * Math.PI * 2, rr = 14 * Math.cbrt(rand());
    const s = Math.sqrt(1 - u * u);
    out.scatter.set([rr * s * Math.cos(th), rr * u, rr * s * Math.sin(th)], i * 3);
  });
  return out;
}

export async function loadSceneData(dataVersion: string, fetcher: typeof fetch = fetch) {
  const get = async (url: string) => {
    const res = await fetcher(url);
    if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
    return res.json();
  };
  const [terrain, map] = await Promise.all([get(`/data/terrain.${dataVersion}.json`), get('/data/map.v1.json')]);
  return { terrain: terrainSchema.parse(terrain), map: mapSchema.parse(map) };
}

function pairs(flat: number[]): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i + 1 < flat.length; i += 2) out.push([flat[i] / 100, flat[i + 1] / 100]);
  return out;
}

function round(v: number): number {
  return Math.round(v * 1e4) / 1e4 + 0; // + 0: -0을 0으로 바꿔 테스트 비교를 안정시킨다
}

// 작고 빠른 시드 난수. Math.random을 쓰면 캡처 이미지가 매번 달라진다.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
