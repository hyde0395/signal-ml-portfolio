import { getT } from '@/lib/content';
import type { Locale } from '@/lib/i18n';

export function Hero({ locale }: { locale: Locale }) {
  const t = getT(locale);
  const sub = t('hero.nameSub');
  return (
    <section id="hero" data-section="hero" className="hero wrap">
      <h1 className="display hero-name">CHOI HALIM</h1>
      {sub && <p className="hero-sub" lang={locale}>{sub}</p>}
      <p className="mono hero-role">{t('hero.role')}</p>
      <p className="hero-keywords">{t('hero.keywords')}</p>
    </section>
  );
}
