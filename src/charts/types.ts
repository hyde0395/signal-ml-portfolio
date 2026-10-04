// ③ 와플·④·⑤ 차트의 공통 타입(설계 2026-09-25 §3.3·§3.4·§4, 2026-09-27 개정). 의존성이 없어 어디서 불러도 가볍다.
// 좌표는 "그림 판"(data-plot) 안의 정규화 좌표다: x 0=왼쪽 1=오른쪽, y 0=위 1=아래(화면과 같은 방향).
// 같은 배치를 2D 캔버스(3D가 꺼졌을 때)와 3D 점(켜졌을 때)이 함께 쓴다.
// chartModel: ③ 모델 구조 점(계획 7-2), chartFilter: ② 걸러내기·chartSplit: ⑤ 검증 설계(계획 8-1)
export type ChartKey = 'features' | 'chartModel' | 'chartDepart' | 'chartCurve' | 'chartCloud' | 'chartFilter' | 'chartSplit';

// 색 번호: 셰이더(three/shaders.ts toneColor)와 2D 그리기(draw2d.ts)가 같은 번호를 쓴다
export const TONE = { dot: 1, amber: 2, text: 3 } as const;
// 값 색(계획 5-3c SHAP 벌떼): 색 번호 TONE_VAL + 0~100 = 피처 값 순위. 낮음 VAL_LO(파랑) → 높음 호박.
// 새 속성을 늘리지 않으려고 색 번호를 넓혀 쓴다 — 셰이더 toneColor와 draw2d.toneColor가 같은 규칙
export const TONE_VAL = 10;
export const VAL_LO = '#5A8CFF';
export const valTone = (rank: number) => TONE_VAL + Math.round(Math.min(100, Math.max(0, rank)));

// ③ 와플 강조(설계 2026-09-28 §3): 강조 그룹은 호박색, 다른 와플 그룹은 알파 × FOCUS_DIM. 2D 그리기(draw2d.ts)와
// 3D 셰이더(three/shaders.ts, 유니폼 uFocusDim)가 ChartLayout.focusDim을 통해 이 숫자를 같이 쓴다
export const FOCUS_DIM = 0.25;
// ④·⑤ 차트 1·2·4 강조(계획 5-3b): 와플보다 흐림 정도가 약하다 — 강조 항목이 하나가 아니라 이어진 값(점 그래프 등)이라
// 너무 흐리면 전체 모양이 안 보인다
export const CHART_FOCUS_DIM = 0.45;

export type ChartLabel =
  // stat·statSm: 판 위 수치(글자가 바뀌면 플립, 계획 8-1). rule·ruleOn: 걸러내기 규칙 목록(아직/적용됨). note: 호박색 짧은 설명(상자 이름·방식 꼬리표, 줄바꿈 허용).
  // keyDot·keyAmber·keyDim: 범례(앞에 그 색 점)
  | { type: 'text'; x: number; y: number; text: string; align: 'start' | 'center' | 'end';
      cls: 'tick' | 'axis' | 'month' | 'holiday' | 'feature' | 'head' | 'stat' | 'statSm' | 'rule' | 'ruleOn' | 'note' | 'keyDot' | 'keyAmber' | 'keyDim' }
  // compact: 좁은 판(휴대폰)에서는 개수를 빼고 pct·이름 두 줄만 보여준다 — 개수는 설명 줄에도 있다(2026-09-28 실측)
  // mini: 펼친 SHAP 화면의 작은 와플 이름표(계획 5-3c) — 넓은 판은 이름만, 좁은 판은 %만
  | { type: 'group'; x: number; y: number; id: string; pct: string; name: string; count: string; features: string[]; holiday: boolean; compact: boolean; mini?: 'name' | 'pct' }
  // ③ 와플 설명 줄의 자리(왼쪽 위 기준). 내용은 그림 판이 강조 그룹에 따라 채운다(설계 2026-09-28 §3)
  | { type: 'detail'; x: number; y: number }
  // 결론 이름표(설계 2026-10-04 §2): 큰 숫자 + 아래 작은 설명. place = 점 위/아래, tone = 숫자 색
  | { type: 'callout'; x: number; y: number; value: string; note: string; tone: 'amber' | 'text'; place: 'above' | 'below' };

