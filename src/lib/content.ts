import en from '../../content/en.json';
import ja from '../../content/ja.json';
import ko from '../../content/ko.json';
import { facts } from './facts';
import { createT, type Locale } from './i18n';

export type Dict = typeof ko;
export const dictionaries: Record<Locale, Dict> = { ko, en, ja };

export function getT(locale: Locale): (key: string) => string {
  return createT(dictionaries[locale], facts, locale);
}

export function flatten(dict: unknown, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(dict as Record<string, unknown>)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') out[key] = v;
    else Object.assign(out, flatten(v, key));
  }
  return out;
}
