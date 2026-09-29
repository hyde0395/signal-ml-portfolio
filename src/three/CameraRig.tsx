'use client';
// 카메라: 장면 상태의 위치·목표점·화각으로 부드럽게 이동한다. 첫 화면에서는 마우스를 따라 살짝 기운다(시차).
// 지평선 높이를 .backdrop의 --hz로 적어 CSS 하늘(globals.css .backdrop::before)의 지평선 줄을 3D에 맞춘다.
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { followActive, horizonFrac, type SceneState } from './scenes';

type Props = { target: React.RefObject<SceneState>; instant: boolean; parallax: React.RefObject<boolean> };

export function CameraRig({ target, instant, parallax }: Props) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const canvas = useThree((s) => s.gl.domElement);
  const look = useRef(new THREE.Vector3());
  const shownHz = useRef('');
  const mouse = useRef({ x: 0, y: 0 });

  useEffect(() => {
    // 캔버스는 pointer-events: none이라 창 전체에서 마우스를 듣는다
    const onMove = (e: PointerEvent) => {
      mouse.current = { x: e.clientX / window.innerWidth - 0.5, y: e.clientY / window.innerHeight - 0.5 };
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, []);

  useFrame((_, delta) => {
    const t = target.current;
    if (!t) return;
    const sway = parallax.current ? t.sway : 0;
    const goal = new THREE.Vector3(t.camera[0] + mouse.current.x * sway, t.camera[1] - mouse.current.y * sway, t.camera[2]);
    const goalLook = new THREE.Vector3(...t.target);
    // 화각: 첫 화면만 45°(scenes.ts HERO_FOV). 바뀔 때만 투영 행렬을 다시 만든다
    const fov = instant ? t.fov : THREE.MathUtils.damp(camera.fov, t.fov, followActive(t, performance.now()) ? 7 : 1.8, delta);
    if (Math.abs(fov - camera.fov) > 1e-4) { camera.fov = fov; camera.updateProjectionMatrix(); }
    if (instant) {
      camera.position.copy(goal);
      look.current.copy(goalLook);
    } else {
      // 전환 구간(follow, 빠른 휠 직후 잠깐 포함)에서는 점(TerrainPoints DAMP×4)과 함께 스크롤을 바짝 따라간다
      const k = followActive(t, performance.now()) ? 7 : 1.8;
      camera.position.x = THREE.MathUtils.damp(camera.position.x, goal.x, k, delta);
      camera.position.y = THREE.MathUtils.damp(camera.position.y, goal.y, k, delta);
      camera.position.z = THREE.MathUtils.damp(camera.position.z, goal.z, k, delta);
      look.current.x = THREE.MathUtils.damp(look.current.x, goalLook.x, k, delta);
      look.current.y = THREE.MathUtils.damp(look.current.y, goalLook.y, k, delta);
      look.current.z = THREE.MathUtils.damp(look.current.z, goalLook.z, k, delta);
    }
    camera.lookAt(look.current);
    // 하늘의 지평선 줄(CSS)은 고정 비율이면 내려앉는 동안(A 39.8% → B 36.6%) 3D 지평선과 어긋난다. 0.1% 넘게
    // 바뀔 때만 적는다 — 스크롤이 멈추면 쓰기도 멈춘다. html이 아니라 .backdrop에 적어 스타일 재계산을 배경에만 가둔다
    // (html 변수는 페이지 전체가 다시 계산된다). 화면 밖으로 나가는 값은 자른다(전환 뒤 가파른 카메라에서도 그라데이션이 성립)
    const hz = Math.min(100, Math.max(0, horizonFrac(camera.position.toArray(), look.current.toArray(), camera.fov) * 100)).toFixed(1);
    if (hz !== shownHz.current) {
      const el = canvas.closest('.backdrop') as HTMLElement | null;
      if (el) { el.style.setProperty('--hz', `${hz}%`); shownHz.current = hz; }
    }
  });
  return null;
}
