'use client';
// 카메라: 장면 상태의 위치·목표점으로 부드럽게 이동한다. 첫 화면에서는 마우스를 따라 살짝 기운다(시차).
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { SceneState } from './scenes';

type Props = { target: React.RefObject<SceneState>; instant: boolean; parallax: React.RefObject<boolean> };

export function CameraRig({ target, instant, parallax }: Props) {
  const camera = useThree((s) => s.camera);
  const look = useRef(new THREE.Vector3());
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
    const sway = parallax.current ? 1.2 : 0;
    const goal = new THREE.Vector3(t.camera[0] + mouse.current.x * sway, t.camera[1] - mouse.current.y * sway, t.camera[2]);
    const goalLook = new THREE.Vector3(...t.target);
    if (instant) {
      camera.position.copy(goal);
      look.current.copy(goalLook);
    } else {
      camera.position.x = THREE.MathUtils.damp(camera.position.x, goal.x, 1.8, delta);
      camera.position.y = THREE.MathUtils.damp(camera.position.y, goal.y, 1.8, delta);
      camera.position.z = THREE.MathUtils.damp(camera.position.z, goal.z, 1.8, delta);
      look.current.x = THREE.MathUtils.damp(look.current.x, goalLook.x, 1.8, delta);
      look.current.y = THREE.MathUtils.damp(look.current.y, goalLook.y, 1.8, delta);
      look.current.z = THREE.MathUtils.damp(look.current.z, goalLook.z, 1.8, delta);
    }
    camera.lookAt(look.current);
  });
  return null;
}
