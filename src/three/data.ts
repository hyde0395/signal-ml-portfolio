// 3D 장면 데이터: terrain/map JSON을 zod로 검사하고, 점 하나당 목표 좌표(지형·지도·흩어짐)와 출발일 번호를
// 담은 Float32Array로 바꾼다. React·three에 의존하지 않는 순수 모듈이라 단위 테스트가 쉽다.
// (계획 5-2: 예약 곡선·예측 구간 띠 레이어는 ④ 차트의 점 배치로 바뀌어 지웠다)
import { z } from 'zod';

const ints = z.array(z.number().int());
const layer = z.object({ dtd: ints, date: ints, pct: ints });

// terrain.json의 curve 필드는 export_terrain.py가 지표 대조용으로 계속 만들지만 사이트는 쓰지 않는다
// (z.object는 모르는 키를 버린다)
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
  coast: ints.min(4), // 선분 하나라도 있어야 해안선을 다시 뽑을 수 있다(최소 2 점 = 4개 원소)
  routes: z.array(z.object({ from: z.string(), to: z.string(), pts: ints.min(4) })),
  airports: z.array(z.object({ code: z.string(), lon: z.number(), lat: z.number() })),
});
export type Terrain = z.infer<typeof terrainSchema>;
export type MapData = z.infer<typeof mapSchema>;

// 좌표계는 계획 3 "좌표계" 절과 같다. 바꾸면 scenes.ts의 카메라 지점도 함께 바꿔야 한다.
export const WORLD = { width: 16, depth: 20, heightPerPct: 0.04 } as const;
const MAP_CENTER = { lon: 135.25, lat: 37.8 };
const MAP_SCALE = 0.75;
const MAP_COS = Math.cos((MAP_CENTER.lat * Math.PI) / 180);
const ROUTE_ARC_HEIGHT = 1.5;   // 지도 장면에서 노선 궤적이 떠오르는 높이
// 지도 가는 실선(설계 2026-09-29 §1): 해안선을 세계 좌표 step 간격으로 다시 뽑고(약 2,800점), 노선마다 routePts개 호.
// 흔들지 않는다 — 점 수가 해안선 샘플보다 많아 흔들어 겹겹이 쌓던 것이 굵고 흐릿한 띠로 보였다(사용자 지적 2026-09-29)
export const MAP_LINE = { step: 0.035, routePts: 170, breakDeg: 0.5 } as const;

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
  kind: Float32Array;    // 0 신호, 1 잡음, 2 제거
  holiday: Float32Array;
  route: Float32Array;    // 1 노선, 0 해안선, −1 지도에서 안 씀(셰이더가 지도 장면에서 숨긴다)
  date: Int16Array;      // 지형 출발일 번호(terrain.dates의 인덱스). ④ 출발일 점 그래프가 출발일마다 점을 모은다
  wave: Float32Array;    // ① 물결 줄 자리(buildWave)
  waveHoliday: Float32Array; // ① 물결 줄에서 호박색으로 칠할 점이면 1
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
    date: new Int16Array(count),
    wave: new Float32Array(count * 3),
    waveHoliday: new Float32Array(count),
  };

  const coastPts = resampleLines(m.coast, MAP_LINE.step);
  const routePts: [number, number, number][] = [];
  for (const r of m.routes) {
    const line = pairs(r.pts);
    for (let k = 0; k < MAP_LINE.routePts; k++) {
      const f = k / (MAP_LINE.routePts - 1);
      // 원본 샘플(노선마다 약 150개) 사이를 보간한다 — 반올림한 인덱스를 쓰면 170점 중 약 20점이 같은 자리에 겹쳐 밝게 뭉쳤다(검토 2026-09-29)
      const fi = f * (line.length - 1), j = Math.min(line.length - 2, Math.floor(fi)), w = fi - j;
      const lon = line[j][0] + (line[j + 1][0] - line[j][0]) * w, lat = line[j][1] + (line[j + 1][1] - line[j][1]) * w;
      const [x, zz] = mapPosition(lon, lat);
      routePts.push([x, round(Math.sin(f * Math.PI) * ROUTE_ARC_HEIGHT), zz]);
    }
  }
  const rand = mulberry32(opts.seed ?? 1);

  rows.forEach((r, i) => {
    out.kind[i] = r.kind;
    out.date[i] = r.date;
    out.holiday[i] = holidays.has(r.date) ? 1 : 0;
    out.terrain.set(terrainPosition(r.dtd, r.date, r.pct, t.maxDtd, t.dates.length), i * 3);

    // 지도 자리: 앞쪽 점부터 해안선 → 노선. 남는 점은 지도 장면에서 숨긴다(route −1, 자리는 지형 그대로 — 셰이더가
    // 알파 0으로). 신호·잡음을 가리지 않는다 — 지도에서는 모든 점을 같은 밝기로 그린다(pointStyle MAP_POINT)
    if (i < coastPts.length) {
      out.map.set([coastPts[i][0], 0, coastPts[i][1]], i * 3);
    } else if (i < coastPts.length + routePts.length) {
      out.map.set(routePts[i - coastPts.length], i * 3);
      out.route[i] = 1;
    } else {
      out.map.set(out.terrain.subarray(i * 3, i * 3 + 3), i * 3);
      out.route[i] = -1;
    }

    // 흩어짐: 반지름 14 구 안 균일 분포(시드 고정 → 캡처 이미지가 매번 같다)
    const u = rand() * 2 - 1, th = rand() * Math.PI * 2, rr = 14 * Math.cbrt(rand());
    const s = Math.sqrt(1 - u * u);
    out.scatter.set([rr * s * Math.cos(th), rr * u, rr * s * Math.sin(th)], i * 3);
  });
  const wave = buildWave(t, rows, out.terrain);
  out.wave = wave.pos;
  out.waveHoliday = wave.holiday;
  return out;
}

