// 로케일별 layout이 공유하는 <html>/<body> 뼈대. 건너뛰기 링크와 언어 안내(LangHint)를 여기서 공통으로 넣는다.
import '@/styles/globals.css';
import { Analytics } from '@vercel/analytics/next';
import { LangHint } from './LangHint';
import { dictionaries, getT } from '@/lib/content';
import type { Locale } from '@/lib/i18n';
import { baseFontVars } from '@/styles/fonts';

export function RootDocument({ locale, extraClass = '', children }: { locale: Locale; extraClass?: string; children: React.ReactNode }) {
  const t = getT(locale);
  const offers = { ko: dictionaries.ko.langHint.offer, en: dictionaries.en.langHint.offer, ja: dictionaries.ja.langHint.offer };
  return (
    <html lang={locale} className={`${baseFontVars} ${extraClass}`.trim()}>
      <body>
        <a className="skip" href="#main">{t('nav.skip')}</a>
        <LangHint current={locale} offers={offers} dismiss={t('langHint.dismiss')} />
        {children}
        {/* 방문 수·유입 경로(쿠키 없음, 스펙 §12). Vercel 대시보드에서 Web Analytics를 켜야 집계된다 */}
        <Analytics />
      </body>
    </html>
  );
}
