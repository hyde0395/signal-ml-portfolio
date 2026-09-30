'use client';
// 차트 그림 판(설계 2026-09-25 §3.3·§3.4·§4, 2026-09-27 개정, 2026-09-28 §2 자막 방식). 판은 화면에
// 고정(sticky)되고, 글은 판 아래 자막 띠(.chart-copy)에 자리 잡은 채 문단만 제자리에서 바뀐다.
// 판이 화면 가까이 오면 데이터와 배치 코드를 불러와(import()) 배치를 만들고,
// - 배치와 판의 고정 위치를 저장소(registry)에 올린다 → 3D가 켜져 있으면 배경 점이 그 자리로 모인다,
// - 3D가 꺼져 있으면(data-3d="off") 같은 배치를 2D 캔버스에 그린다.
// 축·이름표는 두 경우 모두 HTML 글자로 겹친다. 캔버스와 이름표는 aria-hidden이고(③ 그룹 버튼만 예외 — 키보드·낭독 대상이라 이름표 층 밖에 둔다), 같은 내용은 자막 띠(.chart-copy)의 요약 문단이 준다.
// 강조(sel): ③ 와플은 마우스를 올린 그룹(설계 2026-09-28 §3), ④·⑤ 차트 1·2·4는 조작 층(role=slider)으로 짚은 항목(계획 5-3b).
// 어느 쪽이든 강조 번호 하나를 저장소로 3D에 알리고 2D도 다시 그린다.
// 펼침(open): ③ 와플 그룹 버튼을 누르면 그 그룹의 SHAP 벌떼 배치로 다시 배치한다(계획 5-3c). 펼친 동안은 펼친 그룹이 강조다.
import type React from 'react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ChartStrings } from '@/charts/build';
import { publishChart, setFocus as publishFocus } from '@/charts/registry';
import type { ChartKey, ChartLabel, ChartLayout } from '@/charts/types';

// label: 조작 층의 aria-label(차트 제목 + " · " + charts.touch), hint: 짚은 항목이 없을 때의 valuetext(charts.touchHint).
// 항목이 있는 차트(1·2·4)만 쓴다
type Props = { chartKey: ChartKey; dataVersion: string; strings: ChartStrings; errorText: string; label?: string; hint?: string };

// 판이 화면 아래 800px 안으로 들어오면 미리 불러온다(스크롤해 도착했을 때 이미 그려져 있도록)
const LOAD_MARGIN = '800px 0px';
// 손가락이 가로로 이만큼 움직여야 짚기(끌기)로 본다 — 그 전엔 세로 스크롤일 수 있다(데모 DateStrip과 같은 규칙)
const TOUCH_SLOP_PX = 8;
// 표시 상자와 짚은 항목 사이 간격(px)
const TIP_GAP = 12;

