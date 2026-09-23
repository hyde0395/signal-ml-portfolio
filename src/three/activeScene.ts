// 활성 장면 고르기: 뷰포트 세로 중앙에 걸린 섹션/챕터를 찾는다. 챕터는 케이스 스터디 섹션 안에
// 있으므로 "중앙을 포함하는 것 중 가장 짧은 요소"를 고르면 자연스럽게 챕터가 이긴다.
import type { SceneKey } from './scenes';

export type Candidate = { key: SceneKey; top: number; bottom: number };

export function pickActive(cands: Candidate[], viewportH: number): { key: SceneKey; progress: number } | null {
  const mid = viewportH / 2;
  let best: Candidate | null = null;
  for (const c of cands) {
    if (c.top <= mid && c.bottom > mid && (!best || c.bottom - c.top < best.bottom - best.top)) best = c;
  }
  if (!best) return null;
  const progress = Math.min(1, Math.max(0, (mid - best.top) / (best.bottom - best.top)));
  return { key: best.key, progress };
}

const SECTION_KEYS = new Set(['hero', 'about', 'stack', 'contact']); // 'case'는 챕터들이 대신한다

export function readCandidates(doc: Document): Candidate[] {
  const out: Candidate[] = [];
  doc.querySelectorAll<HTMLElement>('[data-section], [data-chapter]').forEach((el) => {
    const key = el.dataset.chapter ?? el.dataset.section;
    if (!key || (el.dataset.section && !SECTION_KEYS.has(key))) return;
    const r = el.getBoundingClientRect();
    out.push({ key: key as SceneKey, top: r.top, bottom: r.bottom });
  });
  return out;
}
