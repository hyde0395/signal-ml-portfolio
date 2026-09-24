'use client';
// 데모 조작 화면(스펙 §6.1 B1): 질문 문장 속 선택지(노선·등급·날짜) + 출발일 막대 + 결과.
// 데이터는 섹션이 화면 가까이 올 때 처음 불러오고(스펙 §8.1), zod가 든 데이터 모듈은 그때 dynamic import해
// 초기 JS에 싣지 않는다. 화면은 ForecastSource 인터페이스만 알기 때문에, 나중에 API로 바꿔도 이 파일은 그대로다.
import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { DateStrip } from './DateStrip';
import { DemoResult } from './DemoResult';
import type { DemoTexts } from '@/lib/content';
import { formatValue, interpolate, type Locale } from '@/lib/i18n';
import { reasonText } from '@/demo/reason';
import { dayFormat, edgeSelectable, nearestSelectable } from '@/demo/strip';
import { ROUTES, type Cabin, type Forecast, type ForecastSource, type Route, type StripDay } from '@/demo/types';

type Props = {
  locale: Locale;
  texts: DemoTexts;
  dataUrl: string;
  initial: { route: Route; cabin: Cabin; date: string };
  initialAsOf: string;
};
type Status = 'idle' | 'loading' | 'error' | 'ready';
type Slot = 'route' | 'cabin' | 'date';

// 막대를 끌거나 화살표를 연달아 누르는 동안은 읽지 않고, 멈춘 뒤 한 번만 알린다(스펙 §9.3)
const ANNOUNCE_DELAY_MS = 700;
// 섹션이 화면 아래 600px 안으로 들어오면 미리 불러온다(스크롤해 도착했을 때 이미 준비되도록)
const LOAD_MARGIN = '600px 0px';

