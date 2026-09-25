// ② 데이터 수집(설계 2026-09-25 §3.2): 수집 라인 4단계 + 공항 출발 안내판. 배경은 한·일 지도와 노선 궤적(장면 problem).
// 옛 기술 스택 섹션의 수집·외부 데이터 도구는 이 섹션 아래 한 줄(data.tools)로 옮겼다.
import { ChapterFigure } from './ChapterFigure';
import { DepartureBoard } from './DepartureBoard';
import { getT } from '@/lib/content';
import { codeUrl } from '@/lib/facts';
import type { Locale } from '@/lib/i18n';
import { eyebrow } from '@/lib/sections';

// 단계 이름은 세 언어 공통 영어(보드 글자와 같은 결), 설명은 content의 data.steps.<키>
const STEPS = ['collect', 'schedule', 'filter', 'join'] as const;

export function DataSection({ locale }: { locale: Locale }) {
  const t = getT(locale);
  return (
    <section id="data" data-scene="problem" className="wrap data" aria-labelledby="data-h">
      <p className="eyebrow" data-flip-on-enter>{eyebrow('data')}</p>
      <h2 id="data-h" className="display" data-reveal>{t('data.heading')}</h2>
      <p>{t('data.body1')}</p>
      <p>{t('data.body2')}</p>
      <ol className="pipeline collect-line">
        {STEPS.map((s) => (
          <li key={s}>
            <strong className="mono">{s.toUpperCase()}</strong>
            <span>{t(`data.steps.${s}`)}</span>
          </li>
        ))}
      </ol>
      <DepartureBoard locale={locale} />
      <p className="muted">{t('data.sparse')}</p>
      <p className="muted mono data-tools">{t('data.tools')}</p>
      <ChapterFigure locale={locale} sceneKey="problem" />
      <a className="code-link mono" href={codeUrl('problem')} target="_blank" rel="noopener noreferrer">
        {t('common.codeLink')} ↗
      </a>
    </section>
  );
}
