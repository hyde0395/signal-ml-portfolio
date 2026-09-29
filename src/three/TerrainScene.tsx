'use client';
// 화면 뒤에 고정된 3D 캔버스. 데이터를 받아 점 구름을 만들고, 스크롤로 활성 장면을 정하고,
// 프레임이 떨어지면 단계적으로 낮추다가 대체 화면으로 넘긴다(스펙 §8.3). 캡처 모드도 여기서 처리한다.
import { Canvas, useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import { getChart, getFocus, onChartsChange } from '@/charts/registry';
import type { ChartEntry, ChartKey } from '@/charts/types';
import { pickActive, readCandidates } from './activeScene';
import { buildAirport } from './airport';
import { AirportExtras } from './AirportExtras';
import { assignAirport } from './airportAssign';
import { CameraRig } from './CameraRig';
import { assignPoints, chartShiftY, pickSlot, slotBuffers } from './chartTargets';
import { buildPointCloud, loadSceneData, type MapData, type Terrain } from './data';
import { initialFrameRate, maxDpr, stepFrameRate } from './frameRate';
import { lookToward, PLANE, planeFollow, planePose, planeShape, takeoffProgress } from './plane';
import { blendScenes, CHART_DISTANCE, CHART_FOV, handoffProgress, sceneFor, type SceneKey, type SceneState } from './scenes';
import { TerrainPoints, type ChartSlots } from './TerrainPoints';

type Props = { dataVersion: string; onReady: () => void; onFail: (reason: string) => void; capture: SceneKey | null };

const SLOW_FPS = 30;
const SLOW_SECONDS = 2;

export default function TerrainScene({ dataVersion, onReady, onFail, capture }: Props) {
  const [data, setData] = useState<{ terrain: Terrain; map: MapData } | null>(null);
  const [level, setLevel] = useState(0);        // 0 정상, 1 낮춤(DPR 1·잡음 숨김)
  const [running, setRunning] = useState(true); // 탭 숨김·연락처 섹션에서는 멈춘다
  const portrait = useRef(false);
  const target = useRef<SceneState>(sceneFor(capture ?? 'hero', 0, false));
  const parallax = useRef(true);
  const slots = useRef<ChartSlots>({ pending: null, focus: -1, focusTone: 2, focusDim: 0.25 });
  // 지금 슬롯에 써 넣은 차트와 그 슬롯. 다른 차트로 가면(지형을 거쳐도) 반대 슬롯에 써서 점이 두 배치 사이를 옮겨 간다
  const shiftKey = useRef<ChartKey | null>(null); // 점 이동량(shift)을 잴 판의 차트 — 차트를 벗어나도 마지막 것을 유지
  const chartState = useRef<{ key: ChartKey | null; entry: ChartEntry | null; slot: 0 | 1 }>({ key: null, entry: null, slot: 0 });
  // 마지막으로 슬롯에 써 넣은 차트 — chartState.key와 달리 지형으로 나가도 지우지 않는다(chartTargets.ts pickSlot)
  const lastWritten = useRef<{ key: ChartKey | null; slot: 0 | 1 }>({ key: null, slot: 0 });

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
  const airport = useMemo(() => {
    if (!cloud) return null;
    // 이륙 비행기 점(설계 2026-09-29 §7)도 함께 — 휴대폰도 같은 232개(비행기 모양이 성기면 실루엣이 안 읽힌다)
    return assignAirport(buildAirport({ stride: isPortrait ? 2 : 1 }).lights, cloud.kind, planeShape());
  }, [cloud, isPortrait]);

  // 스크롤·크기 변화 → 활성 장면 → 목표 상태(차트 장면이면 그림 판 배치도). 캡처 모드에서는 고정.
  useEffect(() => {
    // 점 구름이 새로 만들어지면 슬롯에 써 둔 배치는 옛 점 번호 기준이라 다시 써야 한다
    chartState.current = { key: null, entry: null, slot: chartState.current.slot };
    if (capture) {
      portrait.current = window.innerHeight > window.innerWidth;
      // bubble의 대체 이미지는 "떨어지기 전, 높이 떠 있는" 순간을 보여줘야 하므로 진행도 0(drop=0)에서 찍는다
      target.current = sceneFor(capture, 0, portrait.current);
      return;
    }
    let raf = 0;
    // 마지막으로 html에 적은 전환 표시·하늘 값 — 같은 값이면 다시 쓰지 않는다(속성·변수 쓰기는 스타일 재계산을 부른다)
    let shownHandoff: string | null = null, shownSky: string | null = null;
    let prevH = -1;        // 직전 update의 전환 진행도(-1 = 계산 안 함)
    let lastHandoff = -Infinity; // 전환이 마지막으로 움직인 시각(performance.now)
    // 전환 표시(data-handoff, e2e가 읽는다)와 하늘 불투명도(--sky)를 html에 적는다. 이 함수는 update의 DOM 읽기가
    // 끝난 뒤에만 부른다 — 먼저 쓰면 뒤따르는 .chart-stage 읽기가 스타일 재계산을 강제한다
    const writeHandoff = (html: HTMLElement, h: number) => {
      const hs = h >= 0 ? h.toFixed(3) : null;
      // 하늘(globals.css .backdrop::before)을 스크롤에 묶는다: 머리말이 화면 가운데일 때는 활성 장면이 없어
      // data-active-scene이 hero로 남으므로, 장면 이름만으로는 지평선 띠가 전환 내내 또렷이 남는다.
      // 세제곱으로 앞쪽에서 빨리 걷어 내 공항 점이 흩어지기 시작할 무렵엔 띠가 거의 사라지게 한다
      const ss = h >= 0 ? ((1 - h) ** 3).toFixed(3) : null;
      if (hs !== shownHandoff) {
        if (hs === null) delete html.dataset.handoff;
        else html.dataset.handoff = hs;
        shownHandoff = hs;
      }
      if (ss !== shownSky) {
        if (ss === null) html.style.removeProperty('--sky');
        else html.style.setProperty('--sky', ss);
        shownSky = ss;
      }
    };
    const update = () => {
      raf = 0;
      portrait.current = window.innerHeight > window.innerWidth;
      const vh = window.innerHeight;
      const active = pickActive(readCandidates(document), vh);
      const html = document.documentElement;
      // 첫 화면 → ① 전환(설계 2026-09-29 §2.1·§5): 내려앉기가 끝난 뒤(y0)부터 ① 제목이 읽는 자리에 올 때(y1)까지
      // 스크롤 위치로 공항과 ① 장면을 섞는다. 머리말(#intro)이 화면 가운데일 때는 활성 장면 후보가 없어
      // active가 null이므로 그보다 먼저 계산한다. 3D가 맨 위에서 켜졌을 때(hero-runway 여백)만 — 그 밖에는
      // 내려앉기 여백이 없어 y0가 의미 없다. #project 위치는 방금 readCandidates가 레이아웃을 읽은 뒤
      // (사이에 DOM 쓰기 없음)라 추가 레이아웃 계산이 없고, 캐시하지 않으므로 글꼴·창 크기 변화에도 늘 맞다
      let h = -1; // -1 = 전환 계산 안 함
      let plane = -1; // 이륙 비행기 진행도(plane.ts takeoffProgress). -1 = 장면 기본값(첫 화면 0, 그 밖 1)
      if (html.classList.contains('hero-runway')) {
        // 활성 장면이 ①보다 뒤(②~)면 #project 윗변은 이미 y1을 한참 지났다 — 읽지 않고 1로 둔다
        if (active && active.key !== 'hero' && active.key !== 'about') h = plane = 1;
        else {
          const projectTop = document.getElementById('project')?.getBoundingClientRect().top;
          if (projectTop !== undefined) {
            const y1 = projectTop + window.scrollY - 0.2 * vh;
            h = handoffProgress(window.scrollY, 0.9 * vh, y1);
            // 비행기는 내려앉기(0 → y0)와 전환(y0 → y1)을 한 눈금으로 잇는다 — 시안이 한 스크롤 안에서 둘을 이었다
            plane = takeoffProgress(window.scrollY, 0.9 * vh, y1);
          }
        }
      }
      const handoff = h > 0 && h < 1;
      const now = performance.now();
      // 전환이 움직였으면(구간 안이거나, 휠 한 번에 y0·y1을 건너뛰어 0↔1로 바로 바뀐 경우도) 시각을 적어 둔다.
      // 건너뛴 경우 follow가 곧바로 꺼져 남은 거리를 느린 감쇠로 한참 흘러가므로 600ms 동안 빠른 감쇠를 잇는다
      if (handoff || (prevH >= 0 && h >= 0 && h !== prevH)) lastHandoff = now;
      prevH = h;
      const followUntil = lastHandoff + 600;
      if (!active && !handoff) { writeHandoff(html, h); return; }
      let s: SceneState;
      if (handoff) {
        // 공항 끝(hero 진행 1)과 ① 처음(about 진행 0) 사이. follow로 점·카메라가 스크롤을 바짝 따라간다
        s = { ...blendScenes(sceneFor('hero', 1, portrait.current), sceneFor('about', 0, portrait.current), h), follow: true };
      } else {
        const a = active!;
        // 첫 화면은 섹션 안 진행도가 아니라 스크롤 위치로 내려앉는다(처음 화면에서 진행도가 이미 0.5 근처라서)
        const progress = a.key === 'hero' ? Math.min(1, window.scrollY / (0.9 * vh)) : a.progress;
        s = sceneFor(a.key, progress, portrait.current);
      }
      if (plane >= 0) {
        // 고개로 비행기를 살짝 따라간다(시안: 방향 차이의 35%, 높이 차이의 30%) — 멀어지는 비행기가 화면 구석으로
        // 빨리 밀려나지 않고, 흩어지는 모습이 화면 안에서 보이게. 불빛이 지형으로 넘어가며 풀려(planeFollow)
        // ① 카메라 C는 그대로 도착한다. 목표점만 돌리므로 카메라 위치·감쇠 규칙은 그대로다
        const f = planeFollow(plane);
        const target = f > 0 ? lookToward(s.camera, s.target, planePose(plane).pos, PLANE.followYaw * f, PLANE.followPitch * f) : s.target;
        s = { ...s, target, plane };
      }
      // data-scene이 아니라 data-active-scene으로 적는다 — data-scene은 챕터 블록이 자기 장면 이름을 적는
      // 속성이라(activeScene.ts의 readCandidates가 [data-scene]을 찾는다), 같은 이름을 html에도 쓰면
      // html 자신이 후보가 되고 `[data-scene="X"] 자손` 셀렉터가 페이지 전체와 겹친다(e2e에서 발견)
      if (active) html.dataset.activeScene = active.key;
      const chartKey = s.chart === 1 && active ? (active.key as ChartKey) : null;
      const entry = chartKey ? getChart(chartKey) : undefined;
      const cs = chartState.current;
      if (chartKey && entry && cloud && (cs.key !== chartKey || cs.entry !== entry)) {
        // 다른 차트면(사이에 지형 장면을 거쳤어도) 반대 슬롯에 쓰고 그쪽으로 옮겨 간다
        const slot = pickSlot(lastWritten.current, chartKey);
        const assign = assignPoints(entry.layout.group, entry.layout.n, cloud.date, cloud.kind);
        const { pos, style, hl } = slotBuffers(entry, assign, cloud.terrain, CHART_DISTANCE, CHART_FOV);
        slots.current.pending = { slot, pos, style, hl };
        chartState.current = { key: chartKey, entry, slot };
        lastWritten.current = { key: chartKey, slot };
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
      writeHandoff(html, h); // DOM 읽기(.chart-stage)가 모두 끝난 뒤에 쓴다
      // 전환 앞 절반(아직 공항에 가까울 때)만 마우스 시차를 둔다
      parallax.current = handoff ? h < 0.5 : active?.key === 'hero';
      setRunning(active?.key !== 'contact' && !document.hidden);
    };
    const schedule = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    document.addEventListener('visibilitychange', schedule);
    // 그림 판이 배치를 새로 올리면(처음 불러옴·창 크기 변경) 지금 장면에 다시 반영한다
    const off = onChartsChange(schedule);
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      document.removeEventListener('visibilitychange', schedule);
      off();
      if (raf) cancelAnimationFrame(raf);
      // 3D가 꺼지거나(실패·언마운트) 이 효과가 다시 돌 때 옛 값이 html에 남지 않게 지운다 —
      // 남아 있으면 e2e 등이 "지금 장면"을 옛 값으로 잘못 읽는다
      delete document.documentElement.dataset.activeScene;
      delete document.documentElement.dataset.chart;
      delete document.documentElement.dataset.handoff;
      document.documentElement.style.removeProperty('--sky');
    };
  }, [capture, cloud]);

  if (!cloud) return null;

  return (
    <div className="backdrop" aria-hidden="true">
      <Canvas
        // 데스크톱 2 · 세로 화면 1.5 · 낮춤 단계 1(frameRate.ts maxDpr). 세로 판정은 점 구름과 같은 값(isPortrait)
        dpr={[1, maxDpr(level, isPortrait)]}
        frameloop={running || capture ? 'always' : 'never'}
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
        <TerrainPoints cloud={cloud} target={target} slots={slots} instant={!!capture} showNoise={level === 0} airport={airport} />
        <CameraRig target={target} instant={!!capture} parallax={parallax} />
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
