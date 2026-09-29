// SIGNAL 머리말 화면(설계 2026-09-29 §5): 첫 화면과 ① 사이 한 화면. 번호·옆 목차 없는 머리말이라 sections.ts에 넣지 않는다.
import { getT } from '@/lib/content';
import type { Locale } from '@/lib/i18n';

export function Intro({ locale }: { locale: Locale }) {
  const t = getT(locale);
  return (
    // data-scene을 두지 않는다 — 이 화면이 지나는 동안의 첫 화면 → ① 전환은 활성 장면이 아니라
    // 스크롤 위치로 계산한다(TerrainScene update, handoffProgress). 3D가 맨 위에서 켜지지 않았으면
    // 전환이 없고 3D는 직전 목표를 그대로 유지한다
    <section id="intro" className="intro wrap" aria-labelledby="intro-h">
      <div className="intro-copy">
        {/* 리빌은 대상 요소의 안쪽 마크업을 글자로 덮어쓰므로(run.ts wrapWords) 줄마다 따로 건다 */}
        <h2 id="intro-h" className="display intro-title">
          <span data-reveal>{t('intro.line1')}</span>{' '}
          <span data-reveal>{t('intro.line2')}</span>
        </h2>
        <p className="intro-note">{t('intro.note')}</p>
      </div>
    </section>
  );
}
