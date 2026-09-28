// 그림 판의 배치(정규화 좌표) → 3D 점 목표. 차트 장면의 카메라는 원점을 정면으로 보는 고정 위치(scenes.ts
// CHART_DISTANCE·CHART_FOV)라, 화면 px과 z=0 평면 좌표가 선형으로 대응한다. 판이 sticky로 고정된 동안
// HTML 이름표와 점이 정확히 겹친다(설계 §4).
import type { ChartEntry } from '@/charts/types';

export function screenToWorld(sx: number, sy: number, vw: number, vh: number, dist: number, fovDeg: number): [number, number] {
  const halfH = dist * Math.tan((fovDeg * Math.PI) / 360);
  const halfW = halfH * (vw / vh);
  return [((sx / vw) * 2 - 1) * halfW + 0, (1 - (sy / vh) * 2) * halfH + 0]; // + 0: -0을 0으로
}

// 판이 고정되기 전·풀린 뒤(블록이 들어오고 나가는 동안)에도 점이 이름표와 함께 움직이도록 더할 세계 y 이동량.
// 차트 장면은 블록이 화면 가운데를 지나면 켜지지만 판은 top ≤ 0 동안만 고정된다 — 그 사이 이름표는 스크롤로 움직인다.
// stageTop: 지금 판(.chart-stage)의 화면 위치(px). 화면에서 아래(px +)는 세계 y의 아래(-)다.
export function chartShiftY(stageTop: number, vh: number, dist: number, fovDeg: number): number {
  const halfH = dist * Math.tan((fovDeg * Math.PI) / 360);
  return (-stageTop * (2 * halfH)) / vh + 0; // + 0: -0을 0으로
}

// 배치 점마다 점 구름의 어느 점을 쓸지 고른다. group(지형 출발일 번호)이 있으면 그 출발일의 신호·잡음 점을 먼저
// 쓴다 — 점 달력에서 "그 출발일의 점들이 모여 원을 이룬다"가 실제로 그렇게 되도록. 모자라거나 group이 없으면
// 아직 안 쓴 점을 앞 번호부터. 제거 레이어(kind 2)는 잘못 매칭된 행이라 출발일 원에는 쓰지 않는다.
export function assignPoints(group: Int16Array, n: number, cloudDate: Int16Array, cloudKind: Float32Array): Int32Array {
  const count = cloudDate.length;
  const used = new Uint8Array(count);
  const buckets = new Map<number, number[]>();
  for (let i = count - 1; i >= 0; i--) { // 뒤에서부터 넣어 pop()이 앞 번호부터 꺼내게
    if (cloudKind[i] > 1.5 || cloudDate[i] < 0) continue;
    let b = buckets.get(cloudDate[i]);
    if (!b) buckets.set(cloudDate[i], (b = []));
    b.push(i);
  }
  const out = new Int32Array(n).fill(-1);
  let cursor = 0;
  for (let j = 0; j < n; j++) {
    let pick = -1;
    const b = group[j] >= 0 ? buckets.get(group[j]) : undefined;
    while (b && b.length) {
      const c = b.pop()!;
      if (!used[c]) { pick = c; break; }
    }
    if (pick < 0) {
      while (cursor < count && used[cursor]) cursor++;
      if (cursor < count) pick = cursor;
    }
    if (pick < 0) break; // 점 구름을 다 썼다
    used[pick] = 1;
    out[j] = pick;
  }
  return out;
}

// 한 슬롯(A 또는 B)에 써 넣을 버퍼를 점 구름 크기로 만든다. 안 쓰는 점은 지형 자리에 둔 채 알파 0으로
// 사라진다(차트에서 차트로 넘어갈 때 다른 배치의 점과 섞이지 않는다). waffle은 두 슬롯이 같이 쓰는 한 벌이다 —
// 강조는 ③ 와플에 머무는 동안만 켜지므로(TerrainScene) 다른 차트가 -1로 덮어써도 문제없다
export function slotBuffers(entry: ChartEntry, assign: Int32Array, terrain: Float32Array, dist: number, fovDeg: number): { pos: Float32Array; style: Float32Array; waffle: Float32Array } {
  const pos = terrain.slice();
  const style = new Float32Array(terrain.length); // (알파, 색 번호, 지름 px). 0 = 안 보임
  const waffle = new Float32Array(terrain.length / 3).fill(-1);
  const { layout: L, rect: r } = entry;
  for (let j = 0; j < L.n; j++) {
    const i = assign[j];
    if (i < 0) continue;
    const [x, y] = screenToWorld(r.left + L.x[j] * r.width, r.top + L.y[j] * r.height, r.vw, r.vh, dist, fovDeg);
    pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = 0;
    style[i * 3] = L.alpha[j]; style[i * 3 + 1] = L.tone[j]; style[i * 3 + 2] = L.size[j];
    waffle[i] = L.waffle[j];
  }
  return { pos, style, waffle };
}
