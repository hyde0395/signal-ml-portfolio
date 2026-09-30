// ③ 모델과 피처(설계 2026-09-25 §3.3, 2026-09-29 이야기 흐름 §3.1): 모델 카드 → 점 와플.
// 모델 카드는 글 카드(.chapter)로 모델 구조 문단을 보여 주고, 뒤에서 가격 지형 장면(model)이 조용히 돈다.
// 와플은 그룹마다 점 100개 중 중요도만큼 켜지는 그림 판(ChartStage)이다(3D가 켜지면 배경 점이 그 자리에 모인다). 글은
// 판 아래 자막 띠에 고정되고 세 칸을 차례로 보여 준다(설계 2026-09-28 §2). 화면 낭독기를 위해 같은 내용을 숨긴
// 목록(그룹 · % · 피처 이름)으로 둔다. 그룹을 누르면(키보드는 Enter·Space) 그 그룹의 SHAP 벌떼로 펼쳐진다(계획 5-3c).
import type React from 'react';
import { ChartStage } from '../charts/ChartStage';
import type { ShapTexts } from '@/charts/build';
import { dictionaries, getT } from '@/lib/content';
import { codeUrl, facts } from '@/lib/facts';
import { formatValue, prefill, type Locale } from '@/lib/i18n';
import { eyebrow } from '@/lib/sections';

export function Features({ locale }: { locale: Locale }) {
  const t = getT(locale);
  const groups = facts.model.featureGroups.map((g) => ({ id: g.id, gain: g.gain, features: g.features, name: t(`features.groups.${g.id}`) }));
  // 영어만 숫자와 단위 사이를 띄운다(13 features / 13개 / 13個)
  const countUnit = `${locale === 'en' ? ' ' : ''}${t('features.unit')}`;
  // SHAP 문구는 {v.…}를 남긴 채 넘긴다(t()는 facts에서 찾다가 throw) — 배치 코드가 피처 값으로 채운다
  const shap = Object.fromEntries(
    Object.entries(dictionaries[locale].features.shap).map(([k, v]) => [k, prefill(v as string, facts, locale)]),
  ) as ShapTexts;
  return (
    <section id="features" className="wrap" aria-labelledby="features-h">
      {/* 섹션 머리표·h2는 모델 카드로 옮겼다 — #features-h는 움직임 e2e가 쓰는 제목 리빌 대상이라 id를 그대로 둔다.
          카드 article에는 이름을 따로 달지 않는다: h2가 이미 섹션 이름이라 같은 이름이 두 번 낭독된다 */}
      <article className="chapter model-card" data-scene="model">
        <p className="eyebrow" data-flip-on-enter>{eyebrow('features')}</p>
        <h2 id="features-h" className="display" data-reveal>{t('features.structure.heading')}</h2>
        <p>{t('features.structure.body1')}</p>
        <p>{t('features.structure.body2')}</p>
        <p className="muted mono data-tools model-flow">{t('features.structure.flow')}</p>
        <a className="code-link mono" href={codeUrl('model')} target="_blank" rel="noopener noreferrer">
          {t('common.codeLink')} ↗
        </a>
      </article>
      <article className="chart-block" data-scene="features" aria-labelledby="waffle-h" style={{ '--paras': 3 } as React.CSSProperties}>
        <ChartStage chartKey="features" dataVersion={facts.dataVersion} strings={{ locale, holidays: {}, groups, countUnit, shap }} errorText={t('charts.error')} />
        <div className="chart-copy">
          <h3 id="waffle-h" className="display">{t('features.heading')}</h3>
          <ul className="sr-only">
            {groups.map((g) => <li key={g.id}>{g.name} · {formatValue(g.gain, 'fixed1', locale)}% · {g.features.join(', ')}</li>)}
          </ul>
          {/* 세 칸: 설명 → lookup 주의 → 서비스 도구. 모델 도구 이름은 모델 카드 문단이 대신한다. 자막 띠에서 한 칸씩 바뀐다(motion/caption.ts) */}
          <div className="chart-paras">
            <div className="chart-para">
              <p>{t('features.lead')}</p>
              <p className="muted">{t('features.hint')}</p>
            </div>
            <div className="chart-para"><p className="muted">{t('features.lookupNote')}</p></div>
            <div className="chart-para"><p className="muted mono data-tools">{t('features.serve')}</p></div>
          </div>
          <a className="code-link mono" href={codeUrl('features')} target="_blank" rel="noopener noreferrer">
            {t('common.codeLink')} ↗
          </a>
        </div>
      </article>
    </section>
  );
}