// 별자리 선(설계 2026-10-04 §3): 결론 점끼리 잇는 가는 꺾은선. pts = 정규화 좌표를 펼친 배열 [x0, y0, x1, y1, …]
export type ChartLine = { pts: number[]; tone: number; alpha: number; width: number };
// 짚은 항목에 따라 바뀌는 SVG 덧그림(⑤ 분위수 점 그림 칸). x·y 정규화, r = px 반지름, hollow = 속 빈 점
export type OverlayShape =
  | { type: 'dot'; x: number; y: number; r: number; tone: number; alpha: number; hollow?: boolean }
  | { type: 'text'; x: number; y: number; text: string; align: 'start' | 'center' | 'end'; cls: 'panelHead' | 'panelNote' | 'panelValue' | 'panelQ' }
  | { type: 'dash'; x0: number; x1: number; y: number; tone: number; alpha: number };

// ④·⑤ 차트 1·2·4에서 짚을 수 있는 항목 하나(계획 5-3b). key = 강조 번호(ChartLayout.hl과 같은 번호)이자 items 안의 순서 —
// 조작 층이 items[key]로 바로 찾는다. 항목은 화면 왼쪽부터 번호를 매긴다(키보드 → = 번호 +1 = 오른쪽).
// x·y는 표시 상자를 붙일 자리(정규화), text는 표시 상자와 aria-valuetext에 같이 쓰는 문장
export type ChartItem = { key: number; x: number; y: number; text: string };

export type ChartLayout = {
  n: number;
  x: Float32Array;     // 정규화 x
  y: Float32Array;     // 정규화 y(아래로)
  size: Float32Array;  // 지름(CSS px)
  alpha: Float32Array; // 0..1
  tone: Uint8Array;    // TONE
  group: Int16Array;   // 3D에서 이 점을 어느 지형 출발일(번호)의 점으로 채울지. -1 = 아무 점
  // 강조 번호 — 같은 번호끼리 함께 강조된다. ③ 와플 그룹, ④·⑤ 차트 1·4 출발일 번호, 차트 2 구간 번호.
  // −1 = 강조와 무관(늘 그대로)
  hl: Int16Array;
  focusTone: number; // 강조됐을 때 칠할 색(TONE)
  focusDim: number;  // 강조 중일 때 강조 안 된 점의 알파 배율
  labels: ChartLabel[];
  items?: ChartItem[]; // 짚을 항목(차트 1·2·4만). 없으면 조작 층을 두지 않는다
  initial?: number;    // 처음 강조 번호(차트 2 = 가장 싼 구간). 없으면 −1
  // 배치 종류 표식(계획 5-3c). 같은 차트라도 이 값이 바뀌면 3D가 반대 슬롯에 써서 점이 옮겨 간다(chartTargets.pickSlot).
  // 없으면 '' — 창 크기 변경처럼 같은 종류의 다시 배치는 같은 슬롯
  variant?: string;
  summary?: string[]; // 화면 낭독기용 요약 문장(펼친 SHAP 벌떼의 피처별 한 줄)
  // 별자리 선(SVG 층). 점이 아니라 3D 셰이더는 모른다 — 3D 켜짐·꺼짐 모두 같은 SVG로 그린다(ChartLines)
  lines?: ChartLine[];
  // 짚은 항목 번호(−1 포함)를 받아 덧그림 모양을 돌려준다. 없으면 덧그림 없음
  overlay?: (sel: number) => OverlayShape[];
};

// 판이 고정(sticky, top: 0)된 동안의 화면 위치(px)와 그때의 뷰포트 크기
export type PlotRect = { left: number; top: number; width: number; height: number; vw: number; vh: number };
export type ChartEntry = { layout: ChartLayout; rect: PlotRect };
