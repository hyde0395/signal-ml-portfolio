'use client';
// 점 구름 하나(Points)와 셰이더 재질. 목표 장면 상태(target)로 uniform을 매 프레임 부드럽게 옮기고,
// 새 차트 배치(slots.pending)가 오면 두 벌(A/B) 중 지정된 쪽 버퍼에 써 넣는다.
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { PointCloud } from './data';
import type { SceneState } from './scenes';
import { fragmentShader, vertexShader } from './shaders';

export type ChartSlotWrite = { slot: 0 | 1; pos: Float32Array; style: Float32Array; waffle: Float32Array };
export type ChartSlots = { pending: ChartSlotWrite | null; focus: number };

type Props = {
  cloud: PointCloud;
  target: React.RefObject<SceneState>;
  slots: React.RefObject<ChartSlots>;
  instant: boolean;
  showNoise: boolean;
};

const DAMP = 2.2; // 클수록 빨리 따라간다. 스펙의 expo.out 느낌(처음 빠르고 끝이 느림)에 가깝다

export function TerrainPoints({ cloud, target, slots, instant, showNoise }: Props) {
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
    // 차트 배치 두 벌: 처음엔 비어 있고(알파 0) TerrainScene이 차트 장면에 들어갈 때 채운다
    for (const name of ['aChartA', 'aChartB', 'aStyleA', 'aStyleB']) {
      g.setAttribute(name, new THREE.BufferAttribute(new Float32Array(cloud.count * 3), 3).setUsage(THREE.DynamicDrawUsage));
    }
    // 와플 그룹 번호: 두 슬롯이 같이 쓰는 한 벌(chartTargets.ts slotBuffers)
    g.setAttribute('aWaffle', new THREE.BufferAttribute(new Float32Array(cloud.count).fill(-1), 1).setUsage(THREE.DynamicDrawUsage));
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
    uSize: { value: 8 }, // 점이 너무 작아 지형이 안 보이던 문제 수정(3 → 8, shaders.ts 거리 감쇠 상수와 함께 조정)
    uDim: { value: 1 },
    uChart: { value: 0 },
    uSlot: { value: 0 },
    uChartShift: { value: 0 },
    uFocus: { value: -1 },
    uDpr: { value: 1 },
    uDot: { value: new THREE.Color('#8FB8FF') },
    uAmber: { value: new THREE.Color('#FFB547') },
    uText: { value: new THREE.Color('#EEF3FF') },
  }), [instant]);

  useFrame((state, delta) => {
    const m = material.current;
    const t = target.current;
    if (!m || !t) return;
    const w = slots.current?.pending;
    if (w) {
      const pos = geometry.getAttribute(w.slot === 0 ? 'aChartA' : 'aChartB') as THREE.BufferAttribute;
      const style = geometry.getAttribute(w.slot === 0 ? 'aStyleA' : 'aStyleB') as THREE.BufferAttribute;
      (pos.array as Float32Array).set(w.pos);
      (style.array as Float32Array).set(w.style);
      pos.needsUpdate = true;
      style.needsUpdate = true;
      const waffle = geometry.getAttribute('aWaffle') as THREE.BufferAttribute;
      (waffle.array as Float32Array).set(w.waffle);
      waffle.needsUpdate = true;
      slots.current!.pending = null;
    }
    const u = m.uniforms;
    const step = (key: string, goal: number) => {
      u[key].value = instant ? goal : THREE.MathUtils.damp(u[key].value, goal, DAMP, delta);
    };
    step('uAssemble', t.assemble);
    step('uMap', t.map);
    step('uNoise', showNoise ? t.noise : 0);
    step('uRemoved', t.removed);
    step('uDrop', t.drop);
    step('uDim', t.dim);
    step('uChart', t.chart);
    step('uSlot', t.slot);
    // 이동량은 부드럽게 따라가지 않고 바로 넣는다 — 스크롤하는 이름표와 한 프레임도 어긋나지 않아야 한다
    u.uChartShift.value = t.shift;
    u.uFocus.value = slots.current?.focus ?? -1; // 강조는 부드럽게 옮기지 않는다 — 2D처럼 바로 바뀐다
    // 캡처 모드에서는 uTime을 0으로 고정한다. 매번 같은 시각에 찍어야 대체 이미지가 항상 똑같이 나온다
    u.uTime.value = instant ? 0 : state.clock.elapsedTime;
    u.uSize.value = 8 * state.viewport.dpr;
    u.uDpr.value = state.viewport.dpr;
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
