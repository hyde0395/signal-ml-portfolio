// 머리말·① 배경 "잡음 → 신호"(설계 2026-10-01, 시안 docs/superpowers/mockups/2026-10-01/noise-signal.html)의 순수 함수:
// 단계 시간표, U자 곡선 화면 배치, 점 배정. React·three에 의존하지 않는다 — 셰이더(shaders.ts)가 같은 식을 GLSL로 쓰고
// TerrainPoints가 배치를 uniform으로 넣는다. WebGL 결과는 단위 테스트로 잴 수 없어 식을 여기 따로 둔다.

// 비행기 시계(plane.ts, 6-6) 눈금을 이어 쓴다: 이륙·전환이 0 → 1, 신호 단계가 1 → 1.8. 0.8폭 = 최대 속도 0.28/초로
// 약 2.9초 — 시안(7초 자동 재생)보다 짧지만, 빠른 휠 한 번이면 이륙(약 3.4초)에 이어서 나오므로 더 길면 ① 글 뒤에서
// 한참 기다리게 된다. 느리게 스크롤하면 스크롤을 그대로 따른다.
// 단계 값(q 0..1)은 시안 그대로: 0.25까지 잡음만, 구간 점이 0.035씩 늦게 0.12 동안 켜짐, 0.5 → 0.83 선, 0.82 → 1 가라앉음.
// 시안은 점 12개·0.024 간격이었다 — 점 8개라 간격을 늘려 "하나씩"이 읽히게 했다
export const SIGNAL = {
  start: 1, end: 1.8,
  lit0: 0.25, litStep: 0.035, litDur: 0.12,
  line0: 0.5, line1: 0.83,
  settle0: 0.82,
} as const;

// 잡음 밭 점 수와 선 점 수. 시안 밀도(16:9 1200px 판에 2,200개 ≈ 0.0027개/px²)를 1440×900에 맞추면 약 3,500,
// 390×844는 약 900 — 세로 화면은 공항 불빛·비행기 점(약 880개)이 모두 들어가야 해서 1,300
export const FIELD = {
  desktop: { target: 3400, line: 150 },
  portrait: { target: 1300, line: 100 },
} as const;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
export const expoOut = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));

// 시계 값 p → 신호 단계 q(0..1)
export function signalStage(p: number): number {
  return clamp01((p - SIGNAL.start) / (SIGNAL.end - SIGNAL.start));
}
// 구간 점 i가 켜진 정도(0..1, expo.out): 켜지며 근처 잡음 자리 → 제자리, 색이 호박으로
export function binLit(q: number, i: number): number {
  return expoOut(clamp01((q - SIGNAL.lit0 - i * SIGNAL.litStep) / SIGNAL.litDur));
}
// 선이 그어진 머리(곡선 호 길이 비율 0..1). 일정한 속도 — 머리 뒤의 점은 셰이더가 짧게 키우며 나타나게 한다
export function lineHead(q: number): number {
  return clamp01((q - SIGNAL.line0) / (SIGNAL.line1 - SIGNAL.line0));
}
// 잡음이 가라앉은 정도(0..1): 떨림 ×(1 − 0.7·s), 알파 ×(1 − 0.3·s)
export function settle(q: number): number {
  return expoOut(clamp01((q - SIGNAL.settle0) / (1 - SIGNAL.settle0)));
}

export type SignalLayout = { pts: [number, number][]; arc: number[] };

// U자 8구간의 화면 자리(NDC, x 오른쪽 +, y 위 +)와 구간 점마다의 누적 호 길이 비율.
// 가로 화면: 글은 .wrap 왼쪽 열이라 곡선은 화면 가로 53% → 93%(시안 50 → 94%를 16:10과 글 폭에 맞춤), 세로 가운데 55%,
// 1%p = 화면 높이의 1.8%(시안). 세로 화면: 글을 아래에 두므로(globals.css 머리말·①) 위쪽 16% ~ 42%에 가로 10 → 90%로 넓게.
// 호 길이는 화면 px 비율(x에 aspect를 곱함)로 잰다 — 셰이더가 선 점을 곡선 위에 고르게 놓는 데 쓴다
export function signalLayout(aspect: number, bins: readonly number[]): SignalLayout {
  const hi = Math.max(...bins), lo = Math.min(...bins), mid = (hi + lo) / 2;
  const portrait = aspect < 1;
  const pts = bins.map((v, i): [number, number] => {
    const u = i / (bins.length - 1);
    const xf = portrait ? 0.1 + 0.8 * u : 0.53 + 0.4 * u;
    const yf = portrait
      ? 0.16 + (hi - lo > 1e-6 ? ((hi - v) / (hi - lo)) * 0.26 : 0.13)
      : 0.55 - (v - mid) * 0.018;
    return [2 * xf - 1, 1 - 2 * yf];
  });
  const arc = [0];
  let len = 0;
  const SUB = 16;
  for (let j = 0; j < pts.length - 1; j++) {
    let prev = catmull(pts, j, 0);
    for (let k = 1; k <= SUB; k++) {
      const p = catmull(pts, j, k / SUB);
      len += Math.hypot((p[0] - prev[0]) * aspect, p[1] - prev[1]);
      prev = p;
    }
    arc.push(len);
  }
  return { pts, arc: arc.map((a) => a / len) };
}

