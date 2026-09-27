// ③ 와플·④ 차트의 공통 타입(설계 2026-09-25 §3.3·§3.4·§4, 2026-09-27 개정). 의존성이 없어 어디서 불러도 가볍다.
// 좌표는 "그림 판"(data-plot) 안의 정규화 좌표다: x 0=왼쪽 1=오른쪽, y 0=위 1=아래(화면과 같은 방향).
// 같은 배치를 2D 캔버스(3D가 꺼졌을 때)와 3D 점(켜졌을 때)이 함께 쓴다.
export type ChartKey = 'features' | 'chartDepart' | 'chartCurve' | 'chartCloud';

// 색 번호: 셰이더(three/shaders.ts toneColor)와 2D 그리기(draw2d.ts)가 같은 번호를 쓴다
export const TONE = { dot: 1, amber: 2, text: 3 } as const;

export type ChartLabel =
  | { type: 'text'; x: number; y: number; text: string; align: 'start' | 'center' | 'end'; cls: 'tick' | 'axis' | 'month' | 'holiday' }
  | { type: 'group'; x: number; y: number; id: string; pct: string; name: string; count: string; features: string[]; holiday: boolean };

export type ChartLayout = {
  n: number;
  x: Float32Array;     // 정규화 x
  y: Float32Array;     // 정규화 y(아래로)
  size: Float32Array;  // 지름(CSS px)
  alpha: Float32Array; // 0..1
  tone: Uint8Array;    // TONE
  group: Int16Array;   // 3D에서 이 점을 어느 지형 출발일(번호)의 점으로 채울지. -1 = 아무 점
  labels: ChartLabel[];
};

// 판이 고정(sticky, top: 0)된 동안의 화면 위치(px)와 그때의 뷰포트 크기
export type PlotRect = { left: number; top: number; width: number; height: number; vw: number; vh: number };
export type ChartEntry = { layout: ChartLayout; rect: PlotRect };
