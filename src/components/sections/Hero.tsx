// 첫 화면(히어로) 섹션: 이름, 역할, 한 줄 소개. data-scene 속성으로 3D 장면(hero)을 고른다.
import { ChapterFigure } from './ChapterFigure';
import { getT } from '@/lib/content';
import type { Locale } from '@/lib/i18n';
import { facts } from '@/lib/facts';

export function Hero({ locale }: { locale: Locale }) {
  const t = getT(locale);
  const sub = t('hero.nameSub');
  return (
    // 감싸개가 장면 이름을 가진다 — 3D가 맨 위에서 켜지면 아래 여백(globals.css의 html.hero-runway,
    // Backdrop.tsx setMode가 붙인다)까지 첫 화면 장면이라 그동안 카메라가 내려앉는다
    <div className="hero-stage" data-scene="hero">
      <section id="hero" className="hero wrap">
        <div className="hero-copy">
          <h1 className="display hero-name">CHOI HALIM</h1>
          {sub && <p className="hero-sub" lang={locale}>{sub}</p>}
          <p className="mono hero-role">{t('hero.role')}</p>
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
