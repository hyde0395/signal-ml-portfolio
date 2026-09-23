// 3D 장면 데이터: terrain/map JSON을 zod로 검사하고, 점 하나당 목표 좌표(지형·지도·흩어짐)를
// 담은 Float32Array로 바꾼다. React·three에 의존하지 않는 순수 모듈이라 단위 테스트가 쉽다.
import { z } from 'zod';

const ints = z.array(z.number().int());
const layer = z.object({ dtd: ints, date: ints, pct: ints });
const curveLayer = z.object({ dtd: ints, pct: ints }); // 칸이 아니라 예약 시점 하나짜리 값이라 date가 없다

export const terrainSchema = z.object({
  asOf: z.string(),
  maxDtd: z.number().int().positive(),
  clip: z.object({ min: z.number(), max: z.number() }),
  dates: z.array(z.string()).min(2),
  holiday: ints,
  signal: layer,
  noise: layer,
  removed: layer,
  curve: curveLayer,
});
export const mapSchema = z.object({
  bbox: z.array(z.number()).length(4),
  coast: ints.min(4), // buildPointCloud에서 k / (length - 1)로 나누고 순환 배정하므로 최소 2 점(4개 원소) 필요
  routes: z.array(z.object({ from: z.string(), to: z.string(), pts: ints.min(4) })),
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
// 해안선 인덱스를 고를 때 쓰는 황금비(약 0.618). i가 0부터 늘어날 때 (i*GOLDEN)%1이 [0,1)을
// 거의 균등하게(저불일치) 훑으므로, i의 "어느 연속 구간"을 뽑아도 해안선 전체에 고르게 퍼진다.
const GOLDEN_RATIO = 0.6180339887498949;

// 예약 곡선(curve, 3-2 인사이트 장면 전용) 위치 상수.
// z: 지형 상자의 z 범위는 [-10, 10](좌표계 문서)인데, 10.5로 살짝 더 앞(카메라 쪽, "늦은 출발일" 방향
// 너머)에 두어 지형과 안 겹치면서 카메라 바로 앞을 가로지르는 "선"처럼 보이게 한다.
const CURVE_Z = 10.5;
// heightPerPct: 지형은 %당 0.04인데, 예약 곡선의 진폭(±8%p 안팎)은 출발일 간 가격차(−37~+63%)에
// 비하면 작아서 지형과 같은 배율로 그리면 거의 평평해 보인다. 3배(0.12)로 키워 U자를 눈에 띄게 한다.
const CURVE_HEIGHT_PER_PCT = 0.12;
const CURVE_POINTS_PER_DTD = 4;  // 점 하나로는 안 보여서 dtd마다 여러 점을 찍어 선처럼 보이게 한다
const CURVE_X_JITTER = 0.05;     // 같은 dtd의 점들이 겹치지 않을 만큼만 x를 흔든다

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
  // 신호 → 잡음 → 제거 → 예약 곡선 순서로 한 배열에 담는다(Points 하나로 그리기 위해).
  const rows: { dtd: number; date: number; pct: number; kind: number }[] = [];
  const push = (l: Terrain['signal'], kind: number, stride = 1) => {
    for (let i = 0; i < l.pct.length; i += stride) rows.push({ dtd: l.dtd[i], date: l.date[i], pct: l.pct[i], kind });
  };
  push(t.signal, 0);
  push(t.noise, 1, Math.max(1, Math.floor(opts.noiseStride)));
  push(t.removed, 2);
  // 예약 곡선(kind 3): 칸이 아니라 dtd 하나짜리 값이라 date가 없다(-1은 "해당 없음").
  // 점 하나로는 선처럼 안 보여 dtd마다 여러 점을 찍는다(x는 forEach에서 흔든다).
  for (let i = 0; i < t.curve.pct.length; i++) {
    for (let j = 0; j < CURVE_POINTS_PER_DTD; j++) rows.push({ dtd: t.curve.dtd[i], date: -1, pct: t.curve.pct[i], kind: 3 });
  }

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
    out.kind[i] = r.kind;
    out.holiday[i] = holidays.has(r.date) ? 1 : 0;

    if (r.kind === 3) {
      // 예약 곡선은 dtd만 있고 출발일(z)은 없으므로 지형 앞 가장자리 한 z(CURVE_Z)에 고정하고,
      // 지도 목표 = 지형 목표로 둬서 uMap이 커져도 안 움직이고 알파만 uCurve로 사라지게 한다(셰이더에서 처리).
      const x = ((t.maxDtd - r.dtd) / t.maxDtd - 0.5) * WORLD.width + (rand() - 0.5) * CURVE_X_JITTER;
      const y = (r.pct / 10) * CURVE_HEIGHT_PER_PCT;
      const p: [number, number, number] = [round(x), round(y), CURVE_Z];
      out.terrain.set(p, i * 3);
      out.map.set(p, i * 3);
      // 흩어짐 좌표도 채워야 한다(모이는 애니메이션의 시작점)
      const u0 = rand() * 2 - 1, th0 = rand() * Math.PI * 2, rr0 = 14 * Math.cbrt(rand());
      const s0 = Math.sqrt(1 - u0 * u0);
      out.scatter.set([rr0 * s0 * Math.cos(th0), rr0 * u0, rr0 * s0 * Math.sin(th0)], i * 3);
      return;
    }

    out.terrain.set(terrainPosition(r.dtd, r.date, r.pct, t.maxDtd, t.dates.length), i * 3);

    // 지도 목표: 점 수가 해안선 샘플보다 많으므로 배정하고, 같은 자리에 겹치지 않게 살짝 흔든다.
    // i(전체 인덱스)를 그대로 coast.length로 나눈 나머지를 쓰면 신호(밝은 점, 2,070개)가 항상
    // coast[0..2069]에만 몰려 해안선 뒤쪽 절반(한반도가 있는 구간)은 잡음(흐린 점)만 받는다
    // (라운드 3에서 발견한 결함: 한반도가 거의 안 보임). 황금비 저불일치 수열로 인덱스를 고르면
    // i가 0부터 몇 개만 지나도 [0, coast.length) 전체에 고르게 퍼져, 어느 레이어든 해안선 전체를 덮는다.
    const jitter = () => (rand() - 0.5) * 0.06;
    if (routes.length > 0 && i % ROUTE_SHARE === 0) {
      const line = routes[(i / ROUTE_SHARE) % routes.length | 0];
      const k = Math.floor(rand() * line.length);
      const [x, zz] = mapPosition(line[k][0], line[k][1]);
      const arc = Math.sin((k / (line.length - 1)) * Math.PI) * ROUTE_ARC_HEIGHT;
      out.map.set([x + jitter(), arc, zz + jitter()], i * 3);
      out.route[i] = 1;
    } else {
      const coastIdx = Math.floor(((i * GOLDEN_RATIO) % 1) * coast.length);
      const [lon, lat] = coast[coastIdx];
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
