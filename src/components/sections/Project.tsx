// ① 프로젝트 소개(설계 2026-09-25 §3.1): 큰 질문 + 설명 두 줄 + 숫자 4개(정보 전달 2: 모은 가격·구간 포함률·R² 바로잡음·노선). 배경은 첫 화면 지형이 이어진다.
import { dictionaries, getT } from '@/lib/content';
import type { Locale } from '@/lib/i18n';
import { eyebrow } from '@/lib/sections';

// content/*.json의 project.stats.<키>.value/label(+ sub)과 순서를 맞춘다. 숫자는 과정 성과만(방향 결정 2, 2026-10-04)
const STATS = ['rows', 'coverage', 'r2Fix', 'routes'] as const;

export function Project({ locale }: { locale: Locale }) {
  const t = getT(locale);
  return (
    <section id="project" data-scene="about" className="wrap project" aria-labelledby="project-h">
      <div className="project-copy">
        <p className="eyebrow" data-flip-on-enter>{eyebrow('project')}</p>
        <h2 id="project-h" className="display project-q" data-reveal>{t('project.heading')}</h2>
        <p className="project-lead">{t('project.body')}</p>
        <dl className="project-stats">
          {STATS.map((k) => {
            // 작은 둘째 줄(예: "보정 전 69%")은 이름 아래 — 있는 칸만
            const sub = (dictionaries[locale].project.stats as Record<string, { sub?: string }>)[k].sub;
            return (
              // 숫자를 위에, 이름을 아래에 보이도록 CSS(column-reverse)로 뒤집는다. 읽는 순서는 이름 → 숫자
              <div key={k}>
                <dt>{t(`project.stats.${k}.label`)}{sub && <small>{t(`project.stats.${k}.sub`)}</small>}</dt>
                <dd className="mono">{t(`project.stats.${k}.value`)}</dd>
              </div>
            );
          })}
        </dl>
      </div>
    </section>
  );
}
