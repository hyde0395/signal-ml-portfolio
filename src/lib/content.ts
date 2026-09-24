// 3개 언어 문구 딕셔너리를 모으고, 키로 문장을 찾아 facts 수치를 채워 넣는 getT()를 만든다.
import en from '../../content/en.json';
import ja from '../../content/ja.json';
import ko from '../../content/ko.json';
import { facts } from './facts';
import { createT, prefill, type Locale } from './i18n';

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

export type DemoTexts = Dict['demo'];

// 데모 문구: facts 수치는 서버에서 채우고 {v.…}는 남긴 채, 그 언어 것만 클라이언트 DemoApp에 넘긴다.
// (세 언어 사전과 facts 전체를 클라이언트 JS에 싣지 않기 위해)
export function demoTexts(locale: Locale): DemoTexts {
  const walk = (node: unknown): unknown =>
    typeof node === 'string'
      ? prefill(node, facts, locale)
      : Object.fromEntries(Object.entries(node as Record<string, unknown>).map(([k, v]) => [k, walk(v)]));
  return walk(dictionaries[locale].demo) as DemoTexts;
}
