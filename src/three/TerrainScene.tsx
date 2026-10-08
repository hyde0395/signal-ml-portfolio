'use client';
// 화면 뒤에 고정된 3D 캔버스. 데이터를 받아 점 구름을 만들고, 스크롤로 활성 장면을 정하고,
// 프레임이 떨어지면 단계적으로 낮추다가 대체 화면으로 넘긴다(스펙 §8.3). 캡처 모드도 여기서 처리한다.
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getChart, getFocus, onChartsChange } from '@/charts/registry';
import type { ChartEntry, ChartKey } from '@/charts/types';
import { pickActive, readCandidates } from './activeScene';
import { buildAirport } from './airport';
import { AirportExtras } from './AirportExtras';
import { assignAirport } from './airportAssign';
import { CameraRig } from './CameraRig';
import { assignPoints, chartShiftY, pickSlot, slotBuffers } from './chartTargets';
import { bookingBins, buildPointCloud, loadSceneData, type MapData, type Terrain } from './data';
import { initialFrameRate, maxDpr, stepFrameRate } from './frameRate';
import { lookToward, PLANE, planeFollow, planePose, planeShape, runwayPhases, runwayProgress, stepPlaneClock } from './plane';
import { SIGNAL, signalStage } from './signal';
import { CHART_DISTANCE, CHART_FOV, pickScene, sceneFor, type SceneKey, type SceneState } from './scenes';
import { TerrainPoints, type ChartSlots } from './TerrainPoints';

type Props = { dataVersion: string; onReady: () => void; onFail: (reason: string) => void; capture: SceneKey | null };

const SLOW_FPS = 30;
const SLOW_SECONDS = 2;