// ① 물결 줄(설계 2026-09-29 §6, 사용자 선택 C): 공항 시안의 ①처럼 출발일마다 한 줄씩 가지런히 늘어선 무늬를
// 실제 데이터로 만든다. 신호 점을 출발일 순으로 rows줄 × C칸 격자에 하나씩 놓고, 높이 = 남은 일수별 평균 곡선 B
// + 줄의 출발일 묶음 평균 편차 O(rowGain배) + 잔물결. 흩어진 덩어리 대신 은은한 줄무늬로 읽히게 하려는 것이다.
// 평활(sigma)은 줄이 들쭉날쭉하지 않고 곡선으로 보이게, 호박색 규칙(holFrac·minOffset)은 몇 줄만 은은하게 두려고
// 시안에서 맞춘 값이다(지금 데이터에서 두 줄)
export const WAVE = { rows: 30, rowGain: 0.7, ripple: 1.2, sigmaDtd: 6, sigmaRow: 1.2, holFrac: 0.5, minOffset: 4 } as const;

export type WavePoint = { dtd: number; date: number; pct: number; kind: number };
// pos: 점마다 물결 자리(xyz), holiday: 호박색이면 1. 나머지는 검사용(offset은 rowGain을 곱한 O, 단위 %)
export type Wave = { pos: Float32Array; holiday: Float32Array; cols: number; base: number[]; offset: number[]; holidayRows: number[] };