// 곡선 위 점: 호 길이 비율 s(0..1) → 화면 자리. 셰이더 curveAt과 같은 식(구간 찾기 → Catmull-Rom)
export function curvePoint(L: SignalLayout, s: number): [number, number] {
  const t = clamp01(s);
  let j = 0;
  for (let k = 1; k < L.pts.length - 1; k++) if (t >= L.arc[k]) j = k;
  const w = Math.max(L.arc[j + 1] - L.arc[j], 1e-4);
  return catmull(L.pts, j, clamp01((t - L.arc[j]) / w));
}

// 균일 Catmull-Rom(양끝은 끝점을 한 번 더 쓴다): 구간 점을 지나는 부드러운 곡선 — 꺾인 선보다 U자가 매끈하게 읽힌다
function catmull(P: readonly [number, number][], j: number, t: number): [number, number] {
  const p0 = P[Math.max(j - 1, 0)], p1 = P[j], p2 = P[j + 1], p3 = P[Math.min(j + 2, P.length - 1)];
  const t2 = t * t, t3 = t2 * t;
  const f = (a: number, b: number, c: number, d: number) =>
    0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
  return [f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])];
}

export type FieldBuffers = { role: Float32Array; field: Float32Array };

// 점 배정. role(셰이더 aMeta.w): 0 밭에 없음(숨김), 1 잡음, 2 + i 구간 점 i, 10 + s 선 점(s = 호 길이 비율).
// field(셰이더 aField): 잡음 = (u, v, 깊이 d) NDC, 구간 점 = (곡선 자리에서 떨어진 du, dv, d), 선 점 = 0.
// - 공항 불빛·비행기 점(air 스타일 x > 0)은 모두 넣는다 — 흩어진 그 점이 그대로 잡음이 된다
// - 나머지 자리는 신호 → 잡음 순서(각각 시드 난수로 섞음)로 채운다. 신호 점이 먼저인 건 지형 장면들과 같은 점이 잡음이
//   되게 하려는 것뿐이다
// - 구간 점은 공항 점이 아닌 밭 점에서 — 구간 점의 밭 자리를 곡선 근처로 옮기는데, 공항 점은 흩어짐 길이 정해져 있다
// - 선 점은 밭 밖 잡음 점에서 — 선이 그어지기 전에는 보이지 않는다(미리 U자 모양으로 점이 몰려 보이지 않게)
export function buildField(o: {
  kind: Float32Array; air: Float32Array; target: number; lineCount: number; seed?: number;
}): FieldBuffers {
  const n = o.kind.length;
  const role = new Float32Array(n), field = new Float32Array(n * 3);
  const rand = mulberry32(o.seed ?? 1);
  const shuffle = (a: number[]) => {
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  };
  const isAir = (i: number) => o.air[i * 4] > 0;
  const air: number[] = [], sig: number[] = [], noise: number[] = [];
  for (let i = 0; i < n; i++) {
    if (isAir(i)) air.push(i);
    else if (o.kind[i] === 0) sig.push(i);
    else if (o.kind[i] === 1) noise.push(i);
  }
  const rest = [...shuffle(sig), ...shuffle(noise)];
  const fillCount = Math.max(8, o.target - air.length);
  const fill = rest.slice(0, fillCount);
  const outside = rest.slice(fillCount);
  for (const i of [...air, ...fill.slice(8)]) {
    role[i] = 1;
    field.set([(rand() * 2 - 1) * 1.03, (rand() * 2 - 1) * 1.03, rand()], i * 3);
  }
  fill.slice(0, 8).forEach((i, b) => {
    role[i] = 2 + b;
    // 시안: 곡선 자리에서 가장 가까운 "가까운 쪽(깊이 > 0.6)" 잡음 점이 끌려온다 — 그 거리를 흉내 낸다
    const r = 0.06 + 0.1 * rand(), th = rand() * Math.PI * 2;
    field.set([Math.cos(th) * r, Math.sin(th) * r, 0.6 + 0.4 * rand()], i * 3);
  });
  const lineFrom = [...outside.filter((i) => o.kind[i] === 1), ...outside.filter((i) => o.kind[i] !== 1)];
  const L = Math.min(o.lineCount, lineFrom.length);
  for (let k = 0; k < L; k++) role[lineFrom[k]] = 10 + (L > 1 ? k / (L - 1) : 0);
  return { role, field };
}

// data.ts와 같은 작은 시드 난수(캡처 이미지가 매번 같게)
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
