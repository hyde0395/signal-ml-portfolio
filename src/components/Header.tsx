// 상단 바(로고 + 이력서 링크 + 언어 전환)와, Contact 섹션에서도 재사용하는 ResumeLink를 정의한다.
import { LangSwitch } from './LangSwitch';
import { getT } from '@/lib/content';
import type { Locale } from '@/lib/i18n';
import { resumeHref } from '@/lib/resume';

// href가 null이면(해당 언어 이력서 PDF가 아직 없으면) 링크 대신 "준비 중" 표시만 흐리게 보여준다.
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
