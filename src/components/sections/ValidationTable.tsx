// 3-4 검증 설계 챕터에 들어가는 평가 방식 3종 비교표(TimeSeriesSplit / GroupKFold / K-Fold).
import { getT } from '@/lib/content';
import { facts } from '@/lib/facts';
import { formatValue, type Locale } from '@/lib/i18n';

// gkf는 lookup 없이 측정한 값(gkfNoLookup)을 쓴다. lookup 포함 값은 별도 수치이며 여기서 다루지 않는다.
// tss(TimeSeriesSplit, 운영 기준)를 main으로 강조한다.
const ROWS = [
  { key: 'tss', score: facts.model.tss, main: true },
  { key: 'gkf', score: facts.model.gkfNoLookup, main: false },
  { key: 'kfold', score: facts.model.kfold, main: false },
] as const;

export function ValidationTable({ locale }: { locale: Locale }) {
  const t = getT(locale);
  const n = (v: number) => formatValue(v, undefined, locale);
  return (
    <table className="vtable mono">
      <caption>{t('case.validation.table.caption')}</caption>
      <thead>
        <tr>
          <th scope="col">{t('case.validation.table.method')}</th>
          <th scope="col">R²</th>
          <th scope="col">MAE ({t('case.validation.table.maeUnit')})</th>
          <th scope="col">MAPE</th>
        </tr>
      </thead>
      <tbody>
        {ROWS.map((r) => (
          <tr key={r.key} className={r.main ? 'is-main' : undefined}>
            <th scope="row">{t(`case.validation.table.${r.key}`)}</th>
            <td>{n(r.score.r2)}</td>
            <td>{n(r.score.mae)}</td>
            <td>{n(r.score.mape)}%</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
