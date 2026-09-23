'use client';
// 화면 뒤에 고정된 3D 캔버스. 데이터를 받아 점 구름을 만들고, 스크롤로 활성 장면을 정하고,
// 프레임이 떨어지면 단계적으로 낮추다가 대체 화면으로 넘긴다(스펙 §8.3). 캡처 모드도 여기서 처리한다.
import { Canvas, useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import { pickActive, readCandidates } from './activeScene';
import { CameraRig } from './CameraRig';
import { buildPointCloud, loadSceneData, type MapData, type Terrain } from './data';
import { sceneFor, type SceneKey, type SceneState } from './scenes';
import { TerrainPoints } from './TerrainPoints';

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

  useEffect(() => {
    loadSceneData(dataVersion).then(setData).catch((e) => onFail(`data: ${e.message}`));
  }, [dataVersion, onFail]);

  // 스크롤·크기 변화 → 활성 장면 → 목표 상태. 캡처 모드에서는 고정.
  useEffect(() => {
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
      target.current = sceneFor(active.key, active.progress, portrait.current);
      parallax.current = active.key === 'hero';
      setRunning(active.key !== 'contact' && !document.hidden);
    };
    const schedule = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    document.addEventListener('visibilitychange', schedule);
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      document.removeEventListener('visibilitychange', schedule);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [capture]);

  const cloud = useMemo(() => {
    if (!data) return null;
    // 세로 화면(대개 휴대폰)은 잡음 점을 절반만 그린다
    const isPortrait = typeof window !== 'undefined' && window.innerHeight > window.innerWidth;
    return buildPointCloud(data.terrain, data.map, { noiseStride: isPortrait ? 2 : 1, seed: 7 });
  }, [data]);

  if (!cloud) return null;
  const maxDpr = level > 0 ? 1 : 1.5;

  return (
    <div className="backdrop" aria-hidden="true">
      <Canvas
        dpr={[1, maxDpr]}
        frameloop={running || capture ? 'always' : 'never'}
        camera={{ fov: 40, near: 0.1, far: 200, position: target.current.camera }}
        gl={{ antialias: false, alpha: true, powerPreference: 'high-performance', preserveDrawingBuffer: !!capture }}
        onCreated={(state) => {
          // 모바일에서는 GL 컨텍스트가 갑자기 끊길 수 있다 — 화면이 멈추는 대신 대체 이미지로 넘어간다
          state.gl.domElement.addEventListener('webglcontextlost', () => onFail('context'));
        }}
      >
        <TerrainPoints cloud={cloud} target={target} instant={!!capture} showNoise={level === 0} />
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

// 프레임 감시: 첫 프레임 알림 + 30fps 미만이 2초 이어지면 onSlow(한 번 부른 뒤 다시 2초를 잰다).
function FrameWatch({ enabled, onFirstFrame, onSlow }: { enabled: boolean; onFirstFrame: () => void; onSlow: () => void }) {
  const first = useRef(true);
  const slow = useRef(0);
  useFrame((_, delta) => {
    if (first.current) { first.current = false; onFirstFrame(); return; }
    if (!enabled || delta > 1) return; // 탭 복귀 직후의 큰 delta는 무시
    slow.current = 1 / delta < SLOW_FPS ? slow.current + delta : 0;
    if (slow.current > SLOW_SECONDS) { slow.current = 0; onSlow(); }
  });
  return null;
}
