// 3D 대체 이미지가 있는 장면 이름. 3D 판별 코드(capability.ts, 초기 JS)와 대체 이미지 컴포넌트(ChapterFigure, 서버)가
// 함께 쓴다. ChapterFigure에서 가져오면 그 파일이 부르는 문구 모듈(세 언어 사전·facts·zod)까지 초기 JS에 딸려 오므로 따로 둔다.
export const FIGURE_KEYS = ['hero', 'problem', 'insight', 'bubble', 'interval'] as const;
export type FigureKey = (typeof FIGURE_KEYS)[number];
