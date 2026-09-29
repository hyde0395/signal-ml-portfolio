// 이륙하는 점 비행기(설계 2026-09-29 §7, 시안 A `docs/superpowers/mockups/2026-09-29-takeoff/takeoff.html`):
// 비행기 모양(점 232개), 스크롤 → 진행도 p, 이륙 경로 자세, 흩어짐 진행, 카메라 따라가기를 순수 함수로 둔다.
// React·three에 의존하지 않는다 — TerrainPoints가 매 프레임 planePose로 uPlane 행렬을, TerrainScene이 카메라 목표점을 만든다.
import { K, RUNWAY, runwayPoint } from './airport';

// 진행도 p는 시안의 "스크롤 비율" 눈금을 그대로 쓴다(시안 단계 값을 옮겨 적지 않고 같은 숫자로 비교하려고).
// 사이트 스크롤과의 대응(takeoffProgress): 첫 화면 내려앉기 0 → y0(0.9·화면 높이) = 시안 0 → 0.30(내려앉기),
// 전환 y0 → y1(① 윗변이 화면 위 20%) = 시안 0.30 → 0.96(불빛 → 지형 → ① 넓은 카메라), 그 뒤 1(끝).
// 시안 단계: 굴러가기 0.02 → 0.36(0.19에 바퀴가 뜸), 흩어짐 0.26 → 0.54, 불빛 → 지형 0.36 → 0.72
export const PLANE = {
  landEnd: 0.3, handoffEnd: 0.96,
  take0: 0.02, take1: 0.36, disp0: 0.26, disp1: 0.54, m0: 0.36, m1: 0.72,
  followYaw: 0.35, followPitch: 0.3,
} as const;

export type PlaneDot = { pos: [number, number, number]; tone: number; delay: number };

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const sstep = (a: number, b: number, v: number) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const ease = (t: number) => 1 - Math.pow(1 - t, 4); // 시안 quart.out

// 비행기 점(로컬 좌표: x = 앞(u), y = 오른쪽 날개(v), z = 위, 사이트 단위 = 미터 × K). 시안의 협동체 비례를
// 1.7배(길이 약 75m, 날개폭 약 60m — 대형기) 키운 값 그대로. 색 번호는 공항 색(AIR_TONE) 1 점 파랑, 3 흰색.
// delay(흩어짐 지연 0..0.52)도 시안 식 그대로 — 무작위 55% + 동체 위치 45%(꼬리 쪽이 먼저 떨어진다).
// 시드 난수라 매번 같다(대체 이미지가 같게)
export function planeShape(): PlaneDot[] {
  const PS = 1.7, dots: { u: number; v: number; y: number; tone: number }[] = [];
  const pp = (u: number, v: number, y: number, tone = 1) => dots.push({ u: u * PS, v: v * PS, y: y * PS, tone });
  // 동체: 고리마다 점 4개(위·양옆·아래), 앞은 둥글게, 꼬리는 좁아지며 올라간다
  for (let u = -22; u <= 22.01; u += 1.6) {
    const r = u > 15 ? 2.2 * Math.sqrt(Math.max(0, 1 - ((u - 15) / 7.4) ** 2)) : u < -13 ? 2.2 * (1 - ((-13 - u) / 9) * 0.7) : 2.2;
    const yc = 2.8 + (u < -13 ? (-13 - u) * 0.16 : 0);
    if (r < 0.35) { pp(u, 0, yc, 3); continue; }
    pp(u, 0, yc + r); pp(u, -r, yc); pp(u, r, yc); pp(u, 0, yc - r);
  }
  for (const sd of [-1, 1]) {
    for (let i = 0; i <= 13; i++) { const t = i / 13; pp(lerp(4, -7, t), sd * lerp(2.2, 17.5, t), 1.9 + t * 1.4, t > 0.9 ? 3 : 1); } // 앞전(끝은 흰 불)
    for (let i = 0; i <= 10; i++) { const t = i / 10; pp(lerp(-5, -9.5, t), sd * lerp(2.2, 17.5, t), 1.9 + t * 1.4); }             // 뒷전
    for (let i = 1; i <= 7; i++) { const t = i / 8; pp(lerp(-0.5, -8.2, t), sd * lerp(2.2, 17.5, t), 1.95 + t * 1.4); }            // 날개 가운데 줄
    for (const du of [3.2, 1.2, -0.8]) for (const a of [0, 2.1, 4.2]) pp(du, sd * (6.5 + Math.sin(a) * 0.9), 0.9 + Math.cos(a) * 0.9); // 엔진(시안은 sd·6.5 + sin — 좌우 거울이 되게 sd를 밖으로)
    for (let i = 0; i <= 6; i++) { const t = i / 6; pp(lerp(-16.5, -20.5, t), sd * lerp(1, 7, t), 5.2); }                            // 수평 꼬리날개
    for (let i = 1; i <= 4; i++) { const t = i / 5; pp(lerp(-20, -21.8, t), sd * lerp(1, 7, t), 5.2); }
  }
  for (let i = 0; i <= 7; i++) { const t = i / 7; pp(lerp(-15, -20.3, t), 0, lerp(4.9, 12.4, t)); }                                 // 수직 꼬리날개
  for (let i = 0; i <= 5; i++) { const t = i / 5; pp(lerp(-20.5, -22.6, t), 0, lerp(5.2, 12.4, t)); }
  pp(-18.2, 0, 8.6); pp(-20, 0, 12.4, 3);
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  return dots.map((d) => ({
    pos: [d.u * K, d.v * K, d.y * K],
    tone: d.tone,
    delay: 0.52 * (0.55 * rnd() + 0.45 * clamp01((d.u / PS + 23) / 46)),
  }));
}

