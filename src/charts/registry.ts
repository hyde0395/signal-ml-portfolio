// 그림 판(ChartStage)이 만든 배치를 3D 장면(TerrainScene)에 넘기는 작은 저장소. 두 쪽은 따로 지연 로딩되는
// 청크라 서로를 import하지 않고 이 모듈 하나만 같이 쓴다(번들러가 공유 청크 하나로 묶어 인스턴스도 하나다).
// 의존성이 없어 초기 JS에 들어가도 가볍다.
import type { ChartEntry, ChartKey } from './types';

const entries = new Map<ChartKey, ChartEntry>();
const listeners = new Set<() => void>();

// ③ 와플에서 마우스를 올린(누른) 그룹. 그림 판이 정하고 3D 장면이 읽는다(설계 2026-09-28 §3)
const focus = new Map<ChartKey, number>();

export function setFocus(key: ChartKey, group: number): void {
  if ((focus.get(key) ?? -1) === group) return;
  focus.set(key, group);
  listeners.forEach((l) => l());
}

export function getFocus(key: ChartKey): number {
  return focus.get(key) ?? -1;
}

export function publishChart(key: ChartKey, entry: ChartEntry): void {
  entries.set(key, entry);
  listeners.forEach((l) => l());
}

export function getChart(key: ChartKey): ChartEntry | undefined {
  return entries.get(key);
}

export function onChartsChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

// 테스트 전용: 모듈 전역 상태를 비운다
export function resetCharts(): void {
  entries.clear();
  listeners.clear();
  focus.clear();
}
