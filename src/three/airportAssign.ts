// 공항 불빛을 점 구름의 점에 하나씩 배정해 셰이더 속성 버퍼를 만든다(설계 2026-09-28 §4.5).
// 신호 점(kind 0)부터 쓴다 — 첫 화면에서 ①로 넘어가면 불빛 하나하나가 그 점의 지형 자리(밝은 신호 점)로 옮겨 가
// "불빛이 곧 데이터"가 된다. 모자라면 잡음 점(kind 1). 제거 레이어(kind 2)는 차트 3 전용이라 쓰지 않는다.
import type { AirLight } from './airport';

export type AirportBuffers = {
  pos: Float32Array;    // 점마다 공항 자리(xyz). 배정 안 된 점은 0
  style: Float32Array;  // 점마다 (알파 1/0, 색 번호, 크기 배율, 켜지는 순서)
  runS: Float32Array;   // 점마다 활주로 거리(m, 신호 물결), 아니면 -1
  assigned: number;
};

export function assignAirport(lights: AirLight[], kind: Float32Array): AirportBuffers {
  const n = kind.length;
  const out: AirportBuffers = { pos: new Float32Array(n * 3), style: new Float32Array(n * 4), runS: new Float32Array(n).fill(-1), assigned: 0 };
  const order: number[] = [];
  for (let i = 0; i < n; i++) if (kind[i] < 0.5) order.push(i);
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
