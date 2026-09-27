// ② 데이터 수집(설계 2026-09-25 §3.2, 2026-09-27 개정 — 두 화면). 화면 1은 글과 수집 4단계를 왼쪽 좁은 열에 두고
// 오른쪽에 한·일 지도와 노선 궤적(장면 problem)이 온전히 보이게 한다. 화면 2는 공항 출발 안내판만 두고,
// 뒤의 지도는 멀리 물러나 흐려진다(장면 dataBoard) — 판 없는 보드의 작은 글자가 지도 점과 섞이지 않게.
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
    <section id="data" className="wrap data" aria-labelledby="data-h">
      <div className="chapter data-intro" data-scene="problem">
        <p className="eyebrow" data-flip-on-enter>{eyebrow('data')}</p>
        <h2 id="data-h" className="display" data-reveal>{t('data.heading')}</h2>
        <p>{t('data.body1')}</p>
        <p>{t('data.body2')}</p>
        <ol className="collect-steps">
          {STEPS.map((s) => (
            <li key={s}>
              <strong className="mono">{s.toUpperCase()}</strong>
              <span>{t(`data.steps.${s}`)}</span>
            </li>
          ))}
        </ol>
        <ChapterFigure locale={locale} sceneKey="problem" />
      </div>
      <div className="data-board" data-scene="dataBoard">
        <DepartureBoard locale={locale} />
        <p className="muted">{t('data.sparse')}</p>
        <p className="muted mono data-tools">{t('data.tools')}</p>
        <a className="code-link mono" href={codeUrl('problem')} target="_blank" rel="noopener noreferrer">
          {t('common.codeLink')} ↗
        </a>
      </div>
    </section>
  );
}
