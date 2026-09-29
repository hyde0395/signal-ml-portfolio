// ③ 와플·④ 차트의 공통 타입(설계 2026-09-25 §3.3·§3.4·§4, 2026-09-27 개정). 의존성이 없어 어디서 불러도 가볍다.
// 좌표는 "그림 판"(data-plot) 안의 정규화 좌표다: x 0=왼쪽 1=오른쪽, y 0=위 1=아래(화면과 같은 방향).
// 같은 배치를 2D 캔버스(3D가 꺼졌을 때)와 3D 점(켜졌을 때)이 함께 쓴다.
export type ChartKey = 'features' | 'chartDepart' | 'chartCurve' | 'chartCloud';

// 색 번호: 셰이더(three/shaders.ts toneColor)와 2D 그리기(draw2d.ts)가 같은 번호를 쓴다
export const TONE = { dot: 1, amber: 2, text: 3 } as const;

// ③ 와플 강조(설계 2026-09-28 §3): 강조 그룹은 호박색, 다른 와플 그룹은 알파 × FOCUS_DIM. 2D 그리기(draw2d.ts)와
// 3D 셰이더(three/shaders.ts, 유니폼 uFocusDim)가 ChartLayout.focusDim을 통해 이 숫자를 같이 쓴다
export const FOCUS_DIM = 0.25;
// ④ 차트 1·2·4 강조(계획 5-3b): 와플보다 흐림 정도가 약하다 — 강조 항목이 하나가 아니라 이어진 값(점 그래프 등)이라
// 너무 흐리면 전체 모양이 안 보인다
export const CHART_FOCUS_DIM = 0.45;

export type ChartLabel =
  | { type: 'text'; x: number; y: number; text: string; align: 'start' | 'center' | 'end'; cls: 'tick' | 'axis' | 'month' | 'holiday' }
  // compact: 좁은 판(휴대폰)에서는 개수를 빼고 pct·이름 두 줄만 보여준다 — 개수는 설명 줄에도 있다(2026-09-28 실측)
  | { type: 'group'; x: number; y: number; id: string; pct: string; name: string; count: string; features: string[]; holiday: boolean; compact: boolean }
  // ③ 와플 설명 줄의 자리(왼쪽 위 기준). 내용은 그림 판이 강조 그룹에 따라 채운다(설계 2026-09-28 §3)
  | { type: 'detail'; x: number; y: number };

export type ChartLayout = {
  n: number;
  x: Float32Array;     // 정규화 x
  y: Float32Array;     // 정규화 y(아래로)
  size: Float32Array;  // 지름(CSS px)
  alpha: Float32Array; // 0..1
  tone: Uint8Array;    // TONE
  group: Int16Array;   // 3D에서 이 점을 어느 지형 출발일(번호)의 점으로 채울지. -1 = 아무 점
  // 강조 번호 — 같은 번호끼리 함께 강조된다. ③ 와플 그룹, ④ 차트 1·4 출발일 번호, 차트 2 구간 번호.
  // −1 = 강조와 무관(늘 그대로)
  hl: Int16Array;
  focusTone: number; // 강조됐을 때 칠할 색(TONE)
  focusDim: number;  // 강조 중일 때 강조 안 된 점의 알파 배율
  labels: ChartLabel[];
};

// 판이 고정(sticky, top: 0)된 동안의 화면 위치(px)와 그때의 뷰포트 크기
export type PlotRect = { left: number; top: number; width: number; height: number; vw: number; vh: number };
export type ChartEntry = { layout: ChartLayout; rect: PlotRect };
