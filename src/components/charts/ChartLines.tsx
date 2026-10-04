'use client';
// 그림 판 위 SVG 층(설계 2026-10-04 §3): 별자리 선과 ⑤ 분위수 점 그림 칸을 판 크기(px)로 그린다. 3D 켜짐·꺼짐 모두
// 같은 층이라 점(3D 캔버스 또는 2D 캔버스)과 같은 정규화 좌표로 겹친다. 낭독은 자막·조작 층이 맡아 aria-hidden.
import { TONE_COLOR } from '@/charts/draw2d';
import { linePath } from '@/charts/lines';
import type { ChartLine, OverlayShape } from '@/charts/types';

type Props = { lines?: ChartLine[]; overlay?: OverlayShape[]; w: number; h: number; on: boolean };

const color = (tone: number) => TONE_COLOR[tone] ?? TONE_COLOR[1];
const anchor = { start: 'start', center: 'middle', end: 'end' } as const;

export function ChartLines({ lines, overlay, w, h, on }: Props) {
  if (!w || !h || (!lines?.length && !overlay?.length)) return null;
  return (
    <svg className="chart-lines" data-on={on ? '' : undefined} width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      {lines?.map((l, i) => (
        <path key={i} d={linePath(l.pts, w, h)} fill="none" stroke={color(l.tone)} strokeOpacity={l.alpha}
          strokeWidth={l.width} strokeLinejoin="round" strokeLinecap="round" />
      ))}
      {overlay?.map((s, i) => {
        if (s.type === 'dot') {
          return s.hollow
            ? <circle key={i} cx={s.x * w} cy={s.y * h} r={s.r} fill="none" stroke={color(s.tone)} strokeOpacity={s.alpha} strokeWidth={1.2} />
            : <circle key={i} cx={s.x * w} cy={s.y * h} r={s.r} fill={color(s.tone)} fillOpacity={s.alpha} />;
        }
        if (s.type === 'dash') {
          // 둥근 끝 + "0 5" = 5px마다 점 하나인 점선 — 점 컨셉을 지킨다
          return <line key={i} x1={s.x0 * w} x2={s.x1 * w} y1={s.y * h} y2={s.y * h} stroke={color(s.tone)} strokeOpacity={s.alpha}
            strokeWidth={1.6} strokeLinecap="round" strokeDasharray="0 5" />;
        }
        return <text key={i} x={s.x * w} y={s.y * h} textAnchor={anchor[s.align]} dominantBaseline="middle" className={`chart-${s.cls}`}>{s.text}</text>;
      })}
    </svg>
  );
}
