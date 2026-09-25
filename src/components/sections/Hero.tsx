// 첫 화면(히어로) 섹션: 이름, 역할, 한 줄 소개. data-scene 속성으로 3D 장면(hero)을 고른다.
import { ChapterFigure } from './ChapterFigure';
import { getT } from '@/lib/content';
import type { Locale } from '@/lib/i18n';

export function Hero({ locale }: { locale: Locale }) {
  const t = getT(locale);
  const sub = t('hero.nameSub');
  return (
    <section id="hero" data-scene="hero" className="hero wrap">
      {/* text-scrim: 글 뒤에 어두운 판을 깔아 3D 점이나 대체 이미지 위에서도 대비를 지킨다(globals.css) */}
      <div className="hero-copy text-scrim">
        <h1 className="display hero-name">CHOI HALIM</h1>
        {sub && <p className="hero-sub" lang={locale}>{sub}</p>}
        <p className="mono hero-role">{t('hero.role')}</p>
        <p className="hero-keywords">{t('hero.keywords')}</p>
      </div>
      <ChapterFigure locale={locale} sceneKey="hero" />
    </section>
  );
}