export function ChartStage({ chartKey, dataVersion, strings, errorText, label, hint }: Props) {
  const stage = useRef<HTMLDivElement>(null);
  const plot = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const tipEl = useRef<HTMLDivElement>(null);
  const [lay, setLay] = useState<ChartLayout | null>(null);
  const labels = lay?.labels ?? [];
  const items = lay?.items;
  const [failed, setFailed] = useState(false);
  // 강조 번호(ChartLayout.hl): 와플 그룹 또는 차트 항목. −1 = 없음. 차트 2는 첫 배치 때 layout.initial(가장 싼 구간)
  const [sel, setSel] = useState(-1);
  const lastLayout = useRef<ChartLayout | null>(null);
  const paint = useRef<(f: number) => void>(() => {});
  const selRef = useRef(-1);
  // ③ 펼친 와플 그룹(−1 = 닫힘). 배치 함수(redraw)는 불러오기 effect 안에 있어 ref로 열어 두고 open이 바뀌면 부른다
  const [open, setOpen] = useState(-1);
  const openRef = useRef(-1);
  const relayout = useRef<() => void>(() => {});
  const [shapOk, setShapOk] = useState(false);
  const [announce, setAnnounce] = useState('');
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const inited = useRef(false);
  // 터치: 누른 자리와 아직 끌기로 확정되지 않았는지(pending). 확정되면 dragging
  const touch = useRef<{ x: number; pending: boolean } | null>(null);
  const dragging = useRef(false);
  // 웹 글꼴이 늦게 도착해 글자 폭이 바뀌면 표시 상자를 다시 잰다(대체 글꼴로 잰 폭이면 판 밖으로 삐져나갈 수 있다)
  const [fontTick, setFontTick] = useState(0);

  useEffect(() => {
    const st = stage.current, pl = plot.current, cv = canvas.current;
    if (!st || !pl || !cv) return;
    let alive = true;
    let redraw = () => {};
    let pf = 0;
    const io = new IntersectionObserver(async (entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      try {
        const mod = await import('@/charts/build');
        const loaded = await mod.loadFor(chartKey, dataVersion);
        if (!alive) return;
        // 펼치기는 모든 그룹 피처가 SHAP 데이터에 있을 때만 켠다 — 하나라도 빠지면 shapRows가 redraw 안(이 try 밖,
        // ResizeObserver·effect에서 불림)에서 던져 트리 전체가 무너진다. 그땐 데이터가 없을 때처럼 와플만 보인다
        const shap = loaded.charts?.shap;
        setShapOk(!!shap && (strings.groups ?? []).every((g) => g.features.every((f) => shap.features.includes(f))));
        redraw = () => {
          const r = pl.getBoundingClientRect(), s = st.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) return;
          const layout = mod.buildLayout(chartKey, loaded, { w: r.width, h: r.height }, strings, openRef.current);
          // 판은 sticky(top: 0)라 고정된 동안 판 윗변 = 화면 맨 위다. 지금 스크롤 위치와 상관없이
          // "고정됐을 때의 화면 위치"를 넘기려고 판 안에서의 거리(r.top - s.top)를 쓴다
          publishChart(chartKey, {
            layout,
            rect: { left: r.left, top: r.top - s.top, width: r.width, height: r.height, vw: document.documentElement.clientWidth, vh: window.innerHeight },
          });
          lastLayout.current = layout;
          // 처음 배치 때만 처음 강조를 정한다 — 창 크기로 다시 배치해도 짚은 항목(같은 번호)은 그대로 둔다
          if (!inited.current) { inited.current = true; selRef.current = layout.initial ?? -1; setSel(selRef.current); }
          // 새 배치의 항목 수가 줄었으면 짚은 번호가 범위 밖이 된다(aria-valuenow > valuemax) — 처음 강조로 되돌린다
          else if (layout.items && selRef.current >= layout.items.length) { selRef.current = layout.initial ?? -1; setSel(selRef.current); }
          setLay(layout);
          draw(openRef.current >= 0 ? openRef.current : selRef.current);
        };
        // 2D 그리기만 따로 둔다 — 강조가 바뀔 때 배치를 다시 만들거나 3D에 다시 올리지 않고 2D만 다시 그린다
        const draw = (f: number) => {
          if (pf) { cancelAnimationFrame(pf); pf = 0; }
          const layout = lastLayout.current;
          if (!layout || document.documentElement.getAttribute('data-3d') !== 'off') return;
          const r = pl.getBoundingClientRect();
          const dpr = Math.min(window.devicePixelRatio || 1, 2);
          // 캔버스 크기를 다시 넣으면 크기가 같아도 버퍼를 새로 잡는다 — 판 크기가 바뀐 때만
          const w = Math.round(r.width * dpr), h = Math.round(r.height * dpr);
          if (cv.width !== w) cv.width = w;
          if (cv.height !== h) cv.height = h;
          const ctx = cv.getContext('2d');
          if (!ctx) return;
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          mod.drawLayout(ctx, layout, r.width, r.height, f);
        };
        // 끌기·마우스 이동은 한 프레임에 강조를 여러 번 바꾼다. 점 수천 개 다시 그리기는 프레임당 한 번, 마지막 강조로만
        let pending = -1;
        paint.current = (f: number) => {
          pending = f;
          if (!pf) pf = requestAnimationFrame(() => { pf = 0; draw(pending); });
        };
        relayout.current = redraw;
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
      if (pf) cancelAnimationFrame(pf);
      paint.current = () => {};
      relayout.current = () => {};
    };
  }, [chartKey, dataVersion, strings]);

  // 펼친 동안(③)은 펼친 그룹이 강조 — 마우스 올리기(sel)는 닫힌 상태에서만 쓴다
  const focusNow = open >= 0 ? open : sel;
  useEffect(() => {
    selRef.current = sel;
    publishFocus(chartKey, focusNow);
    paint.current(focusNow);
  }, [sel, focusNow, chartKey]);
  useEffect(() => { openRef.current = open; relayout.current(); }, [open]);

  // 표시 상자 자리: 짚은 항목 위 TIP_GAP(자리가 없으면 아래), 좌우는 판 안으로 자른다. 상자 폭은 문장마다 달라 그린 뒤 잰다
  const cur = items && sel >= 0 ? items[sel] : undefined;
  useLayoutEffect(() => {
    const el = tipEl.current, pl = plot.current;
    if (!el || !pl || !cur) return;
    const W = pl.clientWidth, H = pl.clientHeight, w = el.offsetWidth, h = el.offsetHeight;
    const x = cur.x * W, y = cur.y * H;
    el.style.left = `${Math.max(0, Math.min(W - w, x - w / 2))}px`;
    el.style.top = `${y - TIP_GAP - h >= 0 ? y - TIP_GAP - h : Math.min(H - h, y + TIP_GAP)}px`;
  }, [cur, lay, fontTick]);
  useEffect(() => {
    let alive = true;
    document.fonts?.ready.then(() => { if (alive) setFontTick((n) => n + 1); });
    return () => { alive = false; };
  }, []);

  const groups = labels.filter((l): l is Extract<ChartLabel, { type: 'group' }> => l.type === 'group');
  const toggle = (gi: number) => {
    // SHAP 데이터가 없어도 와플은 멀쩡히 읽히므로 failed(판 전체를 덮는 오류 표시)로 가리지 않는다.
    // 낭독기에만 한 번 알리고 펼치지는 않는다
    if (!shapOk) { setAnnounce(errorText); return; }
    const next = openRef.current === gi ? -1 : gi;
    // 열 때만 마우스 설명 줄을 비운다 — 닫을 때는 포인터가 아직 버튼 위일 수 있어 설명 줄을 그대로 둔다
    if (next >= 0) setSel(-1);
    setOpen(next);
    setAnnounce(next >= 0 && strings.shap ? strings.shap.opened.replace('{v.name}', groups[gi]?.name ?? '') : strings.shap?.closed ?? '');
  };
  // Esc: 펼친 동안 어디에 초점이 있든 닫는다. 초점은 판 안(또는 body)에 있을 때만 그 그룹 버튼으로 돌려놓는다 —
  // 독자가 스크롤해 판을 벗어났다면 초점을 화면 밖으로 끌어가지 않는다(preventScroll은 화면이 튀지 않게)
  useEffect(() => {
    if (open < 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const gi = openRef.current;
      setOpen(-1);
      setAnnounce(strings.shap?.closed ?? '');
      const ae = document.activeElement;
      if (plot.current?.contains(ae) || ae === document.body) buttons.current[gi]?.focus({ preventScroll: true });
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, strings]);
  // 마우스·펜은 올리면 설명 줄(닫힌 상태만), 누르기·Enter·Space(button의 click)는 모든 포인터에서 펼치기/닫기
  const groupHandlers = (gi: number) => ({
    onPointerEnter: (e: React.PointerEvent) => { if (e.pointerType !== 'touch' && openRef.current < 0) setSel(gi); },
    onPointerLeave: (e: React.PointerEvent) => { if (e.pointerType !== 'touch') setSel(-1); },
    onClick: () => toggle(gi),
  });

  // 조작 층: 판 기준 가로 위치에서 가장 가까운 항목(항목 ≤ 180개라 차례로 본다)
  const pick = (clientX: number) => {
    const pl = plot.current;
    if (!items?.length || !pl) return;
    const r = pl.getBoundingClientRect();
    const fx = (clientX - r.left) / r.width;
    let best = 0;
    for (let i = 1; i < items.length; i++) if (Math.abs(items[i].x - fx) < Math.abs(items[best].x - fx)) best = i;
    setSel(items[best].key);
  };
  const touchHandlers = {
    // 두 번째 손가락(확대 등)이 touch.current를 덮어쓰지 않게 주 포인터만 받는다. 마우스는 왼쪽 단추만(데모 DateStrip과 같다)
    onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => {
      if (!e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
      // 손가락은 세로 스크롤하려고 스친 것일 수 있어 바로 짚지 않는다(세로면 브라우저가 pan-y로 가져가며 pointercancel)
      if (e.pointerType === 'touch') touch.current = { x: e.clientX, pending: true };
      else pick(e.clientX);
    },
    onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => {
      if (!e.isPrimary) return;
      const t = touch.current;
      if (t?.pending && Math.abs(e.clientX - t.x) > TOUCH_SLOP_PX) {
        t.pending = false;
        dragging.current = true;
        e.currentTarget.setPointerCapture(e.pointerId); // 판 밖으로 끌고 나가도 계속 따라가게
      }
      if (e.pointerType !== 'touch' || dragging.current) pick(e.clientX);
    },
    onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => {
      if (!e.isPrimary) return;
      // 가로로 끌지 않고 뗀 터치는 탭 — 그 자리 항목. 손을 떼도 짚은 항목은 남긴다
      if (touch.current?.pending) pick(e.clientX);
      touch.current = null;
      dragging.current = false;
    },
    onPointerCancel: (e: React.PointerEvent<HTMLDivElement>) => { if (e.isPrimary) { touch.current = null; dragging.current = false; } },
    // 마우스·펜이 판을 떠나면 차트 1·4는 강조 해제, 차트 2는 마지막 구간(세로선)이 남는다. 손가락은 뗄 때 오므로 무시
    // 부드러운 스크롤(Lenis)이 끝날 때 크롬이 흉내 낸 마우스 이동으로 판 "위"에서도 pointerleave를 보낼 때가 있다
    // (3D 켜짐 실측) — 포인터가 아직 판 안이면 떠난 게 아니다
    onPointerLeave: (e: React.PointerEvent<HTMLDivElement>) => {
      const r = e.currentTarget.getBoundingClientRect();
      const inside = e.clientX > r.left && e.clientX < r.right && e.clientY > r.top && e.clientY < r.bottom;
      if (e.pointerType !== 'touch' && chartKey !== 'chartCurve' && !inside) setSel(-1);
    },
    onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (!items?.length) return;
      const last = items.length - 1, k = e.key;
      const step = k === 'ArrowRight' || k === 'ArrowUp' ? 1 : k === 'ArrowLeft' || k === 'ArrowDown' ? -1 : 0;
      // 아직 짚은 항목이 없으면(차트 1·4) 화살표는 첫 항목부터
      const next = step ? (sel < 0 ? 0 : Math.max(0, Math.min(last, sel + step))) : k === 'Home' ? 0 : k === 'End' ? last : null;
      if (next === null) return;
      e.preventDefault(); // 화살표·Home·End가 페이지를 스크롤하지 않게
      setSel(next);
    },
  };

  return (
    <div ref={stage} className="chart-stage">
      <div ref={plot} className="chart-plot" data-plot>
        <canvas ref={canvas} className="chart-canvas" aria-hidden="true" />
        <div className="chart-labels" aria-hidden="true">
          {labels.map((l, i) => {
            const style = { left: `${l.x * 100}%`, top: `${l.y * 100}%` };
            if (l.type === 'group') return null; // 그룹 이름표는 아래 버튼 층에
            if (l.type === 'detail') {
              const g = sel >= 0 ? groups[sel] : undefined;
              return (
                <p key="detail" className="chart-detail" style={style}>
                  {g && <><b>{g.name} · {g.pct} · {g.count}</b><span>{g.features.join(' · ')}</span></>}
                </p>
              );
            }
            return <span key={i} className={`chart-label ${l.cls} align-${l.align}`} style={style}>{l.text}</span>;
          })}
        </div>
        {/* ③ 와플 그룹 버튼(계획 5-3c): 축·눈금 글자가 낭독되지 않게 이름표 층(aria-hidden) 밖에 둔다 */}
        {groups.length > 0 && (
          <div className="chart-groups">
            {groups.map((l, gi) => {
              const cls = `chart-group${l.holiday ? ' is-holiday' : ''}${l.mini ? ' is-mini' : ''}${focusNow === gi ? ' is-focus' : focusNow >= 0 ? ' is-dim' : ''}`;
              return (
                <button key={l.id} ref={(el) => { buttons.current[gi] = el; }} type="button" className={cls}
                  style={{ left: `${l.x * 100}%`, top: `${l.y * 100}%` }}
                  aria-expanded={shapOk ? open === gi : undefined} aria-controls={shapOk ? `${chartKey}-shap` : undefined}
                  aria-label={`${l.pct} ${l.name} · ${l.count}`}
                  {...groupHandlers(gi)}>
                  {/* mini(펼친 화면의 작은 와플): 넓은 판은 이름만, 좁은 판은 %만 */}
                  {l.mini !== 'name' && <span className="chart-group-pct">{l.pct}</span>}
                  {l.mini !== 'pct' && <span className="chart-group-name">{l.name}</span>}
                  {/* compact(좁은 판): 개수 줄은 뺀다 — 설명 줄에 이미 있다(2026-09-28 §3 실측) */}
                  {!l.compact && <span className="chart-group-count">{l.count}</span>}
                </button>
              );
            })}
          </div>
        )}
        {chartKey === 'chartCurve' && cur && <div className="chart-cursor" aria-hidden="true" style={{ left: `${cur.x * 100}%` }} />}
        {cur && <div ref={tipEl} className="chart-tip" aria-hidden="true">{cur.text}</div>}
        {items && items.length > 0 && (
          <div
            className="chart-touch"
            role="slider"
            tabIndex={0}
            aria-label={label}
            // 짚은 항목이 없어도 role=slider는 valuenow가 필수라(ARIA) 0으로 두고, "0"이 읽히지 않게 valuetext로 조작 안내를 준다
            aria-valuemin={0}
            aria-valuemax={items.length - 1}
            aria-valuenow={cur ? sel : 0}
            aria-valuetext={cur?.text ?? hint}
            {...touchHandlers}
          />
        )}
        {/* 알림 영역은 처음부터 두고 글만 넣어야 화면 낭독기가 바뀐 것으로 읽는다 */}
        <p className="chart-error" role="status">{failed ? errorText : null}</p>
        {/* ③ 펼친 SHAP 벌떼의 낭독용 요약. aria-controls가 늘 있는 id를 가리키도록 목록은 닫혀 있어도 둔다 */}
        {chartKey === 'features' && (
          <>
            <ul id={`${chartKey}-shap`} className="sr-only">{(open >= 0 ? lay?.summary ?? [] : []).map((t) => <li key={t}>{t}</li>)}</ul>
            <p className="sr-only" role="status">{announce}</p>
          </>
        )}
      </div>
    </div>
  );
}
