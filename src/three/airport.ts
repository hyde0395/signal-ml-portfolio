// 밤의 공항 첫 화면(설계 2026-09-28 §4) 배치: 시안(docs/superpowers/mockups/2026-09-28/01-night-airport.html)의
// 활주로·유도로·계류장·창문·도시 불빛 자리를 그대로 옮긴다. 시안은 미터 단위이고 +z를 보므로, 사이트 월드로는
// 축척 K를 곱하고 z를 뒤집는다(three.js 카메라는 −z를 본다 — 뒤집지 않으면 좌우가 바뀐다).
// React·three에 의존하지 않는 순수 모듈이다.

export const K = 0.01;
// 색 번호: 셰이더(shaders.ts airTone)와 같은 순서. 1 파랑(유도로), 2 호박(계류장), 3 흰색, 4 따뜻한 흰색
export const AIR_TONE = { blue: 1, amber: 2, white: 3, warm: 4 } as const;

export type AirKind = 'edge' | 'center' | 'thr' | 'end' | 'taxi' | 'apron' | 'win' | 'city';
// pos: 사이트 월드 좌표, size: 크기 배율, ord: 켜지는 순서(0 앞 → 1 뒤), runS: 활주로 위 거리(m, 신호 물결용), 아니면 -1
export type AirLight = { pos: [number, number, number]; tone: number; size: number; ord: number; runS: number; kind: AirKind };

// 활주로(시안과 같은 값): 방향 각 RA, 시작점 R0, 길이 RLEN, 반폭 RHALF, 평행 유도로 옆 거리 TO
export const RUNWAY = { angle: 0.62, start: [-60, 180] as [number, number], length: 3200, half: 30, taxiOffset: -190 } as const;
const RD = [Math.sin(RUNWAY.angle), Math.cos(RUNWAY.angle)];
const RN = [RD[1], -RD[0]];

// 활주로 좌표(s: 시작점에서 거리, o: 옆 거리) → 시안 평면 (x, z) 미터
export function runwayPoint(s: number, o: number): [number, number] {
  return [RUNWAY.start[0] + RD[0] * s + RN[0] * o, RUNWAY.start[1] + RD[1] * s + RN[1] * o];
}

export function toWorld(x: number, y: number, z: number): [number, number, number] {
  return [x * K, y * K, -z * K];
}

// 시안과 같은 시드 난수(Park–Miller) — 창문·도시 불빛이 매번 같은 자리에 온다(대체 이미지가 같게)
function rng(seed: number) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
}

const BUILDINGS: [number, number, number, number][] = [ // [s, o, 폭, 높이] 미터 — 활주로 건너편·먼 쪽
  [300, 520, 260, 26], [650, 560, 180, 34], [1000, 620, 420, 22], [1600, 600, 300, 30], [2100, 700, 520, 18],
  [2700, 650, 240, 28], [3000, 800, 380, 20], [1300, -1900, 520, 40], [2300, -2000, 380, 55], [3100, -2100, 600, 34],
];
const APRON: [number, number][] = [[-40, 150], [160, 110], [360, 60], [-260, 260]];
const CONNECTORS = [500, 1300, 2200];

export type Airport = {
  lights: AirLight[];
  beacon: [number, number, number];      // 빨간 경고등(화면에서 유일한 빨강, 관제탑 자리)
  approach: [number, number, number][];  // 진입등(활주로 끝 너머, 섬광이 활주로 쪽으로 달린다)
};

