// ⑤ 검증 설계 판 뒤 카드: 운영 기준(TimeSeriesSplit) 대표값 세 개를 크게, 다른 두 방식은 아래 작은 참고 표로(설계 2026-10-08 §2).
// 교수님 피드백 "제일 중요한 부분이니 더 크게" — 숫자마다 뜻을 한 줄로 붙여 MAE·MAPE를 몰라도 읽히게 한다.
import { getT } from '@/lib/content';
import { facts } from '@/lib/facts';
import { formatValue, type Locale } from '@/lib/i18n';

// gkf는 lookup 없이 측정한 값(gkfNoLookup)을 쓴다. lookup 포함 값은 별도 수치이며 여기서 다루지 않는다.
const REFS = [
  { key: 'gkf', score: facts.model.gkfNoLookup },
  { key: 'kfold', score: facts.model.kfold },
] as const;

export function ValidationTable({ locale }: { locale: Locale }) {
  const t = getT(locale);
  const n = (v: number) => formatValue(v, undefined, locale);
  const unit = t('charts.validation.table.maeUnit');
  const tss = facts.model.tss;
  const big = [
    { name: 'R²', value: n(tss.r2), unit: '', note: t('charts.validation.table.r2Note') },
    // 영어는 KRW를 숫자 뒤에 띄워 작게, ko·ja는 원·ウォン을 붙여 작게
    { name: 'MAE', value: n(tss.mae), unit: locale === 'en' ? ` ${unit}` : unit, note: t('charts.validation.table.maeNote') },
    { name: 'MAPE', value: n(tss.mape), unit: '%', note: t('charts.validation.table.mapeNote') },
  ];
  return (
    <div className="figs figs-perf">
      <p className="fig-lead mono">{t('charts.validation.table.lead')}</p>
      <dl className="perf-big">
        {big.map((b) => (
          <div key={b.name}>
            {/* 화면에서는 숫자가 위(CSS column-reverse) — dl 순서 규칙(dt 다음 dd)을 지키려고 소스는 이름이 먼저 */}
            <dt><span className="mono">{b.name}</span><small>{b.note}</small></dt>
            <dd className="fig-to mono">{b.value}<small>{b.unit}</small></dd>
          </div>
        ))}
      </dl>
      <table className="vtable mono">
        <caption className="sr-only">{t('charts.validation.table.caption')}</caption>
        <thead>
          <tr>
            <th scope="col">{t('charts.validation.table.cmp')}</th>
            <th scope="col">R²</th>
            <th scope="col">MAE ({unit})</th>
            <th scope="col">MAPE</th>
          </tr>
        </thead>
        <tbody>
          {REFS.map((r) => (
            <tr key={r.key}>
              <th scope="row">{t(`charts.validation.table.${r.key}`)}</th>
              <td>{n(r.score.r2)}</td>
              <td>{n(r.score.mae)}</td>
              <td>{n(r.score.mape)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
