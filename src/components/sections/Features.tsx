// ③ 피처(설계 2026-09-25 §3.3, 2026-09-27 개정): 그룹마다 점 와플(점 100개 중 중요도만큼 켜짐).
// 그림 판(ChartStage)이 와플을 그리고(3D가 켜지면 배경 점이 그 자리에 모인다). 글은 판 아래 자막 띠에 고정되고
// 세 칸을 차례로 보여 준다(설계 2026-09-28 §2). 화면 낭독기를 위해 같은 내용을 숨긴 목록(그룹 · % · 피처 이름)으로
// 둔다. 옛 기술 스택의 모델·서비스 도구는 세 번째 칸.
import type React from 'react';
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
      <article className="chart-block" data-scene="features" style={{ '--paras': 3 } as React.CSSProperties}>
        <ChartStage chartKey="features" dataVersion={facts.dataVersion} strings={{ locale, holidays: {}, groups, countUnit }} errorText={t('charts.error')} />
        <div className="chart-copy">
          <p className="eyebrow" data-flip-on-enter>{eyebrow('features')}</p>
          <h2 id="features-h" className="display" data-reveal>{t('features.heading')}</h2>
          <ul className="sr-only">
            {groups.map((g) => <li key={g.id}>{g.name} · {formatValue(g.gain, 'fixed1', locale)}% · {g.features.join(', ')}</li>)}
          </ul>
          {/* 세 칸: 설명 → lookup 주의 → 모델·서비스 도구. 자막 띠에서 한 칸씩 바뀐다(motion/caption.ts) */}
          <div className="chart-paras">
            <div className="chart-para">
              <p>{t('features.lead')}</p>
              <p className="muted">{t('features.hint')}</p>
            </div>
            <div className="chart-para"><p className="muted">{t('features.lookupNote')}</p></div>
            <div className="chart-para">
              <p className="muted mono data-tools">{t('features.model')}</p>
              <p className="muted mono data-tools">{t('features.serve')}</p>
            </div>
          </div>
          <a className="code-link mono" href={codeUrl('features')} target="_blank" rel="noopener noreferrer">
            {t('common.codeLink')} ↗
          </a>
        </div>
      </article>
    </section>
  );
}