// 스크롤 위치 → 진행도 p(시안 눈금). y1 <= y0(전환 구간 없음)이면 내려앉기만 센다
export function takeoffProgress(scrollY: number, y0: number, y1: number): number {
  if (scrollY <= y0 || y1 <= y0) return PLANE.landEnd * clamp01(scrollY / y0);
  if (scrollY >= y1) return 1;
  return PLANE.landEnd + (PLANE.handoffEnd - PLANE.landEnd) * ((scrollY - y0) / (y1 - y0));
}

// 이륙 경로(시안 planePose, 미터): kk = 이륙 진행(0 서 있음, 0.5 바퀴가 뜸, 1 = p 0.36, 그 뒤에도 계속 오른다)
const LIFT = 0.5, SROLL = 800, V0 = (2 * SROLL) / LIFT;
const turnOf = (s: number) => 0.32 * sstep(2600, 8000, s);  // 뜬 뒤 오른쪽으로 천천히 선회 — 왼쪽 글 자리에서 멀어지게
const altOf = (s: number) => { const q = Math.max(0, s - SROLL); return (0.17 * q * q) / (q + 260); }; // 상승각 약 9.6°

export type PlanePose = {
  s: number;                          // 활주로 방향으로 간 거리(m)
  pos: [number, number, number];      // 사이트 월드 좌표
  matrix: number[];                   // 4×4 열 우선(three Matrix4.fromArray) — 로컬(앞·오른쪽·위) → 월드
};

