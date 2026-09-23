// content/*.json 문구 파일 자체를 검증한다: 세 언어의 키가 일치하는지, 모든 자리표시가 facts에서
// 채워지는지, 그리고 문장에 숫자를 직접 쓰지 않았는지(재학습으로 수치가 바뀌면 facts.json만
// 고치면 되도록 강제한다).
import { describe, expect, it } from 'vitest';
import { facts } from '@/lib/facts';
import { interpolate, LOCALES, PLACEHOLDER } from '@/lib/i18n';
import { dictionaries, flatten } from '@/lib/content';

const MAY_BE_EMPTY = new Set(['hero.nameSub']);

const flat = Object.fromEntries(LOCALES.map((l) => [l, flatten(dictionaries[l])]));

describe('문구 파일', () => {
  it('세 언어의 키 목록이 같다', () => {
    const ko = Object.keys(flat.ko).sort();
    expect(Object.keys(flat.en).sort()).toEqual(ko);
    expect(Object.keys(flat.ja).sort()).toEqual(ko);
  });

  for (const locale of LOCALES) {
    it(`${locale}: 모든 자리표시가 facts에서 해석된다`, () => {
      for (const [key, text] of Object.entries(flat[locale])) {
        expect(() => interpolate(text, facts, locale), key).not.toThrow();
      }
    });

    it(`${locale}: 자리표시 밖에 숫자를 직접 쓰지 않는다`, () => {
      for (const [key, text] of Object.entries(flat[locale])) {
        const rest = text.replace(PLACEHOLDER, '');
        expect(rest, `${locale}:${key} → "${text}"`).not.toMatch(/[0-9０-９]/);
      }
    });

    it(`${locale}: 빈 문장이 없다`, () => {
      for (const [key, text] of Object.entries(flat[locale])) {
        if (!MAY_BE_EMPTY.has(key)) expect(text.trim(), `${locale}:${key}`).not.toBe('');
      }
    });
  }
});
