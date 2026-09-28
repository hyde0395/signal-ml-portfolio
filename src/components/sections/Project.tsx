// ① 프로젝트 소개(설계 2026-09-25 §3.1): 큰 질문 + 설명 두 줄 + 숫자 4개. 배경은 첫 화면 지형이 이어진다.
import { getT } from '@/lib/content';
import type { Locale } from '@/lib/i18n';
import { eyebrow } from '@/lib/sections';

// content/*.json의 project.stats.<키>.value/label과 순서를 맞춘다
const STATS = ['routes', 'period', 'features', 'interval'] as const;

export function Project({ locale }: { locale: Locale }) {
  const t = getT(locale);
  return (
    <section id="project" data-scene="about" className="wrap project" aria-labelledby="project-h">
      <div className="project-copy">
        <p className="eyebrow" data-flip-on-enter>{eyebrow('project')}</p>
        <h2 id="project-h" className="display project-q" data-reveal>{t('project.heading')}</h2>
        <p className="project-lead">{t('project.body')}</p>
        <dl className="project-stats">
          {STATS.map((k) => (
            // 숫자를 위에, 이름을 아래에 보이도록 CSS(column-reverse)로 뒤집는다. 읽는 순서는 이름 → 숫자
            <div key={k}><dt>{t(`project.stats.${k}.label`)}</dt><dd className="mono">{t(`project.stats.${k}.value`)}</dd></div>
          ))}
        </dl>
      </div>
    </section>
  );
}
