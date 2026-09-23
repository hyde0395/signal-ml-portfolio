import { EmailLink } from '../EmailLink';
import { ResumeLink } from '../Header';
import { getT } from '@/lib/content';
import { facts } from '@/lib/facts';
import type { Locale } from '@/lib/i18n';
import { resumeHref } from '@/lib/resume';

export function Contact({ locale }: { locale: Locale }) {
  const t = getT(locale);
  const { emailReversed, github, linkedin } = facts.contact;
  return (
    <section id="contact" data-section="contact" className="wrap" aria-labelledby="contact-h">
      <p className="eyebrow">CONTACT</p>
      <h2 id="contact-h" className="display">{t('contact.heading')}</h2>
      <div className="pass">
        <p className="pass-head mono">BOARDING PASS · SIGNAL</p>
        <dl>
          <div><dt className="mono">{t('contact.passenger')}</dt><dd className="display">CHOI HALIM</dd></div>
          <div><dt className="mono">{t('contact.email')}</dt><dd><EmailLink reversed={emailReversed} fallback={t('contact.emailFallback')} /></dd></div>
          <div><dt className="mono">{t('contact.github')}</dt><dd><a href={github} target="_blank" rel="noopener noreferrer">{github.replace('https://', '')}</a></dd></div>
          {linkedin && (
            <div data-testid="linkedin"><dt className="mono">{t('contact.linkedin')}</dt><dd><a href={linkedin} target="_blank" rel="noopener noreferrer">{linkedin.replace('https://', '')}</a></dd></div>
          )}
          <div><dt className="mono">{t('contact.resume')}</dt><dd><ResumeLink href={resumeHref(locale)} label="PDF ↓" pendingLabel={t('contact.resumePending')} /></dd></div>
        </dl>
      </div>
    </section>
  );
}