export function buildWave(t: Terrain, pts: readonly WavePoint[], terrain: Float32Array): Wave {
  const R = WAVE.rows, nD = t.dates.length, maxDtd = t.maxDtd;
  const pos = new Float32Array(pts.length * 3), holiday = new Float32Array(pts.length);
  // 잡음·제거 점은 지형 자리 그대로 — ①에서는 숨지만(noise 0) 다른 장면으로 넘어갈 때 엉뚱한 곳에서 날아오지 않게
  pos.set(terrain.subarray(0, pts.length * 3));
  const sig = pts.map((p, i) => ({ ...p, i })).filter((p) => p.kind === 0);
  const C = Math.max(2, Math.ceil(sig.length / R));

  const sum = new Float64Array(maxDtd + 1), cnt = new Float64Array(maxDtd + 1);
  for (const p of sig) { sum[p.dtd] += p.pct / 10; cnt[p.dtd]++; }
  const base = Array.from({ length: maxDtd + 1 }, (_, d) =>
    gaussMean(maxDtd + 1, d, WAVE.sigmaDtd, (k) => cnt[k], (k) => sum[k] / cnt[k]));

  // 줄 묶음은 출발일 번호를 R등분한 것(점을 놓는 줄과 같은 순서)
  const bucket = (date: number) => Math.min(R - 1, Math.floor((date / nD) * R));
  const devSum = new Float64Array(R), devCnt = new Float64Array(R), holSum = new Float64Array(R), dateCnt = new Float64Array(R);
  for (const p of sig) { const b = bucket(p.date); devSum[b] += p.pct / 10 - base[p.dtd]; devCnt[b]++; }
  const hs = new Set(t.holiday);
  for (let d = 0; d < nD; d++) { const b = bucket(d); holSum[b] += hs.has(d) ? 1 : 0; dateCnt[b]++; }
  // 줄 사이 평활은 점 수가 아니라 줄 하나를 한 표로 센다(점이 적은 줄도 이웃과 같은 무게로 이어지게)
  const offset = Array.from({ length: R }, (_, r) =>
    gaussMean(R, r, WAVE.sigmaRow, (k) => (devCnt[k] ? 1 : 0), (k) => devSum[k] / devCnt[k]) * WAVE.rowGain);

  const isHol = offset.map((o, r) => dateCnt[r] > 0 && holSum[r] / dateCnt[r] >= WAVE.holFrac && o > WAVE.minOffset);
  const holidayRows: number[] = [];
  for (let r = 0; r < R;) {
    if (!isHol[r]) { r++; continue; }
    let best = r;
    for (; r < R && isHol[r]; r++) if (offset[r] > offset[best]) best = r;
    holidayRows.push(best);
  }

  sig.sort((a, b) => a.date - b.date || b.dtd - a.dtd);
  sig.forEach((p, k) => {
    const r = Math.floor(k / C), c = k % C, u = c / (C - 1);
    const d = Math.round(maxDtd * (1 - u)); // 칸의 남은 일수: 왼쪽 = 먼 예약(지형과 같은 방향)
    const pct = base[d] + offset[r] + Math.sin(r * 1.3 + c * 0.21) * WAVE.ripple;
    pos.set([round((u - 0.5) * WORLD.width), round(pct * WORLD.heightPerPct), round((r / (R - 1) - 0.5) * WORLD.depth)], p.i * 3);
    holiday[p.i] = holidayRows.includes(r) ? 1 : 0;
  });
  return { pos, holiday, cols: C, base, offset, holidayRows };
}

// 가우스 가중 평균: 칸 k(0..n−1)의 값 value(k)를 무게 weight(k)·exp(−(k−at)²/2σ²)로 섞는다. 무게 0인 칸은 건너뛴다
function gaussMean(n: number, at: number, sigma: number, weight: (k: number) => number, value: (k: number) => number): number {
  let a = 0, w = 0;
  for (let k = 0; k < n; k++) {
    const wk = weight(k);
    if (!wk) continue;
    const g = Math.exp(-((k - at) ** 2) / (2 * sigma * sigma)) * wk;
    a += g * value(k);
    w += g;
  }
  return w ? a / w : 0;
}

// 종류·공휴일·노선·물결 공휴일을 vec4 하나(aMeta)로 묶는다 — 따로 두면 aWave와 함께 정점 속성이
// WebGL 공통 한계 16개를 넘어 셰이더 링크가 실패한다(shaders.ts 주석). 셰이더가 x·y·z·w 순서로 읽는다
export function packMeta(cloud: Pick<PointCloud, 'count' | 'kind' | 'holiday' | 'route' | 'waveHoliday'>): Float32Array {
  const meta = new Float32Array(cloud.count * 4);
  for (let i = 0; i < cloud.count; i++) {
    meta[i * 4] = cloud.kind[i];
    meta[i * 4 + 1] = cloud.holiday[i];
    meta[i * 4 + 2] = cloud.route[i];
    meta[i * 4 + 3] = cloud.waveHoliday[i];
  }
  return meta;
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

// 평평한 [경도×100, 위도×100, …] 목록 → 이어진 선분끼리 나눠(점 사이가 breakDeg보다 멀면 새 선 — 섬·대륙이 선으로
// 이어지지 않게) 세계 좌표(x, z)에서 step 간격으로 다시 뽑은 점들
export function resampleLines(flat: number[], step: number): [number, number][] {
  const pts = pairs(flat);
  const out: [number, number][] = [];
  let carry = 0;
  for (let i = 0; i + 1 < pts.length; i++) {
    const [a, b] = [pts[i], pts[i + 1]];
    if (Math.hypot(a[0] - b[0], a[1] - b[1]) > MAP_LINE.breakDeg) { carry = 0; continue; }
    const [ax, az] = mapPosition(a[0], a[1]), [bx, bz] = mapPosition(b[0], b[1]);
    const len = Math.hypot(bx - ax, bz - az);
    let t = carry;
    for (; t < len; t += step) out.push([round(ax + ((bx - ax) * t) / len), round(az + ((bz - az) * t) / len)]);
    carry = t - len;
  }
  return out;
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
