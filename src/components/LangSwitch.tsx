'use client';
// 헤더의 KO/EN/JA 전환 링크. 클릭한 언어를 localStorage에 남겨 LangHint가 다음 방문 때 참고한다.
import { LOCALE_PATH, LOCALES, type Locale } from '@/lib/i18n';

export function LangSwitch({ current, label }: { current: Locale; label: string }) {
  const remember = (l: Locale) => {
    try { localStorage.setItem('signal.lang', l); } catch { /* 저장 불가 환경은 무시 */ }
  };
  return (
    <nav aria-label={label} className="lang-switch mono">
      {LOCALES.map((l) => (
        <a key={l} href={LOCALE_PATH[l]} hrefLang={l} lang={l}
           aria-current={l === current ? 'page' : undefined} onClick={() => remember(l)}>
          {l.toUpperCase()}
        </a>
      ))}
    </nav>
  );
}
