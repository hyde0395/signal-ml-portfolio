export type Locale = 'ko' | 'en' | 'ja';
export const LOCALES: readonly Locale[] = ['ko', 'en', 'ja'];
export const LOCALE_PATH: Record<Locale, string> = { ko: '/', en: '/en/', ja: '/ja/' };
export const INTL_LOCALE: Record<Locale, string> = { ko: 'ko-KR', en: 'en-US', ja: 'ja-JP' };

export const PLACEHOLDER = /\{([A-Za-z0-9_.]+)(?:\|([a-z]+))?\}/g;

export function lookup(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>(
    (acc, key) => (acc !== null && typeof acc === 'object' ? (acc as Record<string, unknown>)[key] : undefined),
    obj,
  );
}

export function formatValue(value: unknown, format: string | undefined, locale: Locale): string {
  const intl = INTL_LOCALE[locale];
  if (format === undefined) {
    if (typeof value === 'number') return new Intl.NumberFormat(intl, { maximumFractionDigits: 3 }).format(value);
    if (typeof value === 'string') return value;
  }
  if (format === 'signed' && typeof value === 'number') {
    return new Intl.NumberFormat(intl, { maximumFractionDigits: 3, signDisplay: 'exceptZero' }).format(value);
  }
  if (format === 'plain' && typeof value === 'number') return String(value);
  if (format === 'date' && typeof value === 'string') {
    return new Intl.DateTimeFormat(intl, { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })
      .format(new Date(`${value}T00:00:00Z`));
  }
  if (format === 'month' && typeof value === 'string') {
    return new Intl.DateTimeFormat(intl, { year: 'numeric', month: locale === 'en' ? 'short' : 'long', timeZone: 'UTC' })
      .format(new Date(`${value}-01T00:00:00Z`));
  }
  throw new Error(`Cannot format ${JSON.stringify(value)} as "${format ?? 'default'}"`);
}

export function interpolate(template: string, source: unknown, locale: Locale): string {
  return template.replace(PLACEHOLDER, (_, path: string, format: string | undefined) => {
    const value = lookup(source, path);
    if (value === undefined) throw new Error(`Missing fact for placeholder {${path}}`);
    return formatValue(value, format, locale);
  });
}

export function createT(dict: unknown, source: unknown, locale: Locale): (key: string) => string {
  return (key) => {
    const template = lookup(dict, key);
    if (typeof template !== 'string') throw new Error(`Missing text for key "${key}" (${locale})`);
    return interpolate(template, source, locale);
  };
}
