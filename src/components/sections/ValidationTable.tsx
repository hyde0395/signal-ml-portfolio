// ⑤ 검증 섹션의 검증 설계 판 뒤 표 카드에 들어가는 평가 방식 3종 비교표(TimeSeriesSplit / GroupKFold / K-Fold).
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
      {/* caption은 낭독용으로만 — 표가 점수판 판 바로 뒤라 화면에서는 제목 없이 읽힌다(정보 전달 2 §5) */}
      <caption className="sr-only">{t('charts.validation.table.caption')}</caption>
      <thead>
        <tr>
          <th scope="col">{t('charts.validation.table.method')}</th>
          <th scope="col">R²</th>
          <th scope="col">MAE ({t('charts.validation.table.maeUnit')})</th>
          <th scope="col">MAPE</th>
        </tr>
      </thead>
      <tbody>
        {ROWS.map((r) => (
          <tr key={r.key} className={r.main ? 'is-main' : undefined}>
            <th scope="row">{t(`charts.validation.table.${r.key}`)}</th>
            <td>{n(r.score.r2)}</td>
            <td>{n(r.score.mae)}</td>
            <td>{n(r.score.mape)}%</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