export function DemoApp({ locale, texts, dataUrl, initial, initialAsOf }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const source = useRef<ForecastSource | null>(null);
  const wantedDate = useRef(initial.date); // 노선·등급을 바꿔도 방문자가 고른 출발일을 유지하려고 기억한다
  const touched = useRef(false);           // 첫 표시 때는 알리지 않고, 방문자가 조작한 뒤에만 알린다
  const [status, setStatus] = useState<Status>('idle');
  const [asOf, setAsOf] = useState(initialAsOf);
  const [route, setRoute] = useState<Route>(initial.route);
  const [cabin, setCabin] = useState<Cabin>(initial.cabin);
  // 막대에 어느 노선·등급 것인지 꼬리표를 단다. 노선을 바꾼 직후엔 막대가 아직 옛 조합 것이라, 그 날짜로
  // 새 조합 예측을 찾지 않게 하려는 것이다(없는 날이면 "예측 없음"이 잠깐 번쩍인다)
  const [strip, setStrip] = useState<{ key: string; days: StripDay[] }>({ key: '', days: [] });
  const [index, setIndex] = useState(-1);
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [announce, setAnnounce] = useState('');

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      if (!source.current) {
        const { StaticForecastSource } = await import('@/demo/source');
        source.current = new StaticForecastSource(dataUrl);
      }
      setAsOf((await source.current.meta()).asOf);
      setStatus('ready');
    } catch (e) {
      console.warn('데모 데이터를 불러오지 못했다', e);
      setStatus('error');
    }
  }, [dataUrl]);

  const combo = `${route}/${cabin}`;
  const days = strip.days;
  const fmt = dayFormat(days.map((d) => d.date));

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      void load();
      return;
    }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        io.disconnect();
        void load();
      }
    }, { rootMargin: LOAD_MARGIN });
    io.observe(el);
    return () => io.disconnect();
  }, [load]);

  // 노선·등급이 바뀌면 막대를 새로 받는다. 전에 고른 출발일이 비어 있으면 가장 가까운 날로 옮긴다
  useEffect(() => {
    const src = source.current;
    if (status !== 'ready' || !src) return;
    let alive = true;
    src.getStrip(route, cabin).then(
      (next) => {
        if (!alive) return;
        setStrip({ key: `${route}/${cabin}`, days: next });
        const i = next.findIndex((d) => d.date === wantedDate.current);
        setIndex(i >= 0 ? nearestSelectable(next, i) : edgeSelectable(next, 'first'));
      },
      () => { if (alive) setStatus('error'); },
    );
    return () => { alive = false; };
  }, [status, route, cabin]);

  useEffect(() => {
    const src = source.current;
    if (strip.key !== combo) return; // 새 조합의 막대가 오기 전이다
    const day = strip.days[index];
    if (!src || !day) {
      setForecast(null);
      return;
    }
    let alive = true;
    // 나중의 API 소스는 실패할 수 있어 getStrip처럼 거절도 오류 화면으로 보낸다
    src.getForecast(route, cabin, day.date).then(
      (f) => { if (alive) setForecast(f); },
      () => { if (alive) setStatus('error'); },
    );
    return () => { alive = false; };
  }, [strip, combo, index, route, cabin]);

  useEffect(() => {
    if (!touched.current) return;
    const id = window.setTimeout(() => {
      // 조작한 뒤 예측이 없어졌다면 그 사실도 알린다(결과 칸이 바뀌었는데 조용하면 안 되므로)
      if (!forecast) {
        setAnnounce(texts.noForecast);
        return;
      }
      const head = interpolate(
        texts.announce,
        { v: { day: formatValue(forecast.date, fmt, locale), price: forecast.price, action: texts.badges[forecast.reco.action] } },
        locale,
      );
      setAnnounce(`${head} ${reasonText(texts, forecast.reco, locale)}`);
    }, ANNOUNCE_DELAY_MS);
    return () => window.clearTimeout(id);
  }, [forecast, texts, locale, fmt]);

  const day = days[index];
  const slots: Record<Slot, ReactNode> = {
    route: (
      <select
        className="demo-slot"
        aria-label={texts.routeLabel}
        value={route}
        onChange={(e) => { touched.current = true; setRoute(e.target.value as Route); }}
      >
        {ROUTES.map((r) => <option key={r} value={r}>{texts.routes[r]}</option>)}
      </select>
    ),
    cabin: (
      <button
        type="button"
        className="demo-slot demo-cabin"
        aria-label={interpolate(texts.cabinToggle, { v: { cabin } }, locale)}
        onClick={() => { touched.current = true; setCabin((c) => (c === 'LCC' ? 'FSC' : 'LCC')); }}
      >
        {cabin}
      </button>
    ),
    date: <span className="demo-slot is-date">{day ? formatValue(day.date, fmt, locale) : '—'}</span>,
  };

  return (
    <div ref={root} className="demo-app">
      {/* 문장 틀 "[route] 가는 [cabin]를 [date]에 …"을 잘라 자리마다 조작 요소를 끼운다. 어순이 언어마다 달라 틀로 둔다 */}
      <p className="demo-question">
        {texts.sentence.split(/\[(route|cabin|date)\]/).map((part, i) =>
          i % 2 === 1 ? <Fragment key={i}>{slots[part as Slot]}</Fragment> : part)}
      </p>
      {(status === 'loading' || (status === 'ready' && days.length === 0)) && <p className="muted">{texts.loading}</p>}
      {status === 'error' && (
        <div className="demo-error" role="alert">
          <span>{texts.error}</span>
          <button type="button" className="pill" onClick={() => void load()}>{texts.retry}</button>
        </div>
      )}
      {status === 'ready' && days.length > 0 && (
        <>
          <DateStrip days={days} index={index} locale={locale} texts={texts} onChange={(i) => { touched.current = true; wantedDate.current = days[i].date; setIndex(i); }} />
          {forecast ? <DemoResult forecast={forecast} locale={locale} texts={texts} /> : <p className="muted">{texts.noForecast}</p>}
        </>
      )}
      <p className="demo-asof mono">{interpolate(texts.asOf, { v: { asOf } }, locale)}</p>
      <p className="sr-only" aria-live="polite">{announce}</p>
    </div>
  );
}
