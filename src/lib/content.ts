// 3개 언어 문구 딕셔너리를 모으고, 키로 문장을 찾아 facts 수치를 채워 넣는 getT()를 만든다.
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

// 중첩된 문구 객체를 "about.body1" 같은 점 표기 키로 평탄화한다. 테스트에서 세 언어의 키 목록을
// 비교하거나, 모든 문장에 자리표시·숫자 규칙이 지켜졌는지 훑어볼 때 쓴다.
export function flatten(dict: unknown, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(dict as Record<string, unknown>)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') out[key] = v;
    else Object.assign(out, flatten(v, key));
  }
  return out;
}
