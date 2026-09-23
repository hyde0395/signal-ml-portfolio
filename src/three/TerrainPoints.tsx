'use client';
// 점 구름 하나(Points)와 셰이더 재질. 목표 장면 상태(target)로 uniform을 매 프레임 부드럽게 옮긴다.
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { PointCloud } from './data';
import type { SceneState } from './scenes';
import { fragmentShader, vertexShader } from './shaders';

type Props = { cloud: PointCloud; target: React.RefObject<SceneState>; instant: boolean; showNoise: boolean };

const DAMP = 2.2; // 클수록 빨리 따라간다. 스펙의 expo.out 느낌(처음 빠르고 끝이 느림)에 가깝다

export function TerrainPoints({ cloud, target, instant, showNoise }: Props) {
  const material = useRef<THREE.ShaderMaterial>(null);

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    // position은 three가 경계 계산에 쓰므로 지형 좌표를 넣어 둔다(실제 위치는 셰이더가 정함)
    g.setAttribute('position', new THREE.BufferAttribute(cloud.terrain, 3));
    g.setAttribute('aTerrain', new THREE.BufferAttribute(cloud.terrain, 3));
    g.setAttribute('aMap', new THREE.BufferAttribute(cloud.map, 3));
    g.setAttribute('aScatter', new THREE.BufferAttribute(cloud.scatter, 3));
    g.setAttribute('aKind', new THREE.BufferAttribute(cloud.kind, 1));
    g.setAttribute('aHoliday', new THREE.BufferAttribute(cloud.holiday, 1));
    g.setAttribute('aRoute', new THREE.BufferAttribute(cloud.route, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 30); // 흩어짐 반경까지 포함 → 잘림 방지
    return g;
  }, [cloud]);

  // geometry가 바뀌거나(cloud 교체) 컴포넌트가 사라질 때 GPU 버퍼를 반환한다(메모리 누수 방지)
  useEffect(() => () => geometry.dispose(), [geometry]);

  const uniforms = useMemo(() => ({
    uAssemble: { value: instant ? 1 : 0 }, // 첫 화면에서 0 → 1로 모이며 등장
    uMap: { value: 0 },
    uNoise: { value: 1 },
    uRemoved: { value: 0 },
    uDrop: { value: 0 },
    uTime: { value: 0 },
    uSize: { value: 3 },
    uDot: { value: new THREE.Color('#8FB8FF') },
    uAmber: { value: new THREE.Color('#FFB547') },
    uText: { value: new THREE.Color('#EEF3FF') },
  }), [instant]);

  useFrame((state, delta) => {
    const m = material.current;
    const t = target.current;
    if (!m || !t) return;
    const u = m.uniforms;
    const step = (key: string, goal: number) => {
      u[key].value = instant ? goal : THREE.MathUtils.damp(u[key].value, goal, DAMP, delta);
    };
    step('uAssemble', t.assemble);
    step('uMap', t.map);
    step('uNoise', showNoise ? t.noise : 0);
    step('uRemoved', t.removed);
    step('uDrop', t.drop);
    // 캡처 모드에서는 uTime을 0으로 고정한다. 매번 같은 시각에 찍어야 대체 이미지가 항상 똑같이 나온다
    u.uTime.value = instant ? 0 : state.clock.elapsedTime;
    u.uSize.value = 3 * state.viewport.dpr;
  });

  return (
    <points geometry={geometry} frustumCulled={false}>
      <shaderMaterial
        ref={material}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
