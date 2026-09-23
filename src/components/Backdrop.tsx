'use client';
// 3D 배경 스위치: 기기 능력을 보고, 첫 화면이 그려진 뒤 3D 캔버스를 지연 로딩한다.
// three 코드는 dynamic import로 따로 떨어져 있어 초기 JS에 포함되지 않는다(스펙 §8.1).
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useState } from 'react';
import { canRender3D, detectEnv } from '@/three/capability';
import type { SceneKey } from '@/three/scenes';

const TerrainScene = dynamic(() => import('@/three/TerrainScene'), { ssr: false });

export function Backdrop({ dataVersion }: { dataVersion: string }) {
  const [load, setLoad] = useState(false);
  const [capture, setCapture] = useState<SceneKey | null>(null);

  useEffect(() => {
    const env = detectEnv(window);
    if (!canRender3D(env)) { setMode('off'); return; }
    setCapture((new URLSearchParams(window.location.search).get('capture') as SceneKey | null) ?? null);
    // 첫 화면 텍스트가 먼저 그려지도록 브라우저가 한가할 때 불러온다
    const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 300));
    idle(() => setLoad(true));
  }, []);

  const onReady = useCallback(() => setMode('on'), []);
  const onFail = useCallback((reason: string) => {
    console.warn(`3D 끔: ${reason}`); // 방문자에게는 대체 이미지가 보이므로 경고만 남긴다
    setMode('off');
    setLoad(false);
  }, []);

  return load ? <TerrainScene dataVersion={dataVersion} onReady={onReady} onFail={onFail} capture={capture} /> : null;
}

function setMode(mode: 'on' | 'off') {
  document.documentElement.setAttribute('data-3d', mode);
}
