// ③ 피처(설계 2026-09-25 §3.3, 2026-09-27 개정): 그룹마다 점 와플(점 100개 중 중요도만큼 켜짐).
// 그림 판(ChartStage)이 와플을 그리고(3D가 켜지면 배경 점이 그 자리에 모인다) 글 카드가 그 위로 지나간다.
// 화면 낭독기를 위해 같은 내용을 숨긴 목록(그룹 · % · 피처 이름)으로 둔다. 옛 기술 스택의 모델·서비스 도구는 아래 두 줄.
import { ChartStage } from '../charts/ChartStage';
import { getT } from '@/lib/content';
import { codeUrl, facts } from '@/lib/facts';
import { formatValue, type Locale } from '@/lib/i18n';
import { eyebrow } from '@/lib/sections';

export function Features({ locale }: { locale: Locale }) {
  const t = getT(locale);
  const groups = facts.model.featureGroups.map((g) => ({ id: g.id, gain: g.gain, features: g.features, name: t(`features.groups.${g.id}`) }));
  // 영어만 숫자와 단위 사이를 띄운다(13 features / 13개 / 13個)
  const countUnit = `${locale === 'en' ? ' ' : ''}${t('features.unit')}`;
  return (
    <section id="features" className="wrap" aria-labelledby="features-h">
      <article className="chart-block" data-scene="features">
        <ChartStage chartKey="features" dataVersion={facts.dataVersion} strings={{ locale, holidays: {}, groups, countUnit }} errorText={t('charts.error')} />
        <div className="chart-copy">
          <p className="eyebrow" data-flip-on-enter>{eyebrow('features')}</p>
          <h2 id="features-h" className="display" data-reveal>{t('features.heading')}</h2>
          <p>{t('features.lead')}</p>
          <p className="muted">{t('features.hint')}</p>
          <ul className="sr-only">
            {groups.map((g) => <li key={g.id}>{g.name} · {formatValue(g.gain, 'fixed1', locale)}% · {g.features.join(', ')}</li>)}
          </ul>
          <p className="muted">{t('features.lookupNote')}</p>
          <p className="muted mono data-tools">{t('features.model')}</p>
          <p className="muted mono data-tools">{t('features.serve')}</p>
          <a className="code-link mono" href={codeUrl('features')} target="_blank" rel="noopener noreferrer">
            {t('common.codeLink')} ↗
          </a>
        </div>
      </article>
    </section>
  );
}
