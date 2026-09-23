// 3개 언어 전체의 공용 404 화면(Next의 global-not-found). 정적 export에는 로케일별 not-found를
// 둘 수 없어 한 화면에서 ko/en/ja 안내를 모두 보여준다.
import '@/styles/globals.css';
import { dictionaries } from '@/lib/content';
import { LOCALE_PATH, LOCALES } from '@/lib/i18n';
import { baseFontVars } from '@/styles/fonts';
import { jp } from '@/styles/font-jp';

export const metadata = { title: '404 — SIGNAL' };

export default function GlobalNotFound() {
  return (
    <html lang="ko" className={`${baseFontVars} ${jp.variable}`}>
      <body>
        <main id="main" className="wrap not-found">
          <p className="eyebrow">GATE 404 — NOT FOUND</p>
          {LOCALES.map((l) => (
            <p key={l} lang={l}>
              {dictionaries[l].notFound.title} · <a href={LOCALE_PATH[l]}>{dictionaries[l].notFound.home}</a>
            </p>
          ))}
        </main>
      </body>
    </html>
  );
}
