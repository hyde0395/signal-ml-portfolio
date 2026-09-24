// 추천 이유 코드 → 문장. demo.json은 한국어 문장이 아니라 코드와 값만 담는다(스펙 §6.2).
// 문장은 언어별 문구 틀(content/*.json의 demo.why.*)에 값을 채워 만든다. 틀 안의 {v.…}가 여기서 채우는 값이다.
import type { DemoTexts } from '@/lib/content';
import { interpolate, type Locale } from '@/lib/i18n';
import type { Reco } from './types';

export function reasonText(texts: DemoTexts, reco: Reco, locale: Locale): string {
  return interpolate(texts.why[reco.why], { v: reco }, locale);
}

// 확신도는 대기·하락 예상일 때만 보인다(스펙 §6.1). 모델은 '높음'·'보통' 두 단계만 낸다
export function confidenceText(texts: DemoTexts, reco: Reco): string | null {
  if (reco.action === 'BUY_NOW' || reco.confidence === null) return null;
  return `${texts.confidence.label}: ${texts.confidence[reco.confidence]}`;
}

// 문구 검사(content.test.ts)가 {v.…} 자리표시를 채워 볼 때 쓰는 견본 값.
// 데모 문구에 새 {v.이름}을 넣으면 여기에도 추가해야 테스트가 통과한다.
export const SAMPLE_VALUES = {
  date: '2026-11-14',
  day: 'Sat, November 14',
  asOf: '2026-09-22',
  price: 187400,
  lo: 152000,
  hi: 231000,
  cabin: 'LCC',
  holiday: 'Hangul Day',
  action: 'DROP EXPECTED',
  bestDay: 30,
  bestPrice: 171000,
  waitDays: 12,
  saving: 16400,
  savingPct: 8.7,
  globalBestDay: 35,
};
