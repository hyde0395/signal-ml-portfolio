// 출발일 막대 = 날짜 선택기(스펙 §6.1, §9.2). 막대 하나가 출발일 하나이고, 높이는 기준일에 샀을 때의 예측가다.
// 공휴일 주변은 호박색 + ◆ 표식 + 이름표로 보여 준다(색만으로 뜻을 전하지 않는다, §9.4). 예측이 없는 날은
// 회색 점선이고 고를 수 없다(§6.4).
import { useRef, type KeyboardEvent, type PointerEvent } from 'react';
import type { DemoTexts } from '@/lib/content';
import { formatValue, interpolate, type Locale } from '@/lib/i18n';
import { barScale, edgeSelectable, indexFromX, nearestSelectable, stepSelectable } from '@/demo/strip';
import type { StripDay } from '@/demo/types';

type Props = { days: StripDay[]; index: number; onChange: (i: number) => void; locale: Locale; texts: DemoTexts };

export function holidayLabel(texts: DemoTexts, code: string): string {
  return (texts.holidays as Record<string, string>)[code] ?? code;
}

export function DateStrip({ days, index, onChange, locale, texts }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const scale = barScale(days.map((d) => d.price));
  const first = edgeSelectable(days, 'first');
  const last = edgeSelectable(days, 'last');
  const cur = days[index];

  const pick = (clientX: number) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const i = nearestSelectable(days, indexFromX(clientX - r.left, r.width, days.length));
    if (i >= 0 && i !== index) onChange(i);
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId); // 막대 밖으로 끌고 나가도 계속 따라가게
    pick(e.clientX);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const next =
      e.key === 'ArrowRight' || e.key === 'ArrowUp' ? stepSelectable(days, index, 1)
      : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? stepSelectable(days, index, -1)
      : e.key === 'Home' ? first
      : e.key === 'End' ? last
      : null;
    if (next === null) return;
    e.preventDefault(); // 화살표·Home·End가 페이지를 스크롤하지 않게
    if (next >= 0 && next !== index) onChange(next);
  };

  const valueText =
    cur && cur.price !== null
      ? interpolate(texts.strip.valuetext, { v: { date: cur.date, price: cur.price } }, locale) +
        (cur.holiday ? `, ${interpolate(texts.strip.holiday, { v: { holiday: holidayLabel(texts, cur.holiday) } }, locale)}` : '')
      : undefined;

  return (
    <div className="strip-wrap">
      <div
        ref={ref}
        className="strip"
        role="slider"
        tabIndex={0}
        aria-label={texts.strip.label}
        aria-valuemin={first}
        aria-valuemax={last}
        aria-valuenow={index}
        aria-valuetext={valueText}
        aria-disabled={first < 0 ? true : undefined}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={(e) => { if (dragging.current) pick(e.clientX); }}
        onPointerUp={() => { dragging.current = false; }}
        onPointerCancel={() => { dragging.current = false; }}
      >
        {days.map((d, i) => (
          <span
            key={d.date}
            aria-hidden="true"
            className={['strip-bar', d.price === null && 'is-empty', d.holiday && 'is-holiday', i === index && 'is-selected']
              .filter(Boolean)
              .join(' ')}
            style={d.price === null ? undefined : { height: `${scale(d.price) * 100}%` }}
          />
        ))}
      </div>
      {days.length > 0 && (
        <p className="strip-axis mono" aria-hidden="true">
          <span>{formatValue(days[0].date, 'md', locale)}</span>
          <span>{formatValue(days[days.length - 1].date, 'md', locale)}</span>
        </p>
      )}
      {cur?.holiday && (
        <p className="strip-holiday">
          <span aria-hidden="true">◆ </span>
          {holidayLabel(texts, cur.holiday)}
        </p>
      )}
      <p className="strip-legend">
        <span><span className="legend-mark is-holiday" aria-hidden="true" />{texts.strip.legendHoliday}</span>
        <span><span className="legend-mark is-empty" aria-hidden="true" />{texts.strip.legendNoData}</span>
      </p>
    </div>
  );
}
