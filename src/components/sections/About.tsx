import { getT } from '@/lib/content';
import type { Locale } from '@/lib/i18n';

const SKILLS = ['collection', 'modeling', 'validation', 'interval'] as const;

export function About({ locale }: { locale: Locale }) {
  const t = getT(locale);
  return (
    <section id="about" data-section="about" className="wrap" aria-labelledby="about-h">
      <p className="eyebrow">ABOUT</p>
      <h2 id="about-h" className="display">{t('about.heading')}</h2>
      <p className="muted">{t('about.education')}</p>
      <p>{t('about.body1')}</p>
      <p>{t('about.body2')}</p>
      <p>{t('about.body3')}</p>
      <h3>{t('about.skillsHeading')}</h3>
      <ul className="skills">{SKILLS.map((s) => <li key={s}>{t(`about.skills.${s}`)}</li>)}</ul>
    </section>
  );
}
