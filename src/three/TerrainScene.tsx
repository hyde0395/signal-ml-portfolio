'use client';
// 화면 뒤에 고정된 3D 캔버스. 데이터를 받아 점 구름을 만들고, 스크롤로 활성 장면을 정하고,
// 프레임이 떨어지면 단계적으로 낮추다가 대체 화면으로 넘긴다(스펙 §8.3). 캡처 모드도 여기서 처리한다.
import { Canvas, useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import { getChart, onChartsChange } from '@/charts/registry';
import type { ChartEntry, ChartKey } from '@/charts/types';
import { pickActive, readCandidates } from './activeScene';
import { CameraRig } from './CameraRig';
import { assignPoints, chartShiftY, slotBuffers } from './chartTargets';
import { buildPointCloud, loadSceneData, type MapData, type Terrain } from './data';
import { initialFrameRate, stepFrameRate } from './frameRate';
import { CHART_DISTANCE, CHART_FOV, sceneFor, type SceneKey, type SceneState } from './scenes';
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
  const slots = useRef<ChartSlots>({ pending: null });
  // 지금 슬롯에 써 넣은 차트와 그 슬롯. 차트에서 차트로 넘어갈 때만 다른 슬롯에 써서 점이 두 배치 사이를 옮겨 간다
  const shiftKey = useRef<ChartKey | null>(null); // 점 이동량(shift)을 잴 판의 차트 — 차트를 벗어나도 마지막 것을 유지
  const chartState = useRef<{ key: ChartKey | null; entry: ChartEntry | null; slot: 0 | 1 }>({ key: null, entry: null, slot: 0 });

  useEffect(() => {
    loadSceneData(dataVersion).then(setData).catch((e) => onFail(`data: ${e.message}`));
  }, [dataVersion, onFail]);

  const cloud = useMemo(() => {
    if (!data) return null;
    // 세로 화면(대개 휴대폰)은 잡음 점을 절반만 그린다
    const isPortrait = typeof window !== 'undefined' && window.innerHeight > window.innerWidth;
    return buildPointCloud(data.terrain, data.map, { noiseStride: isPortrait ? 2 : 1, seed: 7 });
  }, [data]);

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
    const update = () => {
      raf = 0;
      portrait.current = window.innerHeight > window.innerWidth;
      const active = pickActive(readCandidates(document), window.innerHeight);
      if (!active) return;
      const s = sceneFor(active.key, active.progress, portrait.current);
      // data-scene이 아니라 data-active-scene으로 적는다 — data-scene은 챕터 블록이 자기 장면 이름을 적는
      // 속성이라(activeScene.ts의 readCandidates가 [data-scene]을 찾는다), 같은 이름을 html에도 쓰면
      // html 자신이 후보가 되고 `[data-scene="X"] 자손` 셀렉터가 페이지 전체와 겹친다(e2e에서 발견)
      document.documentElement.dataset.activeScene = active.key;
      const chartKey = s.chart === 1 ? (active.key as ChartKey) : null;
      const entry = chartKey ? getChart(chartKey) : undefined;
      const cs = chartState.current;
      if (chartKey && entry && cloud && (cs.key !== chartKey || cs.entry !== entry)) {
        // 다른 차트에서 넘어오면 반대 슬롯에 쓰고 그쪽으로 옮겨 간다. 지형에서 들어오거나(key null)
        // 같은 차트가 다시 배치되면(창 크기 변경) 지금 슬롯에 바로 쓴다
        const slot: 0 | 1 = cs.key !== null && cs.key !== chartKey ? (cs.slot === 0 ? 1 : 0) : cs.slot;
        const assign = assignPoints(entry.layout.group, entry.layout.n, cloud.date, cloud.kind);
        const { pos, style } = slotBuffers(entry, assign, cloud.terrain, CHART_DISTANCE, CHART_FOV);
        slots.current.pending = { slot, pos, style };
        chartState.current = { key: chartKey, entry, slot };
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
      // 배치가 아직 없으면(데이터를 받는 중) 점을 지형에 둔다 — 빈 화면 대신 멀리 보이는 지형
      target.current = { ...s, chart: chartKey && entry ? 1 : 0, slot: chartState.current.slot, shift };
      parallax.current = active.key === 'hero';
      setRunning(active.key !== 'contact' && !document.hidden);
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
    };
  }, [capture, cloud]);

  if (!cloud) return null;
  const maxDpr = level > 0 ? 1 : 1.5;

  return (
    <div className="backdrop" aria-hidden="true">
      <Canvas
        dpr={[1, maxDpr]}
        frameloop={running || capture ? 'always' : 'never'}
        // 차트 좌표 대응(three/scenes.ts CHART_DISTANCE)이 이 fov 값에 묶여 있다
        camera={{ fov: CHART_FOV, near: 0.1, far: 200, position: target.current.camera }}
        gl={{ antialias: false, alpha: true, powerPreference: 'high-performance', preserveDrawingBuffer: !!capture }}
        onCreated={(state) => {
          // 모바일에서는 GL 컨텍스트가 갑자기 끊길 수 있다 — 화면이 멈추는 대신 대체 이미지로 넘어간다
          state.gl.domElement.addEventListener('webglcontextlost', () => onFail('context'));
        }}
      >
        <TerrainPoints cloud={cloud} target={target} slots={slots} instant={!!capture} showNoise={level === 0} />
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
