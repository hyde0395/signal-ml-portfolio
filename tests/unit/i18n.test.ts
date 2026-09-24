// lookup/formatValue/interpolate/createT — 자리표시 치환 로직의 각 단계를 개별로 검증한다.
import { describe, expect, it } from 'vitest';
import { createT, formatValue, interpolate, lookup, prefill } from '@/lib/i18n';

const src = { model: { mae: 48235, r2: 0.637, curve: [{ pct: 11.1 }, { pct: -5 }] }, d: '2026-04-23', g: '2028-02', y: 2028 };

describe('lookup', () => {
  it('점 경로와 배열 인덱스를 따라간다', () => {
    expect(lookup(src, 'model.curve.1.pct')).toBe(-5);
    expect(lookup(src, 'model.none')).toBeUndefined();
  });
});

describe('formatValue', () => {
  it('숫자는 언어별 천 단위 구분', () => {
    expect(formatValue(48235, undefined, 'ko')).toBe('48,235');
    expect(formatValue(0.637, undefined, 'en')).toBe('0.637');
  });
  it('signed는 부호를 붙인다', () => {
    expect(formatValue(11.1, 'signed', 'ko')).toBe('+11.1');
    expect(formatValue(-5, 'signed', 'ko')).toMatch(/^[-−]5\.0$/);
  });
  it('plain은 구분 기호 없이', () => {
    expect(formatValue(2028, 'plain', 'ko')).toBe('2028');
  });
  it('date와 month는 언어별 표기', () => {
    expect(formatValue('2026-04-23', 'date', 'ko')).toBe('2026년 4월 23일');
    expect(formatValue('2026-04-23', 'date', 'ja')).toBe('2026年4月23日');
    expect(formatValue('2028-02', 'month', 'en')).toBe('Feb 2028');
    expect(formatValue('2028-02', 'month', 'ko')).toBe('2028년 2월');
    expect(formatValue('2028-02', 'month', 'ja')).toBe('2028年2月');
  });
  it('형식과 값이 맞지 않으면 throw', () => {
    expect(() => formatValue('abc', 'signed', 'ko')).toThrow();
  });
});

describe('interpolate', () => {
  it('자리표시를 채운다', () => {
    expect(interpolate('MAE {model.mae}원, 곡선 {model.curve.0.pct|signed}%', src, 'ko')).toBe('MAE 48,235원, 곡선 +11.1%');
  });
  it('없는 경로는 throw (화면에 {..}가 찍히지 않게)', () => {
    expect(() => interpolate('{model.nope}', src, 'ko')).toThrow(/model\.nope/);
  });
});

describe('createT', () => {
  const t = createT({ a: { b: '값 {model.r2}' }, n: 3 }, src, 'ko');
  it('키로 문장을 찾고 채운다', () => expect(t('a.b')).toBe('값 0.637'));
  it('없는 키는 throw', () => expect(() => t('a.c')).toThrow(/a\.c/));
  it('문자열이 아닌 키는 throw', () => expect(() => t('n')).toThrow());
});

describe('데모용 형식', () => {
  it('fixed1: 소수 첫째 자리, 부호 없음', () => {
    expect(formatValue(8.66, 'fixed1', 'ko')).toBe('8.7');
    expect(formatValue(12, 'fixed1', 'en')).toBe('12.0');
  });
  it('md: 월·일·요일(연도 없음)', () => {
    const ko = formatValue('2026-11-14', 'md', 'ko');
    expect(ko).toContain('11월');
    expect(ko).toContain('14일');
    expect(ko).toContain('토');
    expect(formatValue('2026-11-14', 'md', 'en')).toMatch(/Sat.*Nov.*14/);
    expect(formatValue('2026-11-14', 'md', 'ja')).toMatch(/11月14日.*土/);
  });
});

describe('prefill', () => {
  it('facts 자리표시만 채우고 {v.…}는 남긴다', () => {
    const source = { model: { interval: { level: 80 } } };
    expect(prefill('{model.interval.level}% · {v.price}원 · {v.date|md}', source, 'ko')).toBe('80% · {v.price}원 · {v.date|md}');
  });
  it('남긴 {v.…}는 나중에 interpolate로 채운다', () => {
    const t = prefill('{v.price}원', {}, 'ko');
    expect(interpolate(t, { v: { price: 187400 } }, 'ko')).toBe('187,400원');
  });
  it('facts에 없는 경로는 여전히 throw', () => {
    expect(() => prefill('{model.nope}', {}, 'ko')).toThrow('Missing fact');
  });
});
