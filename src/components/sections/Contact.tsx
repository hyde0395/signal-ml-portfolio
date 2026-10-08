// 연락처 섹션: 가로 탑승권(노선·이름·이메일·GitHub·LinkedIn + 꼬리표 이력서)과 개인 소개(학력·핵심 역량).
// 개인 소개는 옛 소개 섹션에서 옮겨 왔다(설계 2026-09-25 §2 — 첫 화면 다음은 프로젝트 소개).
// 이름의 언어별 표기와 역할(ML ENGINEER)도 첫 화면에서 여기로 옮겼다 — 첫 화면은 SIGNAL만(사용자 결정 2026-09-29).
import { EmailLink } from '../EmailLink';
import { ResumeLink } from '../Header';
import { getT } from '@/lib/content';
import { facts } from '@/lib/facts';
import type { Locale } from '@/lib/i18n';
import { resumeHref } from '@/lib/resume';
import { destinationCodes } from '@/lib/ticket';

// content/*.json의 contact.about.skills.* 키와 순서를 맞춘 목록
const SKILLS = ['collection', 'modeling', 'validation', 'interval'] as const;

// 칸 이름: 눈에는 실제 탑승권처럼 영어 대문자(PASSENGER), 화면 낭독기에는 그 언어 이름(탑승객)을 읽힌다.
// aria-label은 dt 같은 일반 요소에서 무시되는 낭독기가 있어, 숨긴 글자(sr-only)로 바꿔 끼운다
function Label({ code, text }: { code: string; text: string }) {
  return <dt className="pass-label mono"><span aria-hidden="true">{code}</span><span className="sr-only">{text}</span></dt>;
}

// 노선 점선 가운데의 작은 비행기(꾸밈). ✈ 글자는 기기에 따라 컬러 이모지로 나와 SVG로 그린다
function PlaneGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" focusable="false">
      <path fill="currentColor" d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z" transform="rotate(90 12 12)" />
    </svg>
  );
}

export function Contact({ locale }: { locale: Locale }) {
  const t = getT(locale);
  const { emailReversed, github, linkedin, ticket } = facts.contact;
  const sub = t('contact.nameSub'); // en은 빈 값 — 로마자 표기가 곧 그 언어 표기라 덧붙이지 않는다
  return (
    <section id="contact" data-scene="contact" className="wrap" aria-labelledby="contact-h">
      <p className="eyebrow">CONTACT</p>
      <h2 id="contact-h" className="display" data-reveal>{t('contact.heading')}</h2>
      {/* 가로 탑승권(설계 2026-10-01, 시안 A): 왼쪽 본권(노선·칸) | 절취선 | 오른쪽 꼬리표(편명·이력서·바코드).
          좁은 화면에서는 꼬리표가 아래로 내려간다(CSS). 꾸밈 값은 facts.contact.ticket에 있다 */}
      <div className="pass">
        <div className="pass-main">
          <p className="pass-head mono">
            <span>BOARDING PASS</span>
            {/* 편명은 꼬리표에서 한 번 읽히므로 여기서는 눈으로만 */}
            <span aria-hidden="true"><span className="pass-head-brand">SIGNAL · </span>{ticket.flight}</span>
          </p>
          <div className="pass-route">
            <dl>
              <div><Label code="FROM" text={t('contact.from')} /><dd>
                <span className="display pass-code">{facts.site.airport.code}</span>
                <span className="pass-city mono">{ticket.fromCity}</span>
              </dd></div>
            </dl>
            <span className="pass-path" aria-hidden="true"><PlaneGlyph /></span>
            <dl className="pass-to">
              <div><Label code="TO" text={t('contact.to')} /><dd>
                <span className="display pass-code">{destinationCodes(facts.data.byRoute).join(' · ')}</span>
                <span className="pass-city mono">{ticket.toCity}</span>
              </dd></div>
            </dl>
          </div>
          <dl className="pass-grid">
            <div className="pass-passenger"><Label code="PASSENGER" text={t('contact.passenger')} /><dd>
              <span className="display pass-name">CHOI HALIM</span>
              {sub && <span className="pass-name-sub" lang={locale}>{sub}</span>}
            </dd></div>
            <div><Label code="CLASS" text={t('contact.class')} /><dd className="mono">{t('contact.role')}</dd></div>
            <div><Label code="BOARDING" text={t('contact.boarding')} /><dd className="mono">{facts.profile.graduation}</dd></div>
            <div><Label code="GATE" text={t('contact.gate')} /><dd className="mono">{ticket.gate}</dd></div>
            <div className="pass-wide"><Label code="EMAIL" text={t('contact.email')} /><dd><EmailLink reversed={emailReversed} fallback={t('contact.emailFallback')} /></dd></div>
            <div className="pass-wide"><Label code="GITHUB" text={t('contact.github')} /><dd><a href={github} target="_blank" rel="noopener noreferrer">{github.replace('https://', '')}</a></dd></div>
            {/* LinkedIn 값이 비어 있으면(global-constraints) 행 자체를 숨긴다 */}
            {linkedin && (
              <div className="pass-wide" data-testid="linkedin"><Label code="LINKEDIN" text={t('contact.linkedin')} /><dd><a href={linkedin} target="_blank" rel="noopener noreferrer">{linkedin.replace('https://', '')}</a></dd></div>
            )}
          </dl>
        </div>
        <div className="pass-stub">
          <dl>
            <div className="pass-stub-head"><Label code="FLIGHT" text={t('contact.flight')} /><dd className="mono">{ticket.flight}</dd></div>
            {/* 본권의 탑승객 칸을 되풀이한 꾸밈이라 화면 낭독기에는 두 번 읽히지 않게 숨긴다 */}
            <div aria-hidden="true"><dt className="pass-label mono">PASSENGER</dt><dd className="display pass-stub-name">CHOI HALIM</dd></div>
            <div><Label code="RESUME" text={t('contact.resume')} /><dd><ResumeLink href={resumeHref(locale)} label="PDF ↓" pendingLabel={t('contact.resumePending')} locale={locale} /></dd></div>
          </dl>
          <div className="pass-barcode" aria-hidden="true" />
        </div>
      </div>
      <div className="contact-about">
        <h3>{t('contact.about.heading')}</h3>
        <p className="mono about-role">{t('contact.role')}</p>
        <p className="muted">{t('contact.about.education')}</p>
        {/* 소개 본문 세 문장은 ①·⑤와 아래 핵심 역량이 이미 하는 말이라 뺐다 — 신원 한 줄 + 역량만(2026-10-07 결정) */}
        <h4>{t('contact.about.skillsHeading')}</h4>
        <ul className="skills">{SKILLS.map((s) => <li key={s}>{t(`contact.about.skills.${s}`)}</li>)}</ul>
      </div>
    </section>
  );
}
