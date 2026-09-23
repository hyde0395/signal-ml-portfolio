import { HeaderMore } from './HeaderMore';
import { LangSwitch } from './LangSwitch';
import { SummaryButton, SummaryDialog } from './Summary';
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
        <HeaderMore label={t('nav.menu')}>
          <SummaryButton label={t('nav.summary')} />
          <LangSwitch current={locale} label={t('nav.language')} />
        </HeaderMore>
      </div>
      <SummaryDialog
        title={t('summary.title')} close={t('summary.close')}
        resultsHeading={t('summary.resultsHeading')} education={t('about.education')} keywords={t('hero.keywords')}
        results={[t('summary.r1'), t('summary.r2'), t('summary.r3')]}
        resumeHref={resume} resumeLabel={t('nav.resume')} resumePendingLabel={t('nav.resumePending')}
      />
    </header>
  );
}
