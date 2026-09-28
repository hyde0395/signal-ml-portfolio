'use client';
// 차트 그림 판(설계 2026-09-25 §3.3·§3.4·§4, 2026-09-27 개정, 2026-09-28 §2 자막 방식). 판은 화면에
// 고정(sticky)되고, 글은 판 아래 자막 띠(.chart-copy)에 자리 잡은 채 문단만 제자리에서 바뀐다.
// 판이 화면 가까이 오면 데이터와 배치 코드를 불러와(import()) 배치를 만들고,
// - 배치와 판의 고정 위치를 저장소(registry)에 올린다 → 3D가 켜져 있으면 배경 점이 그 자리로 모인다,
// - 3D가 꺼져 있으면(data-3d="off") 같은 배치를 2D 캔버스에 그린다.
// 축·이름표는 두 경우 모두 HTML 글자로 겹친다. 판 전체가 aria-hidden이고, 같은 내용은 자막 띠(.chart-copy)의 요약 문단이 준다.
// ③ 와플은 마우스를 올린 그룹을 저장소로 3D에 알리고 2D도 다시 그린다(설계 2026-09-28 §3).
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import type { ChartStrings } from '@/charts/build';
import { publishChart, setFocus as publishFocus } from '@/charts/registry';
import type { ChartKey, ChartLabel, ChartLayout } from '@/charts/types';

type Props = { chartKey: ChartKey; dataVersion: string; strings: ChartStrings; errorText: string };

// 판이 화면 아래 800px 안으로 들어오면 미리 불러온다(스크롤해 도착했을 때 이미 그려져 있도록)
const LOAD_MARGIN = '800px 0px';

