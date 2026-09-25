// ③ 피처(설계 2026-09-25 §3.3). 이 계획(5-1)에서는 그룹 목록을 글로 보여 준다. 계획 5-2에서 배경 점이 그룹별
// 덩어리로 모이면 이 목록은 화면 낭독기·대체 화면용으로 남는다. 옛 기술 스택의 모델·서비스 도구는 아래 두 줄로 옮겼다.
import { getT } from '@/lib/content';
import { codeUrl, facts } from '@/lib/facts';
import { formatValue, type Locale } from '@/lib/i18n';
import { eyebrow } from '@/lib/sections';

export function Features({ locale }: { locale: Locale }) {
  const t = getT(locale);
  const unit = t('features.unit');
  return (
    <section id="features" data-scene="validation" className="wrap features" aria-labelledby="features-h">
      <p className="eyebrow" data-flip-on-enter>{eyebrow('features')}</p>
      <h2 id="features-h" className="display" data-reveal>{t('features.heading')}</h2>
      <p>{t('features.lead')}</p>
      <ul className="feature-groups">
        {facts.model.featureGroups.map((g) => (
          <li key={g.id} className={g.id === 'holiday' ? 'is-holiday' : undefined}>
            <span className="mono feature-gain">{formatValue(g.gain, 'fixed1', locale)}%</span>
            {/* 영어만 숫자와 단위 사이를 띄운다(13 features / 13개 / 13個) */}
            <strong>{t(`features.groups.${g.id}`)} · {g.features.length}{locale === 'en' ? ' ' : ''}{unit}</strong>
            <span className="mono feature-names">{g.features.join(' · ')}</span>
          </li>
        ))}
      </ul>
      <p className="muted">{t('features.lookupNote')}</p>
      <p className="muted mono data-tools">{t('features.model')}</p>
      <p className="muted mono data-tools">{t('features.serve')}</p>
      <a className="code-link mono" href={codeUrl('features')} target="_blank" rel="noopener noreferrer">
        {t('common.codeLink')} ↗
      </a>
    </section>
  );
}
