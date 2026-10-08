'use client';
// 3D 배경 스위치: 기기 능력을 보고, 첫 화면이 그려진 뒤 3D 캔버스를 지연 로딩한다.
// three 코드는 dynamic import로 따로 떨어져 있어 초기 JS에 포함되지 않는다(스펙 §8.1).
import dynamic from 'next/dynamic';
import { Component, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { PENDING_TIMER_KEY } from '@/lib/boot';
import { canRender3D, detectEnv, parseCapture } from '@/three/capability';
import type { SceneKey } from '@/three/scenes';

const TerrainScene = dynamic(() => import('@/three/TerrainScene'), { ssr: false });

// 3D를 받기 시작한 뒤 이 시간이 지나도 준비되지 않으면 대체 화면으로 넘어간다. 부트 스크립트의 6초보다 넉넉한 이유:
// 느린 4G에서는 3D 청크와 지형 데이터를 받는 데만 6초를 넘길 수 있고, 그때 off로 갔다가 on으로 돌아오면
// 첫 화면 이미지가 떴다가(받아지고 LCP가 되고) 다시 숨어 화면이 두 번 바뀐다.
export const SLOW_START_MS = 20000;

export function Backdrop({ dataVersion }: { dataVersion: string }) {
  const [load, setLoad] = useState(false);
  const [capture, setCapture] = useState<SceneKey | null>(null);
  const slowGuard = useRef<number | undefined>(undefined);
  const clearSlowGuard = useCallback(() => { window.clearTimeout(slowGuard.current); slowGuard.current = undefined; }, []);

  const onReady = useCallback(() => { clearSlowGuard(); setMode('on'); }, [clearSlowGuard]);
  const onFail = useCallback((reason: string) => {
    clearSlowGuard();
    console.warn(`3D 끔: ${reason}`); // 방문자에게는 대체 이미지가 보이므로 경고만 남긴다
    setMode('off');
    setLoad(false);
  }, [clearSlowGuard]);

  useEffect(() => {
    // 여기까지 왔으면 JS는 살아 있다. 부트 스크립트의 판정 대기 타이머는 "JS가 안 뜬 경우"만 막으므로 지우고,
    // 3D를 받는 동안의 제한 시간은 아래에서 따로 넉넉하게 건다(src/lib/boot.ts)
    window.clearTimeout((window as unknown as Record<string, number | undefined>)[PENDING_TIMER_KEY]);
    slowGuard.current = window.setTimeout(() => {
      if (document.documentElement.getAttribute('data-3d') === 'pending') onFail('timeout');
    }, SLOW_START_MS);
    // 첫 화면 텍스트가 먼저 그려지도록 브라우저가 한가할 때 판정하고 불러온다. 판정(detectEnv)은 시험용 WebGL 맥락을
    // 하나 만들어 꽤 비싸서(CPU 4배 기준 약 26ms) 하이드레이션 작업에 붙어 있으면 긴 작업을 늘렸다(계획 2026-10-08 성능)
    const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 300));
    let alive = true;
    idle(() => {
      if (!alive) return;
      if (!canRender3D(detectEnv(window))) { clearSlowGuard(); setMode('off'); return; }
      setCapture(parseCapture(window.location.search)); // 모르는 장면 이름은 무시(null)
      setLoad(true);
    });
    return () => { alive = false; clearSlowGuard(); };
  }, [onFail, clearSlowGuard]);

  return load ? (
    <SceneBoundary onFail={onFail}>
      <TerrainScene dataVersion={dataVersion} onReady={onReady} onFail={onFail} capture={capture} />
    </SceneBoundary>
  ) : null;
}

// 3D 쪽에서 렌더 오류가 나도(청크 로딩 실패, 셰이더·데이터 예외 등) 페이지 전체가 비지 않게 막는 경계.
// 오류를 한 번만 알리고(onFail → data-3d="off" → 대체 이미지) 자신은 아무것도 그리지 않는다.
class SceneBoundary extends Component<{ onFail: (reason: string) => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onFail('error');
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

// 맨 위로 돌아오기를 기다리는 스크롤 감시(아래 setMode). 한 번에 하나만 둔다
let runwayWatch: (() => void) | null = null;

function setMode(mode: 'on' | 'off') {
  const d = document.documentElement;
  d.setAttribute('data-3d', mode);
  // 3D가 꺼지면 여백을 새로 붙일 일이 없으니 기다리던 스크롤 감시를 바로 거둔다
  if (mode === 'off' && runwayWatch) { window.removeEventListener('scroll', runwayWatch); runwayWatch = null; }
  // 히어로 아래 60vh 여백(.hero-stage, globals.css)은 원래 data-3d="on"에 그대로 매달아 뒀는데,
  // 그러면 나중에 fps 하락·GL 컨텍스트 끊김으로 3D가 off로 바뀔 때 여백이 함께 사라져 뒤 콘텐츠가
  // 화면에서 60vh만큼 위로 튄다(Safari는 스크롤 위치를 보정해 주지 않는다). 반대로 느린 회선이라
  // 사용자가 이미 스크롤해 내려간 뒤에 3D가 켜지면, 이미 지나온 화면 중간에 여백이 새로 끼어들어도
  // 내용이 튄다. 그래서 "3D가 켜져 있고 맨 위(스크롤 10px 미만)일 때만" 여백을 붙박이 클래스로
  // 켜고(html.hero-runway), 이후에는 data-3d가 off로 바뀌어도 절대 지우지 않는다.
  // 켜지는 순간 맨 위가 아니었다면(3D를 받는 몇 초 사이에 스크롤했거나, 새로고침이 스크롤 위치를 되살림)
  // 그 방문 내내 이륙·전환이 안 나왔다 — TerrainScene은 이 클래스가 있을 때만 그것들을 계산한다. 그래서 그때는
  // 스크롤을 지켜보다가 맨 위로 돌아오는 순간 붙인다. 맨 위에서는 여백이 히어로 아래(화면 밖)에 끼어들 뿐이라
  // 보이는 것이 움직이지 않는다. 3D가 꺼지면(off) 감시를 바로 거둔다(위)
  // 보통은 부트 스크립트(src/lib/boot.ts)가 3D가 켜질 기기면 첫 그리기 전에 이미 붙여 둔다 — 여기서 붙이는 것은
  // 부트가 못 붙인 경우(캡처 모드처럼 부트 판정과 다른 길로 3D가 켜질 때)뿐이다
  if (mode !== 'on' || d.classList.contains('hero-runway')) return;
  if (window.scrollY < 10) { d.classList.add('hero-runway'); return; }
  if (runwayWatch) return;
  const watch = () => {
    const on = d.getAttribute('data-3d') === 'on';
    if (on && window.scrollY >= 10) return;
    if (on) d.classList.add('hero-runway');
    window.removeEventListener('scroll', watch);
    runwayWatch = null;
  };
  runwayWatch = watch;
  window.addEventListener('scroll', watch, { passive: true });
}
