'use client';
// 점 구름 하나(Points)와 셰이더 재질. 목표 장면 상태(target)로 uniform을 매 프레임 부드럽게 옮기고,
// 새 차트 배치(slots.pending)가 오면 두 벌(A/B) 중 지정된 쪽 버퍼에 써 넣는다.
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { AirportBuffers } from './airportAssign';
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
  airport: AirportBuffers | null;
};

const DAMP = 2.2; // 클수록 빨리 따라간다. 스펙의 expo.out 느낌(처음 빠르고 끝이 느림)에 가깝다
// 장면 상태의 카메라~목표점 거리. 카메라(CameraRig)도 같은 목표로 부드럽게 가므로 이 값도 부드럽게 따라가게 한다
const focusDist = (t: SceneState) =>
  Math.hypot(t.camera[0] - t.target[0], t.camera[1] - t.target[1], t.camera[2] - t.target[2]);

export function TerrainPoints({ cloud, target, slots, instant, showNoise, airport }: Props) {
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
    // 공항 불빛(설계 2026-09-28 §4.5): 배정이 없으면(캡처 등) 모두 0 → 공항 장면에서 점이 안 보인다
    const air = airport ?? { pos: new Float32Array(cloud.count * 3), style: new Float32Array(cloud.count * 4), runS: new Float32Array(cloud.count).fill(-1) };
    // aAirport는 (xyz=자리, w=runS) vec4 하나로 합친다 — float 속성을 따로 두면 정점 속성이
    // WebGL 공통 한계(16개, position·normal·uv 포함)를 넘어 셰이더 링크가 실패한다
    const airportVec4 = new Float32Array(cloud.count * 4);
    for (let i = 0; i < cloud.count; i++) {
      airportVec4[i * 4] = air.pos[i * 3];
      airportVec4[i * 4 + 1] = air.pos[i * 3 + 1];
      airportVec4[i * 4 + 2] = air.pos[i * 3 + 2];
      airportVec4[i * 4 + 3] = air.runS[i];
    }
    g.setAttribute('aAirport', new THREE.BufferAttribute(airportVec4, 4));
    g.setAttribute('aAirStyle', new THREE.BufferAttribute(air.style, 4));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 30); // 흩어짐 반경까지 포함 → 잘림 방지
    return g;
  }, [cloud, airport]);

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
    // 초기값이 목표와 같아야 첫 프레임에 지형이 번쩍 보이지 않는다(공항 장면으로 시작하면 1)
    uAirport: { value: target.current?.airport ?? 0 },
    uLightT: { value: instant ? 99 : 0 },
    uWave: { value: -1e4 },
    uWarm: { value: new THREE.Color('#FFE2B8') },
    // 거리 흐림의 기준(카메라~장면 목표점 거리). 첫 프레임부터 맞는 값이어야 점이 번쩍이지 않는다
    uFocusDist: { value: target.current ? focusDist(target.current) : 20 },
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
    step('uAirport', t.airport);
    step('uFocusDist', focusDist(t));
    // 이동량은 부드럽게 따라가지 않고 바로 넣는다 — 스크롤하는 이름표와 한 프레임도 어긋나지 않아야 한다
    u.uChartShift.value = t.shift;
    u.uFocus.value = slots.current?.focus ?? -1; // 강조는 부드럽게 옮기지 않는다 — 2D처럼 바로 바뀐다
    // 캡처 모드에서는 uTime을 0으로 고정한다. 매번 같은 시각에 찍어야 대체 이미지가 항상 똑같이 나온다
    u.uTime.value = instant ? 0 : state.clock.elapsedTime;
    u.uSize.value = 8 * state.viewport.dpr;
    u.uDpr.value = state.viewport.dpr;
    // 불 켜짐은 3D가 뜬 순간부터 센다(로딩 화면은 그 전에 끝난다). 캡처 모드는 다 켜진 상태로 고정
    u.uLightT.value = instant ? 99 : state.clock.elapsedTime;
    // 신호 물결: 3초 뒤부터 초당 700m로 활주로를 따라 달리고 5,800m마다 되풀이(시안과 같은 속도)
    const wt = state.clock.elapsedTime - 3;
    u.uWave.value = instant || wt < 0 ? -1e4 : (wt * 700) % 5800;
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
        // 미리 곱한 알파 섞기 — 조각 셰이더가 점마다 보통 섞기/빛 더하기를 정한다(shaders.ts 끝 주석)
        blending={THREE.CustomBlending}
        blendSrc={THREE.OneFactor}
        blendDst={THREE.OneMinusSrcAlphaFactor}
        blendSrcAlpha={THREE.OneFactor}
        blendDstAlpha={THREE.OneMinusSrcAlphaFactor}
      />
    </points>
  );
}
