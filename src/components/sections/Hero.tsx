// 첫 화면(히어로) 섹션: 포트폴리오 이름 SIGNAL과 키워드. data-scene 속성으로 3D 장면(hero)을 고른다.
// 이름·역할은 연락처(자기소개) 섹션으로 옮겼다 — 첫 화면에서는 포트폴리오에 먼저 눈이 가게(사용자 결정 2026-09-29)
import { ChapterFigure } from './ChapterFigure';
import { getT } from '@/lib/content';
import type { Locale } from '@/lib/i18n';
import { facts } from '@/lib/facts';

export function Hero({ locale }: { locale: Locale }) {
  const t = getT(locale);
  return (
    // 감싸개가 장면 이름을 가진다 — 3D가 맨 위에서 켜지면 아래 여백(globals.css의 html.hero-runway,
    // Backdrop.tsx setMode가 붙인다)까지 첫 화면 장면이라 그동안 카메라가 내려앉는다
    <div className="hero-stage" data-scene="hero">
      <section id="hero" className="hero wrap">
        <div className="hero-copy">
          <h1 className="display hero-title">SIGNAL</h1>
          <p className="hero-keywords">{t('hero.keywords')}</p>
        </div>
        {/* 오른쪽 아래 메타 줄(설계 §4.4): 공항 좌표와 노선. 숫자는 facts에서 조립한다. 장식이라 낭독하지 않는다 */}
        <p className="hero-meta mono" aria-hidden="true">
          {facts.site.airport.code} · {facts.site.airport.lat.toFixed(2)}°N {facts.site.airport.lon.toFixed(2)}°E<br />
          {facts.site.airport.code} ⇄ {[...new Set(facts.data.byRoute.map((r) => r.pair.split('_')[1]))].join(' · ')}
        </p>
        {/* 스크롤 표시(설계 2026-09-28 첫 화면 다듬기 §4): 장식이라 낭독하지 않는다. 보임·숨김은 html[data-hint](ScrollState) */}
        <div className="scroll-hint mono" aria-hidden="true">SCROLL<i /></div>
        <ChapterFigure locale={locale} sceneKey="hero" />
      </section>
    </div>
  );
}
