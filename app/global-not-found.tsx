import '@/styles/globals.css';
import { dictionaries } from '@/lib/content';
import { LOCALE_PATH, LOCALES } from '@/lib/i18n';
import { baseFontVars, jp } from '@/styles/fonts';

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