export default function TerrainScene({ dataVersion, onReady, onFail, capture }: Props) {
  const [data, setData] = useState<{ terrain: Terrain; map: MapData } | null>(null);
  const [level, setLevel] = useState(0);        // 0 정상, 1 낮춤(DPR 1·잡음 숨김)
  const [running, setRunning] = useState(true); // 탭 숨김·연락처 섹션에서는 멈춘다
  // 셰이더를 첫 프레임 전에 따로 컴파일한다(계획 2026-10-08 성능) — 첫 프레임이 컴파일 + 버퍼 올리기를 한 작업에서 해
  // 메인 스레드를 오래 막았다. 끝날 때까지 프레임 루프를 멈춰 두고(frameloop 'never'), 끝나면 돌린다
  const [compiled, setCompiled] = useState(false);
  const onCompiled = useCallback(() => setCompiled(true), []);
  const portrait = useRef(false);
  const backdrop = useRef<HTMLDivElement>(null); // 하늘 불투명도(--sky)를 적을 자리(writeHandoff)
  const target = useRef<SceneState>(sceneFor(capture ?? 'hero', 0, false));
  const parallax = useRef(true);
  const slots = useRef<ChartSlots>({ pending: null, focus: -1, focusTone: 2, focusDim: 0.25 });
  // 지금 슬롯에 써 넣은 차트와 그 슬롯. 다른 차트로 가면(지형을 거쳐도) 반대 슬롯에 써서 점이 두 배치 사이를 옮겨 간다
  const shiftKey = useRef<ChartKey | null>(null); // 점 이동량(shift)을 잴 판의 차트 — 차트를 벗어나도 마지막 것을 유지
  const chartState = useRef<{ key: ChartKey | null; entry: ChartEntry | null; slot: 0 | 1 }>({ key: null, entry: null, slot: 0 });
  // 마지막으로 슬롯에 써 넣은 차트 — chartState.key와 달리 지형으로 나가도 지우지 않는다(chartTargets.ts pickSlot)
  const lastWritten = useRef<{ key: ChartKey | null; variant: string; slot: 0 | 1 }>({ key: null, variant: '', slot: 0 });

  useEffect(() => {
    loadSceneData(dataVersion).then(setData).catch((e) => onFail(`data: ${e.message}`));
  }, [dataVersion, onFail]);

  // 세로 화면(대개 휴대폰) 판정 — 점 구름·공항 불빛·곁가지(AirportExtras)가 모두 같은 값을 써야
  // stride(성긴 정도)가 어긋나지 않는다. data가 바뀔 때만 다시 재는 값이라 cloud와 같은 의존성으로 둔다
  const isPortrait = useMemo(() => typeof window !== 'undefined' && window.innerHeight > window.innerWidth, [data]);

  const cloud = useMemo(() => {
    if (!data) return null;
    // 세로 화면은 잡음 점을 절반만 그린다
    return buildPointCloud(data.terrain, data.map, { noiseStride: isPortrait ? 2 : 1, seed: 7 });
  }, [data, isPortrait]);

  // 공항 불빛 배정: 세로 화면(대개 휴대폰)은 불빛 절반(설계 §4.5)
  // 비행기 출발 자리: 세로 화면은 활주로 시작점이 화면 왼쪽 밖이라 앞으로 당겨 세운다(plane.ts PLANE.portraitStart)
  const planeStart = isPortrait ? PLANE.portraitStart : 0;

  const airport = useMemo(() => {
    if (!cloud) return null;
    // 이륙 비행기 점(설계 2026-09-29 §7)도 함께 — 휴대폰도 같은 232개(비행기 모양이 성기면 실루엣이 안 읽힌다)
    return assignAirport(buildAirport({ stride: isPortrait ? 2 : 1 }).lights, cloud.kind, planeShape());
  }, [cloud, isPortrait]);

  // 머리말 U자 8구간(%). terrain.json에 곡선이 없으면 평평하게
  const bins = useMemo(() => (data?.terrain.curve ? bookingBins(data.terrain.curve) : new Array<number>(8).fill(0)), [data]);

  // 스크롤·크기 변화 → 활성 장면 → 목표 상태(차트 장면이면 그림 판 배치도). 캡처 모드에서는 고정.
  useEffect(() => {
    // 점 구름이 새로 만들어지면 슬롯에 써 둔 배치는 옛 점 번호 기준이라 다시 써야 한다
    chartState.current = { key: null, entry: null, slot: chartState.current.slot };
    if (capture) {
      portrait.current = window.innerHeight > window.innerWidth;
      target.current = sceneFor(capture, 0, portrait.current);
      return;
    }
    let raf = 0;
    // 마지막으로 html에 적은 전환 표시·하늘 값 — 같은 값이면 다시 쓰지 않는다(속성·변수 쓰기는 스타일 재계산을 부른다)
    let shownHandoff: string | null = null, shownSky: string | null = null, shownSignal: string | null = null;
    let prevH = -1;        // 직전 update의 전환 진행도(-1 = 계산 안 함)
    let lastHandoff = -Infinity; // 전환이 마지막으로 움직인 시각(performance.now)
    // 비행기 시계(plane.ts stepPlaneClock): 스크롤로 정한 진행도(목표)를 최대 PLANE.maxRate로 따라가는 값.
    // 첫 화면 → ① 장면 전체를 이 값으로 움직인다(runwayPhases). -1 = 아직 없음 — 여백 클래스(hero-runway)는 3D가 켜진
    // 뒤에 붙어 첫 계산이 이미 스크롤한 뒤일 수 있으므로, 목표로 건너뛰지 않고 지금 보이는 진행도(target.plane)에서 출발한다
    let clock = -1, clockAt = 0, ticking = false;
    // 최대 속도는 스크롤할 때만: 옆 목차·페이지 안 링크 클릭이나 주소의 #이 바뀌어(hashchange) ①로 바로 뛰면 그 뒤
    // 3.5초 동안 ① 글 뒤에서 이륙이 다시 재생됐다 — 뛰어간 사람은 연출을 보려던 게 아니다. 그때부터 300ms(점프 뒤
    // 스크롤이 가라앉을 때까지) 동안은 시계를 목표에 바로 맞춘다
    let snapUntil = -Infinity;
    // e2e 전용 속도 덮어쓰기(window.__planeRate, Playwright addInitScript로 넣는다): 소프트웨어 렌더러(CI swiftshader)는
    // 프레임이 느려 몇 초짜리 연출이 끝나기 전에 프레임 감시가 3D를 꺼 버린다 — 테스트에서만 빠르게 돌려 끝까지 확인한다.
    // 없으면 PLANE.maxRate. 효과가 시작될 때 한 번만 읽는다
    const rateOverride = (window as Window & { __planeRate?: number }).__planeRate;
    const rate = typeof rateOverride === 'number' ? rateOverride : PLANE.maxRate;
    // 하늘 값(--sky)을 적을 자리. 정리(cleanup) 때 ref가 이미 비었을 수 있어 효과 시작 때 잡아 둔다
    const bd = backdrop.current;
    // 전환 표시(data-handoff, e2e가 읽는다)는 html에, 하늘 불투명도(--sky)는 .backdrop에 적는다 — --sky를 html에 두면
    // 값이 바뀔 때마다 페이지 전체의 스타일이 다시 계산된다. 비행기 시계가 도는 동안은 스크롤이 멈춰도 매 프레임
    // 바뀌어서, html에 두었을 때 소프트웨어 렌더러에서 프레임이 떨어져 3D가 꺼졌다. 이 함수는 update의 DOM 읽기가
    // 끝난 뒤에만 부른다 — 먼저 쓰면 뒤따르는 .chart-stage 읽기가 스타일 재계산을 강제한다
    const writeHandoff = (html: HTMLElement, h: number, plane: number) => {
      const hs = h >= 0 ? h.toFixed(3) : null;
      // 잡음 → 신호 단계(계획 9-3, e2e가 읽는다). 시계가 있을 때만
      const sg = plane >= 0 ? signalStage(plane).toFixed(3) : null;
      if (sg !== shownSignal) {
        if (sg === null) delete html.dataset.signal;
        else html.dataset.signal = sg;
        shownSignal = sg;
      }
      // 하늘(globals.css .backdrop::before)을 스크롤에 묶는다: 머리말이 화면 가운데일 때는 활성 장면이 없어
      // data-active-scene이 hero로 남으므로, 장면 이름만으로는 지평선 띠가 전환 내내 또렷이 남는다.
      // 세제곱으로 앞쪽에서 빨리 걷어 내 공항 점이 흩어지기 시작할 무렵엔 띠가 거의 사라지게 한다
      const ss = h >= 0 ? ((1 - h) ** 3).toFixed(3) : null;
      if (hs !== shownHandoff) {
        if (hs === null) delete html.dataset.handoff;
        else html.dataset.handoff = hs;
        shownHandoff = hs;
      }
      if (ss !== shownSky && bd) {
        if (ss === null) bd.style.removeProperty('--sky');
        else bd.style.setProperty('--sky', ss);
        shownSky = ss;
      }
    };
    const update = () => {
      raf = 0;
      portrait.current = window.innerHeight > window.innerWidth;
      const vh = window.innerHeight;
      const active = pickActive(readCandidates(document), vh);
      const html = document.documentElement;
      // 첫 화면 → ① 전환(설계 2026-09-29 §2.1·§5, 계획 9-3): 내려앉기가 끝난 뒤(y0)부터 머리말 글이 화면에 붙을 때(yA)까지,
      // 그 뒤 붙임이 풀릴 때(yB)까지 잡음 → 신호
      // 공항과 ① 장면을 섞는다. 스크롤 위치는 목표이고, 장면은 그 목표를 최대 속도로 따라가는 비행기 시계로 정한다(계획 6-6). 머리말(#intro)이 화면 가운데일 때는 활성 장면 후보가 없어
      // active가 null이므로 그보다 먼저 계산한다. 3D가 맨 위에서 켜졌을 때(hero-runway 여백)만 — 그 밖에는
      // 내려앉기 여백이 없어 y0가 의미 없다. #project 위치는 방금 readCandidates가 레이아웃을 읽은 뒤
      // (사이에 DOM 쓰기 없음)라 추가 레이아웃 계산이 없고, 캐시하지 않으므로 글꼴·창 크기 변화에도 늘 맞다
      let h = -1; // -1 = 전환 계산 안 함
      let plane = -1; // 이륙 비행기 진행도 = 비행기 시계 값(시안 눈금). -1 = 여백 없음, 장면 기본값(첫 화면 0, 그 밖 1)
      let goal = -1;  // 스크롤로 정한 비행기 진행도(시계가 따라갈 목표)
      // 활성 섹션이 없는 틈이 ①보다 위(머리말)인지 — #project 윗변이 아직 화면 가운데 아래에 있을 때만(pickScene intro)
      let intro = false;
      const now = performance.now();
      if (html.classList.contains('hero-runway')) {
        // 활성 장면이 ①보다 뒤(②~)면 이미 yB를 한참 지났다 — 읽지 않고 끝(SIGNAL.end)으로 둔다.
        // 시계도 바로 1로: 차트 장면에 온 뒤까지 공항 연출이 남아 차트를 가리지 않게(지나쳐 온 이륙은 건너뛴다)
        if (active && active.key !== 'hero' && active.key !== 'about') { h = 1; plane = clock = goal = SIGNAL.end; }
        else {
          const projectTop = document.getElementById('project')?.getBoundingClientRect().top;
          const introBox = document.getElementById('intro')?.getBoundingClientRect();
          if (projectTop !== undefined) {
            // 머리말 글이 화면에 붙은 뒤 조금(0.25 화면) 지나 공항 → 잡음 밭 전환이 끝나고(yA), 붙임이 풀릴 때(yB)까지
            // 잡음 → 신호가 진행된다(계획 9-3). 머리말이 없으면 옛 끝(① 윗변이 화면 위 20%)을 yA로 쓴다
            const yA = introBox ? introBox.top + window.scrollY + 0.25 * vh : projectTop + window.scrollY - 0.2 * vh;
            const yB = introBox ? introBox.bottom + window.scrollY - vh : yA;
            intro = projectTop > vh / 2;
            // 비행기는 내려앉기(0 → y0)와 전환(y0 → yA)·신호(yA → yB)를 한 눈금으로 잇는다 — 시안이 한 스크롤 안에서 둘을 이었다.
            // 스크롤은 목표일 뿐, 장면은 최대 속도로 따라가는 시계 값으로 정한다(빠른 휠에도 이륙·흩어짐이 보이게).
            // 시계가 멈춰 있다 움직이기 시작하면 직전 update가 오래전일 수 있어 한 프레임(1/60초)으로 센다.
            // 한 번에 건너뛰는 폭은 1초로 자른다(탭을 오래 숨겼다 돌아온 경우 등). 더 짧게 자르면 프레임이 느린 기기
            // (초당 1~4장)에서 시계가 실제 시간보다 몇 배 느려져 연출이 한없이 늘어진다
            goal = runwayProgress(window.scrollY, 0.9 * vh, yA, yB);
            const dt = ticking ? Math.min(1, (now - clockAt) / 1000) : 1 / 60;
            clock = now < snapUntil ? goal : stepPlaneClock(clock < 0 ? target.current.plane : clock, goal, dt, rate);
            clockAt = now;
            plane = clock;
            h = runwayPhases(clock).h;
          }
        }
      }
      // 시계가 아직 목표에 못 미쳤으면 다음 프레임에도 update를 돈다(스크롤이 멈춰도 장면은 이어서 움직인다)
      ticking = goal >= 0 && clock !== goal;
      if (ticking) raf = requestAnimationFrame(update);
      const handoff = h > 0 && h < 1;
      // 전환이 움직였으면(구간 안이거나, 휠 한 번에 y0·yA를 건너뛰어 0↔1로 바로 바뀐 경우도) 시각을 적어 둔다.
      // 건너뛴 경우 follow가 곧바로 꺼져 남은 거리를 느린 감쇠로 한참 흘러가므로 600ms 동안 빠른 감쇠를 잇는다
      if (handoff || (prevH >= 0 && h >= 0 && h !== prevH)) lastHandoff = now;
      prevH = h;
      const followUntil = lastHandoff + 600;
      // 장면 고르기(scenes.ts pickScene): 여백이 있으면 첫 화면·머리말·①은 활성 섹션이 아니라 시계로 고른다
      const picked = pickScene({
        active, plane, h, portrait: portrait.current, heroScroll: Math.min(1, window.scrollY / (0.9 * vh)), intro,
      });
      if (!picked) { writeHandoff(html, h, plane); return; }
      let s: SceneState = picked;
      if (plane >= 0) {
        // 고개로 비행기를 살짝 따라간다(시안: 방향 차이의 35%, 높이 차이의 30%) — 멀어지는 비행기가 화면 구석으로
        // 빨리 밀려나지 않고, 흩어지는 모습이 화면 안에서 보이게. 불빛이 지형으로 넘어가며 풀려(planeFollow)
        // ① 카메라 C는 그대로 도착한다. 목표점만 돌리므로 카메라 위치·감쇠 규칙은 그대로다
        // 세로 화면은 출발 자리를 앞으로 당긴다(PLANE.portraitStart) — 점(TerrainPoints planeStart)과 같은 값이어야 고개가 비행기를 향한다
        const f = planeFollow(plane);
        const look = f > 0 ? lookToward(s.camera, s.target, planePose(plane, planeStart).pos, PLANE.followYaw * f, PLANE.followPitch * f) : s.target;
        s = { ...s, target: look, plane };
      }
      // data-scene이 아니라 data-active-scene으로 적는다 — data-scene은 챕터 블록이 자기 장면 이름을 적는
      // 속성이라(activeScene.ts의 readCandidates가 [data-scene]을 찾는다), 같은 이름을 html에도 쓰면
      // html 자신이 후보가 되고 `[data-scene="X"] 자손` 셀렉터가 페이지 전체와 겹친다(e2e에서 발견)
      if (active) html.dataset.activeScene = active.key;
      const chartKey = s.chart === 1 && active ? (active.key as ChartKey) : null;
      const entry = chartKey ? getChart(chartKey) : undefined;
      const cs = chartState.current;
      if (chartKey && entry && cloud && (cs.key !== chartKey || cs.entry !== entry)) {
        // 다른 차트거나 같은 차트의 배치 종류(variant)가 바뀌면(사이에 지형 장면을 거쳤어도) 반대 슬롯에 쓰고 그쪽으로 옮겨 간다
        const variant = entry.layout.variant ?? '';
        const slot = pickSlot(lastWritten.current, chartKey, variant);
        const assign = assignPoints(entry.layout.group, entry.layout.n, cloud.date, cloud.kind);
        const { pos, style, hl } = slotBuffers(entry, assign, cloud.terrain, CHART_DISTANCE, CHART_FOV);
        slots.current.pending = { slot, pos, style, hl };
        chartState.current = { key: chartKey, entry, slot };
        lastWritten.current = { key: chartKey, variant, slot };
        document.documentElement.dataset.chart = chartKey;
      }
      if (!chartKey) {
        chartState.current = { ...chartState.current, key: null, entry: null };
        delete document.documentElement.dataset.chart;
      }
      // 차트 장면은 블록이 화면 가운데를 지나면 켜지지만 판은 윗변이 화면 맨 위에 닿은 동안만 고정된다.
      // 들어오고 나가는 동안에는 이름표가 스크롤로 움직이므로, 판의 지금 위치만큼 점도 위아래로 옮긴다
      // 차트가 아닌 장면으로 넘어간 뒤에도 마지막 차트의 판을 계속 따라간다 — uChart가 1→0으로 줄어드는 동안
      // 0으로 바꾸면 점이 판 위치만큼 한 번에 튄다(uChart가 0이 되면 이 값은 화면에 영향이 없다)
      if (chartKey) shiftKey.current = chartKey;
      let shift = 0;
      if (shiftKey.current) {
        const top = document.querySelector(`[data-scene="${shiftKey.current}"] .chart-stage`)?.getBoundingClientRect().top;
        if (top !== undefined) shift = chartShiftY(top, window.innerHeight, CHART_DISTANCE, CHART_FOV);
      }
      // 강조는 그 차트에 머무는 동안만 — 다른 장면에서는 끈다(마우스가 항목 위에 남은 채 스크롤해도)
      slots.current.focus = chartKey ? getFocus(chartKey) : -1;
      slots.current.focusTone = chartKey && entry ? entry.layout.focusTone : 2;
      slots.current.focusDim = chartKey && entry ? entry.layout.focusDim : 0.25;
      // 배치가 아직 없으면(데이터를 받는 중) 점을 지형에 둔다 — 빈 화면 대신 멀리 보이는 지형
      target.current = { ...s, chart: chartKey && entry ? 1 : 0, slot: chartState.current.slot, shift, followUntil };
      writeHandoff(html, h, plane); // DOM 읽기(.chart-stage)가 모두 끝난 뒤에 쓴다
      // 전환 앞 절반(아직 공항에 가까울 때)과 시계로 고른 공항(h 0)에서만 마우스 시차를 둔다
      const runway = plane >= 0 && (!active || active.key === 'hero' || active.key === 'about');
      parallax.current = handoff ? h < 0.5 : runway ? h <= 0 : active?.key === 'hero';
      setRunning(active?.key !== 'contact' && !document.hidden);
    };
    const schedule = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    // 옆 목차·페이지 안 링크(#…) 클릭과 주소 # 바뀜은 점프 — 시계를 목표에 바로 맞춘다(위 snapUntil)
    const snap = () => { snapUntil = performance.now() + 300; schedule(); };
    const onClick = (e: MouseEvent) => {
      if ((e.target as Element | null)?.closest?.('a[href^="#"]')) snap();
    };
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    window.addEventListener('hashchange', snap);
    document.addEventListener('click', onClick, { capture: true });
    document.addEventListener('visibilitychange', schedule);
    // 그림 판이 배치를 새로 올리면(처음 불러옴·창 크기 변경) 지금 장면에 다시 반영한다
    const off = onChartsChange(schedule);
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('hashchange', snap);
      document.removeEventListener('click', onClick, { capture: true });
      document.removeEventListener('visibilitychange', schedule);
      off();
      if (raf) cancelAnimationFrame(raf);
      // 3D가 꺼지거나(실패·언마운트) 이 효과가 다시 돌 때 옛 값이 html에 남지 않게 지운다 —
      // 남아 있으면 e2e 등이 "지금 장면"을 옛 값으로 잘못 읽는다
      delete document.documentElement.dataset.activeScene;
      delete document.documentElement.dataset.chart;
      delete document.documentElement.dataset.handoff;
      delete document.documentElement.dataset.signal;
      bd?.style.removeProperty('--sky');
    };
  }, [capture, cloud, planeStart]);

  if (!cloud) return null;

  return (
    <div className="backdrop" aria-hidden="true" ref={backdrop}>
      <Canvas
        // 데스크톱 2 · 세로 화면 1.5 · 낮춤 단계 1(frameRate.ts maxDpr). 세로 판정은 점 구름과 같은 값(isPortrait)
        dpr={[1, maxDpr(level, isPortrait)]}
        frameloop={(running || capture) && compiled ? 'always' : 'never'}
        // 처음 화각은 첫 장면 값(첫 화면 45°), 그 뒤는 CameraRig가 장면 값으로 옮긴다. 차트 장면은 CHART_FOV(40°)라
        // 차트 좌표 대응(three/scenes.ts CHART_DISTANCE·CHART_FOV)이 그대로 맞는다
        camera={{ fov: target.current.fov, near: 0.1, far: 200, position: target.current.camera }}
        gl={{ antialias: false, alpha: true, powerPreference: 'high-performance', preserveDrawingBuffer: !!capture }}
        onCreated={(state) => {
          // 모바일에서는 GL 컨텍스트가 갑자기 끊길 수 있다 — 화면이 멈추는 대신 대체 이미지로 넘어간다
          state.gl.domElement.addEventListener('webglcontextlost', () => onFail('context'));
        }}
      >
        <AirportExtras target={target} instant={!!capture} portrait={isPortrait} takeoff={!!airport && airport.plane > 0} />
        <TerrainPoints cloud={cloud} target={target} slots={slots} instant={!!capture} showNoise={level === 0} airport={airport} planeStart={planeStart} portrait={isPortrait} bins={bins} />
        <CameraRig target={target} instant={!!capture} parallax={parallax} />
        <Precompile onDone={onCompiled} />
        <FrameWatch
          enabled={!capture}
          onFirstFrame={() => {
            onReady();
            if (capture) requestAnimationFrame(() => requestAnimationFrame(() => {
              (window as Window & { __sceneReady?: boolean }).__sceneReady = true;
            }));
          }}
          onSlow={() => (level === 0 ? setLevel(1) : onFail('fps'))}
        />
      </Canvas>
      {/* 첫 화면 전용 비네트(시안식, globals.css .backdrop-veil). ::after(다른 장면 비네트)와 불투명도로 엇갈려 바뀐다 */}
      <div className="backdrop-veil" />
    </div>
  );
}

