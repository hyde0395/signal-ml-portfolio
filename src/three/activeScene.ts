// 활성 장면 고르기: 뷰포트 세로 중앙에 걸린 [data-scene] 요소를 찾는다. 차트 블록은 섹션 안에
// 있으므로 "중앙을 포함하는 것 중 가장 짧은 요소"를 고르면 자연스럽게 안쪽 블록이 이긴다.
import { SCENES, type SceneKey } from './scenes';

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

// 섹션·블록은 자기 장면 이름을 data-scene으로 적는다(설계 2026-09-25 §4). 섹션 id와 장면 이름을 떼어 두어
// 섹션을 더하거나 한 섹션 안에서 장면을 여러 번 바꿔도 이 파일은 그대로다
export function readCandidates(doc: Document): Candidate[] {
  const out: Candidate[] = [];
  doc.querySelectorAll<HTMLElement>('[data-scene]').forEach((el) => {
    const key = el.dataset.scene;
    if (!key || !(key in SCENES)) return; // 장면 표에 없는 이름이면 sceneFor가 터지므로 버린다
    const r = el.getBoundingClientRect();
    out.push({ key: key as SceneKey, top: r.top, bottom: r.bottom });
  });
  return out;
}
