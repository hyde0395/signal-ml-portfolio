// ⑤ 한계의 큰 숫자 비교(설계 2026-10-08 개정 4, 시안 limits-options A): 단순 기준선과 모델의 평균 오차를 같은 크기로 나란히 —
// 두 숫자가 거의 같다는 사실을 문장 대신 한눈에. R² 카드(전 → 후)와 같은 모양으로 ⑤를 큰 숫자 하나의 규칙으로 맞춘다.
import { getT } from '@/lib/content';
import { facts } from '@/lib/facts';
import { formatValue, type Locale } from '@/lib/i18n';

export function LimitsFigures({ locale }: { locale: Locale }) {
  const t = getT(locale);
  const num = (v: number) => formatValue(v, undefined, locale);
  const unit = t('charts.validation.table.maeUnit');
  // 영어는 KRW를 띄워 작게, ko·ja는 원·ウォン을 붙여 작게(성능 대표값과 같은 규칙)
  const u = locale === 'en' ? ` ${unit}` : unit;
  const cols = [
    { cls: 'fig-base', name: t('charts.limits.baseLabel'), note: t('charts.limits.baseNote'), value: facts.model.baselineMae },
    { cls: 'fig-model', name: t('charts.limits.modelLabel'), note: t('charts.limits.modelNote'), value: facts.model.tss.mae },
  ];
  return (
    <div className="figs figs-limits">
      <div className="limits-cmp">
        {cols.map((c, i) => (
          <div key={c.cls} className="limits-pair">
            {i > 0 && <span className="limits-arrow mono" aria-hidden="true">→</span>}
            <p className={`limits-col ${c.cls}`}>
              <span className="fig-name"><strong>{c.name}</strong><span>{c.note}</span></span>
              <span className="limits-n mono">{num(c.value)}<small>{u}</small></span>
            </p>
          </div>
        ))}
      </div>
      <p className="limits-gap mono">{t('charts.limits.gap')}</p>
    </div>
  );
}