// 장면의 모든 재질을 compileAsync로 미리 컴파일한다. KHR_parallel_shader_compile이 있으면 컴파일을 기다리는 동안
// 메인 스레드가 놀고, 없어도(소프트웨어 렌더러) 컴파일이 첫 프레임과 다른 작업으로 떨어진다.
// 형제(점·공항 곁가지)가 먼저 마운트돼 객체가 장면에 붙은 뒤 이 효과가 돈다(마지막 자식). 실패해도 그냥 프레임을 연다
function Precompile({ onDone }: { onDone: () => void }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    let alive = true;
    gl.compileAsync(scene, camera).catch(() => undefined).finally(() => { if (alive) onDone(); });
    return () => { alive = false; };
  }, [gl, scene, camera, onDone]);
  return null;
}

// 프레임 감시: 첫 프레임 알림 + 평균 fps(프레임 시간 EMA)가 30 미만인 채로 2초 이어지면 onSlow
// (한 번 부른 뒤 다시 2초를 잰다). 판정 로직은 frameRate.ts(단위 테스트됨).
function FrameWatch({ enabled, onFirstFrame, onSlow }: { enabled: boolean; onFirstFrame: () => void; onSlow: () => void }) {
  const first = useRef(true);
  const rate = useRef(initialFrameRate());
  useFrame((_, delta) => {
    if (first.current) { first.current = false; onFirstFrame(); return; }
    if (!enabled) return;
    const r = stepFrameRate(rate.current, delta, { minFps: SLOW_FPS, seconds: SLOW_SECONDS });
    rate.current = r.state;
    if (r.slow) onSlow();
  });
  return null;
}
