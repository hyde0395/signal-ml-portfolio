// 홈 화면 번호 섹션 목록(설계 2026-09-25 §2.1). 섹션을 더하려면 여기에 한 줄 + HomePage의 SECTION_VIEWS에
// 부품 한 줄 + content 문구 키. 머리표 번호(01, 02…)와 옆 목차는 이 목록 순서에서 저절로 만들어진다.
// 옆 목차(클라이언트)도 이 파일을 읽으므로 부품·문구·facts 모듈을 import하지 않는다(초기 JS).
export const SECTIONS = [
  { id: 'project', label: 'PROJECT' },
  { id: 'data', label: 'DATA COLLECTION' },
  { id: 'features', label: 'FEATURES' },
  { id: 'charts', label: 'CHARTS' },
] as const;

export type SectionId = (typeof SECTIONS)[number]['id'];

export function sectionNumber(id: SectionId): string {
  return String(SECTIONS.findIndex((s) => s.id === id) + 1).padStart(2, '0');
}

// 섹션 머리표(세 언어 공통 영어). 플립 글자판으로 넘어간다
export function eyebrow(id: SectionId): string {
  return `${sectionNumber(id)} — ${SECTIONS.find((s) => s.id === id)!.label}`;
}
