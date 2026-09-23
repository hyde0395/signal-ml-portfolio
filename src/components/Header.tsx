import { LangSwitch } from './LangSwitch';
import { getT } from '@/lib/content';
import type { Locale } from '@/lib/i18n';
import { resumeHref } from '@/lib/resume';

export function ResumeLink({ href, label, pendingLabel, className = 'pill' }: { href: string | null; label: string; pendingLabel: string; className?: string }) {
  return href
    ? <a className={className} href={href} download>{label}</a>
    : <span className={`${className} is-pending`} aria-disabled="true">{pendingLabel}</span>;
}

export function Header({ locale }: { locale: Locale }) {
  const t = getT(locale);
  const resume = resumeHref(locale);
  return (
    <header className="site-header">
      <span className="brand display">SIGNAL</span>
      <div className="header-actions">
        <ResumeLink href={resume} label={t('nav.resume')} pendingLabel={t('nav.resumePending')} />
        <LangSwitch current={locale} label={t('nav.language')} />
      </div>
    </header>
  );
}
