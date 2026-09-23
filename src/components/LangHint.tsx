'use client';
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
