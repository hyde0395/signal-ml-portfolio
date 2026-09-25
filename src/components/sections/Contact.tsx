// 연락처 섹션: "탑승권" 카드(이메일·GitHub·LinkedIn·이력서)와 개인 소개(학력·핵심 역량).
// 개인 소개는 옛 소개 섹션에서 옮겨 왔다(설계 2026-09-25 §2 — 첫 화면 다음은 프로젝트 소개).
import { EmailLink } from '../EmailLink';
import { ResumeLink } from '../Header';
import { getT } from '@/lib/content';
import { facts } from '@/lib/facts';
import type { Locale } from '@/lib/i18n';
import { resumeHref } from '@/lib/resume';

// content/*.json의 contact.about.skills.* 키와 순서를 맞춘 목록
const SKILLS = ['collection', 'modeling', 'validation', 'interval'] as const;

export function Contact({ locale }: { locale: Locale }) {
  const t = getT(locale);
  const { emailReversed, github, linkedin } = facts.contact;
  return (
    <section id="contact" data-scene="contact" className="wrap" aria-labelledby="contact-h">
      <p className="eyebrow">CONTACT</p>
      <h2 id="contact-h" className="display" data-reveal>{t('contact.heading')}</h2>
      <div className="pass">
        <p className="pass-head mono">BOARDING PASS · SIGNAL</p>
        <dl>
          <div><dt className="mono">{t('contact.passenger')}</dt><dd className="display">CHOI HALIM</dd></div>
          <div><dt className="mono">{t('contact.email')}</dt><dd><EmailLink reversed={emailReversed} fallback={t('contact.emailFallback')} /></dd></div>
          <div><dt className="mono">{t('contact.github')}</dt><dd><a href={github} target="_blank" rel="noopener noreferrer">{github.replace('https://', '')}</a></dd></div>
          {/* LinkedIn 값이 비어 있으면(global-constraints) 행 자체를 숨긴다 */}
          {linkedin && (
            <div data-testid="linkedin"><dt className="mono">{t('contact.linkedin')}</dt><dd><a href={linkedin} target="_blank" rel="noopener noreferrer">{linkedin.replace('https://', '')}</a></dd></div>
          )}
          <div><dt className="mono">{t('contact.resume')}</dt><dd><ResumeLink href={resumeHref(locale)} label="PDF ↓" pendingLabel={t('contact.resumePending')} locale={locale} /></dd></div>
        </dl>
      </div>
      <div className="contact-about">
        <h3>{t('contact.about.heading')}</h3>
        <p className="muted">{t('contact.about.education')}</p>
        <p>{t('contact.about.body1')}</p>
        <p>{t('contact.about.body2')}</p>
        <p>{t('contact.about.body3')}</p>
        <h4>{t('contact.about.skillsHeading')}</h4>
        <ul className="skills">{SKILLS.map((s) => <li key={s}>{t(`contact.about.skills.${s}`)}</li>)}</ul>
      </div>
    </section>
  );
}
