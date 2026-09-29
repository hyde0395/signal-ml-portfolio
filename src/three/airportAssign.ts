// 공항 불빛을 점 구름의 점에 하나씩 배정해 셰이더 속성 버퍼를 만든다(설계 2026-09-28 §4.5).
// 신호 점(kind 0)부터 쓴다 — 첫 화면에서 ①로 넘어가면 불빛 하나하나가 그 점의 지형 자리(밝은 신호 점)로 옮겨 가
// "불빛이 곧 데이터"가 된다. 모자라면 잡음 점(kind 1). 제거 레이어(kind 2)는 차트 3 전용이라 쓰지 않는다.
// 이륙 비행기(설계 2026-09-29 §7) 점도 여기서 먼저 떼어 둔다 — 같은 속성(aAirport·aAirStyle)을 쓰고 x = 2로 구분한다.
import type { AirLight } from './airport';
import type { PlaneDot } from './plane';

export type AirportBuffers = {
  pos: Float32Array;    // 점마다 공항 자리(xyz), 비행기 점이면 비행기 로컬 좌표. 배정 안 된 점은 0
  style: Float32Array;  // 점마다 (1 불빛 · 2 비행기 · 0 없음, 색 번호, 크기 배율(비행기 0), 켜지는 순서 · 비행기는 흩어짐 지연)
  runS: Float32Array;   // 점마다 활주로 거리(m, 신호 물결), 아니면 -1
  assigned: number;     // 불빛을 받은 점 수
  plane: number;        // 비행기 점 수
};

export function assignAirport(lights: AirLight[], kind: Float32Array, plane: readonly PlaneDot[] = []): AirportBuffers {
  const n = kind.length;
  const out: AirportBuffers = { pos: new Float32Array(n * 3), style: new Float32Array(n * 4), runS: new Float32Array(n).fill(-1), assigned: 0, plane: 0 };
  const signal: number[] = [];
  for (let i = 0; i < n; i++) if (kind[i] < 0.5) signal.push(i);
  // 비행기 점은 신호 점 전체에서 고르게 뽑는다: 흩어진 점이 ① 물결 줄 전체로 퍼져 들어가 줄의 한 칸이 된다
  // (시안: 비행기 몫 칸을 격자 전체에 고르게). 잡음 점을 쓰면 ①에서 잡음이 숨겨져(noise 0) 내려앉자마자 사라진다.
  // 신호 점은 불빛보다 많아(2,070 대 약 1,300, 휴대폰은 불빛 절반) 불빛 자리를 뺏지 않는다
  const taken = new Set<number>();
  const np = Math.min(plane.length, signal.length);
  const picked: number[] = [];
  for (let k = 0; k < np; k++) picked.push(signal[Math.floor(((k + 0.5) * signal.length) / np)]);
  // 뽑은 칸을 시드 난수로 섞은 뒤 비행기 점과 짝짓는다. 신호 점은 남은 일수 순으로 늘어서 있고 비행기 점은 동체 → 날개
  // → 꼬리 순이라, 그대로 짝지으면 동체가 물결 한쪽 절반에만 내려앉았다(시안 의도: 무작위 칸). 시드 고정 = 대체 이미지 불변
  let seed = 13;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let k = np - 1; k > 0; k--) {
    const j = Math.floor(rnd() * (k + 1));
    [picked[k], picked[j]] = [picked[j], picked[k]];
  }
  for (let k = 0; k < np; k++) {
    const i = picked[k], d = plane[k];
    out.pos.set(d.pos, i * 3);
    out.style.set([2, d.tone, 0, d.delay], i * 4);
    taken.add(i);
  }
  out.plane = np;
  const order = signal.filter((i) => !taken.has(i));
  for (let i = 0; i < n; i++) if (kind[i] > 0.5 && kind[i] < 1.5) order.push(i);
  const m = Math.min(lights.length, order.length);
  for (let j = 0; j < m; j++) {
    const i = order[j], l = lights[j];
    out.pos.set(l.pos, i * 3);
    out.style.set([1, l.tone, l.size, l.ord], i * 4);
    out.runS[i] = l.runS;
  }
  out.assigned = m;
  return out;
}
