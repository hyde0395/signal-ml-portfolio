// 데모 문구 검사: 이유 코드 6종이 세 언어로 조립되는지, 확신도 표시 조건, 질문 문장 틀,
// 서버에서 facts만 채운 문구, 그리고 커밋된 demo.json의 공휴일 코드에 이름표가 모두 있는지.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { confidenceText, reasonText } from '@/demo/reason';
import { WHYS, demoUrl, type Reco } from '@/demo/types';
import { demoTexts } from '@/lib/content';
import { facts } from '@/lib/facts';
import { LOCALES } from '@/lib/i18n';

const reco = (over: Partial<Reco>): Reco => ({
  action: 'BUY_NOW', why: 'AT_LOW', bestDay: 30, bestPrice: 171000, waitDays: 12, saving: 16400,
  savingPct: 8.7, globalBestDay: 35, confidence: null, ...over,
});

describe.each(LOCALES)('%s', (locale) => {
  const texts = demoTexts(locale);

  it('facts 수치는 채워지고 {v.…}는 남는다', () => {
    expect(texts.intro).not.toContain('{model.');
    expect(texts.money).toContain('{v.price}');
  });

  it('질문 문장에 노선·등급·날짜 자리가 하나씩 있다', () => {
    for (const slot of ['[route]', '[cabin]', '[date]']) expect(texts.sentence.split(slot)).toHaveLength(2);
  });

  it.each(WHYS)('이유 %s: 자리표시가 모두 채워진다', (why) => {
    const s = reasonText(texts, reco({ why }), locale);
    expect(s).not.toMatch(/[{}]/);
    expect(s.length).toBeGreaterThan(5);
  });

  it('하락 예상 이유에 값이 들어간다', () => {
    const s = reasonText(texts, reco({ action: 'DROP_EXPECTED', why: 'FALLING', confidence: 'medium' }), locale);
    expect(s).toContain('171,000');
    expect(s).toContain('8.7');
    expect(s).toContain('12');
  });

  it('확신도는 대기·하락일 때만', () => {
    expect(confidenceText(texts, reco({ confidence: 'high' }))).toBeNull();
    expect(confidenceText(texts, reco({ action: 'WAIT', why: 'LATER_LOW', confidence: 'high' }))).toContain(texts.confidence.high);
  });

  it('demo.json의 공휴일 코드마다 이름표가 있다', () => {
    const demo = JSON.parse(readFileSync(`public${demoUrl(facts.dataVersion)}`, 'utf-8')) as { holidays: Record<string, string> };
    const labels = texts.holidays as Record<string, string>;
    for (const code of new Set(Object.values(demo.holidays))) expect(labels[code], `${locale}: ${code}`).toBeTruthy();
  });
});