export function planePose(p: number): PlanePose {
  const kk = Math.max(0, (p - PLANE.take0) / (PLANE.take1 - PLANE.take0));
  const s = kk <= LIFT ? SROLL * (kk / LIFT) ** 2 : SROLL + V0 * (kk - LIFT) + 3800 * (kk - LIFT) ** 2;
  // 선회로 생긴 옆 거리(200m 칸 작은 적분 — 시안과 같은 근사)
  let o = 0;
  for (let q = 2600, n = 0; q < s && n < 80; q += 200, n++) o += Math.sin(turnOf(q + 100)) * Math.min(200, s - q);
  const h = RUNWAY.angle + turnOf(s), xz = runwayPoint(s, o), y = altOf(s);
  const th = kk <= LIFT ? 0.15 * sstep(LIFT - 0.09, LIFT, kk) : lerp(0.15, 0.12, sstep(LIFT, 1, kk)); // 바퀴가 뜨기 직전 기수를 든다
  const ph = 0.3 * (sstep(2800, 4800, s) - sstep(6500, 9500, s));                                      // 선회하는 동안만 살짝 기운다
  const F0 = [Math.sin(h), 0, Math.cos(h)], R0 = [Math.cos(h), 0, -Math.sin(h)];
  const F = [F0[0] * Math.cos(th), Math.sin(th), F0[2] * Math.cos(th)];
  const U = [-F0[0] * Math.sin(th), Math.cos(th), -F0[2] * Math.sin(th)];
  const R = R0.map((v, i) => v * Math.cos(ph) - U[i] * Math.sin(ph));
  const U2 = U.map((v, i) => v * Math.cos(ph) + R0[i] * Math.sin(ph));
  // 시안 좌표(+z 앞) → 사이트(−z 앞): z 성분만 뒤집는다(airport.ts toWorld와 같은 규칙). 로컬 좌표는 이미 × K
  const pos: [number, number, number] = [xz[0] * K, y * K, -xz[1] * K];
  const col = (v: number[]) => [v[0], v[1], -v[2], 0];
  return { s, pos, matrix: [...col(F), ...col(R), ...col(U2), pos[0], pos[1], pos[2], 1] };
}

// 흩어짐 진행(셰이더 uPlaneGo): 점마다 delay만큼 늦게 0.45 동안 지형 자리로 간다(셰이더)
export function planeScatter(p: number): number {
  return clamp01((p - PLANE.disp0) / (PLANE.disp1 - PLANE.disp0));
}

// 카메라가 비행기를 따라가는 세기(0..1): 굴러가기 시작하면 켜지고, 불빛이 지형으로 넘어가며(시안 m) 풀린다 —
// p ≥ 0.72에서 0이라 ① 카메라 C는 그대로 도착한다
export function planeFollow(p: number): number {
  return sstep(0.04, 0.22, p) * (1 - ease(clamp01((p - PLANE.m0) / (PLANE.m1 - PLANE.m0))));
}

// 카메라에서 목표점을 보던 방향을 점 쪽으로 방향(좌우) wYaw, 높이(위아래) wPitch만큼 돌린 새 목표점.
// 카메라~목표점 거리는 그대로(카메라가 위치를 옮기지 않고 고개만 돌린다). 방향 차이는 짧은 쪽으로 감는다
export function lookToward(
  cam: readonly number[], tgt: readonly number[], pt: readonly number[], wYaw: number, wPitch: number,
): [number, number, number] {
  if (wYaw === 0 && wPitch === 0) return [tgt[0], tgt[1], tgt[2]];
  const angles = (d: number[]) => [Math.atan2(d[0], -d[2]), Math.atan2(d[1], Math.hypot(d[0], d[2]))];
  const d = [tgt[0] - cam[0], tgt[1] - cam[1], tgt[2] - cam[2]], e = [pt[0] - cam[0], pt[1] - cam[1], pt[2] - cam[2]];
  const [ya, pa] = angles(d), [yb, pb] = angles(e);
  let dy = yb - ya;
  dy -= Math.round(dy / (2 * Math.PI)) * 2 * Math.PI;
  const yaw = ya + dy * wYaw, pitch = pa + (pb - pa) * wPitch, r = Math.hypot(d[0], d[1], d[2]);
  return [cam[0] + Math.sin(yaw) * Math.cos(pitch) * r, cam[1] + Math.sin(pitch) * r, cam[2] - Math.cos(yaw) * Math.cos(pitch) * r];
}
