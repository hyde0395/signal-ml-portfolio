// 데모 결과(스펙 §6.1): 예측가 → 80% 예측 구간 띠 → 추천 배지 + 이유 → (대기·하락일 때만) 확신도.
// 예측가는 계획 4에서 플립 글자판으로 바뀔 자리라 data-flip을 붙여 둔다(지금은 완성된 값만 보인다).
import type { DemoTexts } from '@/lib/content';
import { interpolate, type Locale } from '@/lib/i18n';
import { confidenceText, reasonText } from '@/demo/reason';
import type { Action, Forecast } from '@/demo/types';

// 배지는 세 언어 공통 영어 표기(GATE 제목처럼)다. 색만으로 뜻을 전하지 않도록 늘 글자를 함께 쓴다(§9.4)
export const BADGE: Record<Action, string> = { BUY_NOW: 'BUY NOW', DROP_EXPECTED: 'DROP EXPECTED', WAIT: 'WAIT' };

// 띠 막대 안에서 lo~hi가 차지하는 구간(%). 양 끝을 비워 예측가 표시가 가장자리에 붙지 않게 한다
const BAND_FROM = 10;
const BAND_TO = 90;

export function DemoResult({ forecast, locale, texts }: { forecast: Forecast; locale: Locale; texts: DemoTexts }) {
  const { price, lo, hi, reco } = forecast;
  const money = (v: number) => interpolate(texts.money, { v: { price: v } }, locale);
  const raw = hi > lo ? BAND_FROM + ((BAND_TO - BAND_FROM) * (price - lo)) / (hi - lo) : 50;
  const mid = Math.min(100, Math.max(0, raw)); // 예측가가 구간 밖이어도 표시가 막대를 벗어나지 않게
  const conf = confidenceText(texts, reco);
  return (
    <div className="demo-result">
      <p className="demo-price">
        <span className="eyebrow">{texts.result.price}</span>
        <span className="mono" data-flip>{money(price)}</span>
      </p>
      <div className="band" role="img" aria-label={interpolate(texts.result.rangeAria, { v: { lo, hi } }, locale)}>
        <span className="band-fill" style={{ left: `${BAND_FROM}%`, right: `${100 - BAND_TO}%` }} />
        <span className="band-mid" style={{ left: `${mid}%` }} />
      </div>
      <p className="band-labels mono">
        <span>{money(lo)}</span>
        <span className="muted">{texts.result.range}</span>
        <span>{money(hi)}</span>
      </p>
      {/* 보이는 배지는 세 언어 공통 영어, 스크린리더는 그 언어 낭독 문구를 읽는다 */}
      <p className={`badge is-${reco.action.toLowerCase()}`}>
        <span aria-hidden="true">{BADGE[reco.action]}</span>
        <span className="sr-only">{texts.badges[reco.action]}</span>
      </p>
      <p>{reasonText(texts, reco, locale)}</p>
      {conf && <p className="muted">{conf}</p>}
    </div>
  );
}
