// ③ 모델과 피처(설계 2026-09-25 §3.3, 2026-09-29 이야기 흐름 §3.1): 모델 구조 → 점 와플.
// 모델 구조는 그림 판 블록(계획 7-2): 자막 칸이 바뀔 때마다 인천→나리타 LCC 관측 점이 모은 가격 → NeuralProphet 기준 가격 선 →
// 기준에서 벗어난 몫(XGBoost)으로 옮겨 간다(src/charts/model.ts). 넷째 칸(Optuna·분위수·SHAP)은 셋째 단계 그대로.
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
      {/* 섹션 머리표·h2는 ④·⑤처럼 블록 위 머리(.charts-head)에 둔다 — #features-h는 움직임 e2e가 쓰는 제목 리빌 대상이라 id를 그대로 둔다.
          모델 구조 블록에는 이름을 따로 달지 않는다: h2가 이미 이 블록의 이름이라 같은 이름이 두 번 낭독된다 */}
      {/* data-scene="model": 머리 자리의 3D 장면(가격 지형) — 장면이 없으면 3D가 ② 보드 배치에 멈춘 채 글 위에 남았다(계획 7-2 눈 확인).
          섹션 전체가 아니라 머리에만 둔다: 섹션에 두면 와플 아래 여백에서 지형이 켜져 ③ 와플 → ④ 출발일 차트 사이에 점이
          지형으로 한 번 흩어졌다 다시 모였다(2026-09-30). 블록이 붙어 있어 블록 사이에는 틈이 없다 */}
      <div className="charts-head" data-scene="model">
        <p className="eyebrow" data-flip-on-enter>{eyebrow('features')}</p>
        <h2 id="features-h" className="display" data-reveal>{t('features.structure.heading')}</h2>
      </div>
      <article className="chart-block" data-scene="chartModel" style={{ '--paras': 4 } as React.CSSProperties}>
        <ChartStage
          chartKey="chartModel"
          dataVersion={facts.dataVersion}
          stages={3}
          strings={{
            locale, holidays: {},
            axis: t('features.structure.axis'), axisResid: t('features.structure.axisResid'), line: t('features.structure.line'),
          }}
          errorText={t('charts.error')}
        />
        <div className="chart-copy">
          <p className="sr-only">{t('features.structure.alt')}</p>
          {/* 네 칸: 모은 가격 → 기준 가격 → 벗어난 몫(+ 흐름 줄) → 튜닝·구간·SHAP. 앞 세 칸이 점 단계와 짝이다 */}
          <div className="chart-paras">
            <div className="chart-para"><p>{t('features.structure.step1')}</p></div>
            <div className="chart-para"><p>{t('features.structure.step2')}</p></div>
            <div className="chart-para">
              <p>{t('features.structure.step3')}</p>
              <p className="muted mono data-tools model-flow">{t('features.structure.flow')}</p>
            </div>
            <div className="chart-para"><p>{t('features.structure.body2')}</p></div>
          </div>
          <a className="code-link mono" href={codeUrl('model')} target="_blank" rel="noopener noreferrer">
            {t('common.codeLink')} ↗
          </a>
        </div>
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