export function ChartStage({ chartKey, dataVersion, strings, errorText }: Props) {
  const stage = useRef<HTMLDivElement>(null);
  const plot = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [labels, setLabels] = useState<ChartLabel[]>([]);
  const [failed, setFailed] = useState(false);
  // ③ 와플 강조(설계 2026-09-28 §3): 마우스를 올린(휴대폰은 누른) 그룹 번호, 없으면 -1
  const [focus, setFocusState] = useState(-1);
  const lastLayout = useRef<ChartLayout | null>(null);
  const paint = useRef<(f: number) => void>(() => {});
  const lastPointer = useRef('mouse');
  const focusRef = useRef(-1);

  useEffect(() => {
    const st = stage.current, pl = plot.current, cv = canvas.current;
    if (!st || !pl || !cv) return;
    let alive = true;
    let redraw = () => {};
    const io = new IntersectionObserver(async (entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      try {
        const mod = await import('@/charts/build');
        const loaded = await mod.loadFor(chartKey, dataVersion);
        if (!alive) return;
        redraw = () => {
          const r = pl.getBoundingClientRect(), s = st.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) return;
          const layout = mod.buildLayout(chartKey, loaded, { w: r.width, h: r.height }, strings);
          // 판은 sticky(top: 0)라 고정된 동안 판 윗변 = 화면 맨 위다. 지금 스크롤 위치와 상관없이
          // "고정됐을 때의 화면 위치"를 넘기려고 판 안에서의 거리(r.top - s.top)를 쓴다
          publishChart(chartKey, {
            layout,
            rect: { left: r.left, top: r.top - s.top, width: r.width, height: r.height, vw: document.documentElement.clientWidth, vh: window.innerHeight },
          });
          setLabels(layout.labels);
          lastLayout.current = layout;
          paint.current(focusRef.current);
        };
        // 2D 그리기만 따로 둔다 — 강조가 바뀔 때 배치를 다시 만들거나 3D에 다시 올리지 않고 2D만 다시 그린다
        paint.current = (f: number) => {
          const layout = lastLayout.current;
          if (!layout || document.documentElement.getAttribute('data-3d') !== 'off') return;
          const r = pl.getBoundingClientRect();
          const dpr = Math.min(window.devicePixelRatio || 1, 2);
          cv.width = Math.round(r.width * dpr);
          cv.height = Math.round(r.height * dpr);
          const ctx = cv.getContext('2d');
          if (!ctx) return;
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          mod.drawLayout(ctx, layout, r.width, r.height, f);
        };
        redraw();
      } catch (e) {
        console.warn('차트를 불러오지 못했다', e);
        if (alive) setFailed(true);
      }
    }, { rootMargin: LOAD_MARGIN });
    io.observe(st);
    // 판 크기가 바뀌면(창 조절·회전) 다시 배치한다 — 저장소를 거쳐 3D도 새 배치로 다시 쓴다
    const ro = new ResizeObserver(() => redraw());
    ro.observe(pl);
    // 판 높이는 vh 단위라, 휴대폰 주소창이 접히고 펴져 innerHeight만 바뀌면 ResizeObserver가 안 불릴 수 있다
    // (그러면 저장소의 rect.vh가 옛 값으로 남아 3D 점이 어긋난다). 창 resize도 받아 한 프레임에 한 번 다시 배치한다
    let rf = 0;
    const onResize = () => { if (!rf) rf = requestAnimationFrame(() => { rf = 0; redraw(); }); };
    window.addEventListener('resize', onResize);
    // 3D가 도중에 꺼지면(저프레임 전환) 그 자리에서 2D로 그린다
    const mo = new MutationObserver(() => redraw());
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-3d'] });
    return () => {
      alive = false; io.disconnect(); ro.disconnect(); mo.disconnect();
      window.removeEventListener('resize', onResize);
      if (rf) cancelAnimationFrame(rf);
    };
  }, [chartKey, dataVersion, strings]);

  useEffect(() => {
    focusRef.current = focus;
    if (chartKey === 'features') publishFocus('features', focus);
    paint.current(focus);
  }, [focus, chartKey]);

  // 마우스·펜은 올리고 내리기, 손가락은 누를 때마다 켜고 끄기(손가락은 떼는 순간 pointerleave가 와서 바로 꺼지므로 무시한다)
  const groupHandlers = (gi: number) => ({
    onPointerEnter: (e: React.PointerEvent) => { lastPointer.current = e.pointerType; if (e.pointerType !== 'touch') setFocusState(gi); },
    onPointerLeave: (e: React.PointerEvent) => { if (e.pointerType !== 'touch') setFocusState(-1); },
    onClick: () => { if (lastPointer.current === 'touch') setFocusState((f) => (f === gi ? -1 : gi)); },
  });

  return (
    <div ref={stage} className="chart-stage" aria-hidden="true">
      <div ref={plot} className="chart-plot" data-plot>
        <canvas ref={canvas} className="chart-canvas" />
        <div className="chart-labels">
          {(() => {
            const groups = labels.filter((l): l is Extract<ChartLabel, { type: 'group' }> => l.type === 'group');
            return labels.map((l, i) => {
              const style = { left: `${l.x * 100}%`, top: `${l.y * 100}%` };
              if (l.type === 'group') {
                const gi = groups.indexOf(l);
                const cls = `chart-group${l.holiday ? ' is-holiday' : ''}${focus === gi ? ' is-focus' : focus >= 0 ? ' is-dim' : ''}`;
                return (
                  <div key={l.id} className={cls} style={style} {...groupHandlers(gi)}>
                    <span className="chart-group-pct">{l.pct}</span>
                    <span className="chart-group-name">{l.name}</span>
                    {/* compact(좁은 판): 개수 줄은 뺀다 — 설명 줄에 이미 있다(2026-09-28 §3 실측) */}
                    {!l.compact && <span className="chart-group-count">{l.count}</span>}
                  </div>
                );
              }
              if (l.type === 'detail') {
                const g = focus >= 0 ? groups[focus] : undefined;
                return (
                  <p key="detail" className="chart-detail" style={style}>
                    {g && <><b>{g.name} · {g.pct} · {g.count}</b><span>{g.features.join(' · ')}</span></>}
                  </p>
                );
              }
              return <span key={i} className={`chart-label ${l.cls} align-${l.align}`} style={style}>{l.text}</span>;
            });
          })()}
        </div>
        {failed && <p className="chart-error">{errorText}</p>}
      </div>
    </div>
  );
}