// stride: 휴대폰은 2(불빛 절반, 설계 §4.5). 순서대로 stride번째마다 남긴다
export function buildAirport({ stride }: { stride: number }): Airport {
  const rnd = rng(7);
  const L: AirLight[] = [];
  const add = (xz: [number, number], y: number, tone: number, kind: AirKind, size: number, ord: number, runS = -1) =>
    L.push({ pos: toWorld(xz[0], y, xz[1]), tone, size, ord: Math.min(1.1, Math.max(0, ord)), runS, kind });
  const { length: RLEN, half: RH, taxiOffset: TO } = RUNWAY;
  // 휴대폰(stride 2)은 불빛 절반(설계 §4.5). 좌우·시작줄/끝줄처럼 쌍으로 넣는 자리는 전역 인덱스로 솎으면
  // 한쪽이 통째로 사라진다 — 루프마다 걸음 수(k)로 솎고, 쌍은 같이 남기거나 같이 뺀다
  const keep = (k: number) => k % stride === 0;
  for (let s = 0, i = 0; s <= RLEN; s += 60, i++) {
    if (!keep(i)) continue;
    add(runwayPoint(s, -RH), 0.5, AIR_TONE.white, 'edge', 1, s / RLEN, s);
    add(runwayPoint(s, RH), 0.5, AIR_TONE.white, 'edge', 1, s / RLEN, s);
  }
  // 중앙등: 끝 900m는 따뜻한 흰색(실제 활주로와 같은 규칙)
  for (let s = 30, i = 0; s < RLEN; s += 18, i++) {
    if (!keep(i)) continue;
    add(runwayPoint(s, 0), 0.2, s > RLEN - 900 ? AIR_TONE.warm : AIR_TONE.white, 'center', 0.45, s / RLEN, s);
  }
  // 시작·끝 줄: 실제는 초록·빨강이지만 흰색·따뜻한 흰색으로(설계 §4.1 — 빨강은 경고등 하나뿐)
  for (let o = -RH, i = 0; o <= RH; o += 6, i++) {
    if (!keep(i)) continue;
    add(runwayPoint(0, o), 0.5, AIR_TONE.white, 'thr', 0.6, 0);
    add(runwayPoint(RLEN, o), 0.5, AIR_TONE.warm, 'end', 0.6, 1);
  }
  for (let s = -200, i = 0; s <= RLEN; s += 34, i++) {
    if (!keep(i)) continue;
    add(runwayPoint(s, TO - 11), 0.3, AIR_TONE.blue, 'taxi', 0.6, (s + 200) / RLEN);
    add(runwayPoint(s, TO + 11), 0.3, AIR_TONE.blue, 'taxi', 0.6, (s + 200) / RLEN);
  }
  for (const s0 of CONNECTORS) {
    for (let i = 0; i <= 9; i++) {
      if (!keep(i)) continue;
      const t = i / 9, o = TO + 11 + (-RH - 10 - (TO + 11)) * t, s = s0 + Math.sin((t * Math.PI) / 2) * 160;
      add(runwayPoint(s, o - 8), 0.3, AIR_TONE.blue, 'taxi', 0.55, s / RLEN);
      add(runwayPoint(s, o + 8), 0.3, AIR_TONE.blue, 'taxi', 0.55, s / RLEN);
    }
  }
  for (const p of APRON) add(p, 26, AIR_TONE.amber, 'apron', 2.2, 0); // 4개뿐이라 솎지 않는다
  // 건물: 형체 없이 창문 불빛만(설계 §4.1). 줄 = 높이/9, 칸 = 폭/14, 45%만 켠다.
  // stride는 건물 전체를 통틀어 켜진 창 중에서 솎는다(rnd() 순서는 stride와 무관하게 유지 — 같은 시드는 같은 창 자리)
  let winI = 0;
  for (const [s, o, w, h] of BUILDINGS) {
    const a = runwayPoint(s - w / 2, o), e = runwayPoint(s + w / 2, o);
    const rows = Math.max(1, Math.floor(h / 9)), cols = Math.floor(w / 14);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      if (rnd() >= 0.45) continue;
      const u = (c + 0.5) / cols, tone = rnd() < 0.2 ? AIR_TONE.white : AIR_TONE.warm;
      if (!keep(winI++)) continue;
      add([a[0] + (e[0] - a[0]) * u, a[1] + (e[1] - a[1]) * u], h * ((r + 0.5) / rows), tone, 'win', 0.8, 1.05);
    }
  }
  // 먼 도시: 지평선의 작은 반짝임
  for (let i = 0; i < 160; i++) {
    const ang = -0.9 + rnd() * 1.9, r = 9000 + rnd() * 6000;
    const y = rnd() * 40, tone = rnd() < 0.7 ? AIR_TONE.warm : AIR_TONE.white;
    if (!keep(i)) continue;
    add([Math.sin(ang) * r, Math.cos(ang) * r], y, tone, 'city', 1.3, 1.1);
  }
  const tw = runwayPoint(1500, -520);
  return {
    lights: L,
    beacon: toWorld(tw[0], 60, tw[1]),
    approach: Array.from({ length: 14 }, (_, i) => { const p = runwayPoint(RLEN + (i + 1) * 30, 0); return toWorld(p[0], 1, p[1]); }),
  };
}

// 착륙 비행기 위치(사이클 20초 중 u = 0..1): 멀리서 내려와 접지 후 감속(시안과 같은 경로). 보이지 않을 때 null
export function landingPlane(u: number): [number, number, number] | null {
  if (u >= 0.8) return null;
  const k = u / 0.8, RLEN = RUNWAY.length;
  const ease = (t: number) => 1 - Math.pow(1 - t, 4);
  const s = k < 0.6 ? RLEN + 5200 + (RLEN - 250 - (RLEN + 5200)) * (k / 0.6) : RLEN - 250 + (900 - (RLEN - 250)) * ease((k - 0.6) / 0.4);
  const [x, z] = runwayPoint(s, 0);
  return toWorld(x, Math.max(3, (s - (RLEN - 250)) * 0.052), z);
}

// 유도로를 천천히 지나가는 비행기(시안: 초당 22m, 3,000m 주기)
export function taxiPlane(t: number): [number, number, number] {
  const s = 2800 - ((t * 22) % 3000);
  const [x, z] = runwayPoint(s, RUNWAY.taxiOffset);
  return toWorld(x, 4, z);
}
