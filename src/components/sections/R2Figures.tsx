// ⑤ 차트 3 R² 거품의 큰 숫자 두 장(설계 2026-10-08 §1, 시안 r2-options C). 정정마다 R² 전→후를 크게, MAE는 그 아래 한 줄 —
// "R²는 떨어졌는데 MAE는 그대로"를 시선 한 번에 읽게 하려고 아령 점 그림을 글자로 바꿨다.
import { getT } from '@/lib/content';
import { facts } from '@/lib/facts';
import { formatValue, type Locale } from '@/lib/i18n';

export function R2Figures({ locale }: { locale: Locale }) {
  const t = getT(locale);
  const b = facts.model.bubble;
  // R²는 소수 둘째 자리 고정(0.70이 0.7로 줄지 않게)
  const r2 = new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format;
  const num = (v: number) => formatValue(v, undefined, locale);
  const unit = t('charts.validation.table.maeUnit');
  // 영어는 ₩ 앞붙임, ko·ja는 단위를 끝에 한 번만(표·점수판과 같은 규칙)
  const maeChange = locale === 'en' ? `₩${num(b.maeBefore)} → ₩${num(b.maeAfter)}` : `${num(b.maeBefore)} → ${num(b.maeAfter)}${unit}`;
  const cards = [
    { name: t('charts.bubble.row1'), note: t('charts.bubble.row1Note'), before: b.firstR2, after: b.firstR2After, mae: t('charts.bubble.maeSame') },
    { name: t('charts.bubble.row2'), note: t('charts.bubble.row2Note'), before: b.r2Before, after: b.r2After, mae: `${maeChange} · ${t('charts.bubble.maeSame')}` },
  ];
  return (
    <div className="figs figs-r2">
      {cards.map((c) => (
        <div key={c.name} className="fig-card">
          <p className="fig-name"><strong>{c.name}</strong><span>{c.note}</span></p>
          <p className="fig-big mono">
            <span className="fig-from">R² {r2(c.before)}</span>
            {' → '}
            <span className="fig-to">{r2(c.after)}</span>
          </p>
          <p className="fig-sub"><span className="mono">MAE</span> {c.mae}</p>
        </div>
      ))}
    </div>
  );
}
