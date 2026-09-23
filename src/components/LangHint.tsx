'use client';
// 브라우저 언어(또는 이전 선택)가 현재 페이지와 다르면 다른 언어 페이지로 가는 링크를 안내한다.
// 자동으로 이동시키지 않는 이유: 사용자가 받은 링크(예: 이력서에 적힌 특정 언어 주소)를 그대로
// 보여주기 위해서다 — 강제 리다이렉트는 global-constraints의 "자동 언어 리다이렉트 금지"에 어긋난다.
import { useEffect, useState } from 'react';
import { LOCALE_PATH, LOCALES, type Locale } from '@/lib/i18n';

function preferred(): Locale | null {
  try {
    const saved = localStorage.getItem('signal.lang');
    if (saved && (LOCALES as readonly string[]).includes(saved)) return saved as Locale;
  } catch { /* 무시 */ }
  for (const tag of navigator.languages ?? [navigator.language]) {
    const base = tag.slice(0, 2).toLowerCase();
    if ((LOCALES as readonly string[]).includes(base)) return base as Locale;
  }
  return null;
}

export function LangHint({ current, offers, dismiss }: { current: Locale; offers: Record<Locale, string>; dismiss: string }) {
  const [target, setTarget] = useState<Locale | null>(null);
  useEffect(() => {
    try { if (sessionStorage.getItem('signal.hintDismissed')) return; } catch { /* 무시 */ }
    const p = preferred();
    if (p && p !== current) setTarget(p);
  }, [current]);
  if (!target) return null;
  const close = () => {
    try { sessionStorage.setItem('signal.hintDismissed', '1'); } catch { /* 무시 */ }
    setTarget(null);
  };
  return (
    <aside className="lang-hint" lang={target}>
      <a href={LOCALE_PATH[target]} hrefLang={target}>{offers[target]}</a>
      <button type="button" onClick={close} aria-label={dismiss}>×</button>
    </aside>
  );
}
