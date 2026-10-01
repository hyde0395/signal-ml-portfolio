'use client';
// 점 구름 하나(Points)와 셰이더 재질. 목표 장면 상태(target)로 uniform을 매 프레임 부드럽게 옮기고,
// 새 차트 배치(slots.pending)가 오면 두 벌(A/B) 중 지정된 쪽 버퍼에 써 넣는다.
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { AirportBuffers } from './airportAssign';
import { packMeta, type PointCloud } from './data';
import { toNdc } from './pointerField';
import { planePose, planeScatter } from './plane';
import { CHART_FOV, followActive, type SceneState } from './scenes';
import { buildField, FIELD, signalLayout, signalStage } from './signal';
import { fragmentShader, vertexShader } from './shaders';

export type ChartSlotWrite = { slot: 0 | 1; pos: Float32Array; style: Float32Array; hl: Float32Array };
// focusTone·focusDim: 강조 색·흐림 정도(차트마다 다르다, TerrainScene이 지금 차트 배치에서 넣는다)
export type ChartSlots = { pending: ChartSlotWrite | null; focus: number; focusTone: number; focusDim: number };

type Props = {
  cloud: PointCloud;
  target: React.RefObject<SceneState>;
  slots: React.RefObject<ChartSlots>;
  instant: boolean;
  showNoise: boolean;
  airport: AirportBuffers | null;
  planeStart: number; // 비행기 출발 자리(m, plane.ts planePose start) — 세로 화면은 PLANE.portraitStart
  portrait: boolean;  // 세로 화면 — 잡음 밭 점 수(signal.ts FIELD)
  bins: number[];     // U자 8구간(%) — data.ts bookingBins
};

const DAMP = 2.2; // 클수록 빨리 따라간다. 스펙의 expo.out 느낌(처음 빠르고 끝이 느림)에 가깝다
// 장면 상태의 카메라~목표점 거리. 카메라(CameraRig)도 같은 목표로 부드럽게 가므로 이 값도 부드럽게 따라가게 한다
const focusDist = (t: SceneState) =>
  Math.hypot(t.camera[0] - t.target[0], t.camera[1] - t.target[1], t.camera[2] - t.target[2]);

// planePose 결과를 매 프레임 새로 만들지 않고 이 자리에 쓴다(한 화면에 점 구름은 하나)
const poseScratch = planePose(0);

export function TerrainPoints({ cloud, target, slots, instant, showNoise, airport, planeStart, portrait, bins }: Props) {
  const material = useRef<THREE.ShaderMaterial>(null);

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    // position은 three가 경계 계산에 쓰므로 지형 좌표를 넣어 둔다(실제 위치는 셰이더가 정함)
    g.setAttribute('position', new THREE.BufferAttribute(cloud.terrain, 3));
    g.setAttribute('aTerrain', new THREE.BufferAttribute(cloud.terrain, 3));
    g.setAttribute('aMap', new THREE.BufferAttribute(cloud.map, 3));
    g.setAttribute('aScatter', new THREE.BufferAttribute(cloud.scatter, 3));
    // 차트 배치 두 벌: 처음엔 비어 있고(알파 0) TerrainScene이 차트 장면에 들어갈 때 채운다
    for (const name of ['aChartA', 'aChartB', 'aStyleA', 'aStyleB']) {
      g.setAttribute(name, new THREE.BufferAttribute(new Float32Array(cloud.count * 3), 3).setUsage(THREE.DynamicDrawUsage));
    }
    // 강조 번호: 두 슬롯이 같이 쓰는 한 벌(chartTargets.ts slotBuffers)
    g.setAttribute('aHl', new THREE.BufferAttribute(new Float32Array(cloud.count).fill(-1), 1).setUsage(THREE.DynamicDrawUsage));
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
    // 잡음 → 신호(계획 9-3): 공항 불빛·비행기 점이 모두 잡음 밭에 들도록 공항 배정 뒤에 정한다
    const f = portrait ? FIELD.portrait : FIELD.desktop;
    const field = buildField({ kind: cloud.kind, air: air.style, target: f.target, lineCount: f.line, seed: 11 });
    g.setAttribute('aMeta', new THREE.BufferAttribute(packMeta(cloud, field.role), 4));
    g.setAttribute('aField', new THREE.BufferAttribute(field.field, 3));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 30); // 흩어짐 반경까지 포함 → 잘림 방지
    return g;
  }, [cloud, airport, portrait]);

  // geometry가 바뀌거나(cloud 교체) 컴포넌트가 사라질 때 GPU 버퍼를 반환한다(메모리 누수 방지)
  useEffect(() => () => geometry.dispose(), [geometry]);

  // 포인터(계획 5-3a): 캔버스는 pointer-events: none이라 창 전체에서 듣는다(CameraRig와 같은 이유)
  const pointer = useRef({ x: 0, y: 0, on: 0, snap: false, rippleAt: -1, rx: 0, ry: 0 });
  useEffect(() => {
    if (instant) return;
    const p = pointer.current;
    // 고정 배경 캔버스(.backdrop)는 늘 보이는 스크롤바 폭을 빼고 그려진다 — innerWidth를 쓰면 밀기 중심이
    // 커서에서 최대 15px쯤 어긋나므로 스크롤바를 뺀 clientWidth·clientHeight로 NDC를 구한다
    const ndc = (x: number, y: number) =>
      toNdc(x, y, document.documentElement.clientWidth, document.documentElement.clientHeight);
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return; // 터치로 계속 밀면 스크롤을 방해한다 — 물결만(설계 §4.1)
      [p.x, p.y] = ndc(e.clientX, e.clientY);
      // 꺼져 있다가 다시 켜질 때(창에 다시 들어옴·탭이 다시 보임)는 그 자리에서 시작 — 옛 자리에서 미끄러져 오지 않게
      if (!p.on) p.snap = true;
      p.on = 1;
    };
    // 물결은 가볍게 누른 곳에서만: 스크롤도 pointerdown으로 시작해서, 누를 때마다 물결을 내면 스크롤할 때마다
    // 화면이 부산했다(검토 2026-09-29). 손가락별 시작 자리를 기억해 두고, 10px 안에서 떼면(취소 없이) 물결을 낸다
    const taps = new Map<number, [number, number]>();
    const onDown = (e: PointerEvent) => {
      if (e.pointerType === 'touch') taps.set(e.pointerId, [e.clientX, e.clientY]);
    };
    const onUp = (e: PointerEvent) => {
      const start = taps.get(e.pointerId);
      taps.delete(e.pointerId);
      if (!start || Math.hypot(e.clientX - start[0], e.clientY - start[1]) >= 10) return;
      [p.rx, p.ry] = ndc(start[0], start[1]);
      p.rippleAt = performance.now();
    };
    const onCancel = (e: PointerEvent) => { taps.delete(e.pointerId); };
    // 창 밖으로 나가면(relatedTarget 없음) 밀기를 끈다 — 창 가장자리에 멈춘 채 점이 계속 비켜 있지 않게
    const onOut = (e: MouseEvent) => { if (!e.relatedTarget) p.on = 0; };
    const onHide = () => { if (document.hidden) p.on = 0; };
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onDown, { passive: true });
    window.addEventListener('pointerup', onUp, { passive: true });
    window.addEventListener('pointercancel', onCancel, { passive: true });
    window.addEventListener('mouseout', onOut);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      window.removeEventListener('mouseout', onOut);
      document.removeEventListener('visibilitychange', onHide);
    };
  }, [instant]);

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
    uFocusTone: { value: 2 }, // 기본은 호박색(TONE.amber) — 첫 프레임에 와플 강조가 그대로 보이게
    uFocusDim: { value: 0.25 },
    uDpr: { value: 1 },
    uDot: { value: new THREE.Color('#8FB8FF') },
    uAmber: { value: new THREE.Color('#FFB547') },
    uValLo: { value: new THREE.Color('#5A8CFF') }, // charts/types.ts VAL_LO
    uText: { value: new THREE.Color('#EEF3FF') },
    // 초기값이 목표와 같아야 첫 프레임에 지형이 번쩍 보이지 않는다(공항 장면으로 시작하면 1)
    uAirport: { value: target.current?.airport ?? 0 },
    uLightT: { value: instant ? 99 : 0 },
    uWave: { value: -1e4 },
    uWarm: { value: new THREE.Color('#FFE2B8') },
    // 거리 흐림의 기준(카메라~장면 목표점 거리). 첫 프레임부터 맞는 값이어야 점이 번쩍이지 않는다
    uFocusDist: { value: target.current ? focusDist(target.current) : 20 },
    // 포인터 밀기·물결(계획 5-3a). 처음엔 꺼짐(uPointerOn 0), 물결 없음(음수)
    uPointer: { value: new THREE.Vector2(0, 0) },
    uPointerOn: { value: 0 },
    uAspect: { value: 1 },
    uRipple: { value: new THREE.Vector3(0, 0, -1) },
    // 잡음 밭(계획 9-3): 초기값이 목표와 같아야 ①에서 3D가 켜질 때 지형 덩어리가 번쩍 보이지 않는다
    uField: { value: target.current?.field ?? 0 },
    uSig: { value: signalStage(target.current?.plane ?? 0) },
    // 곡선 배치는 창 비율이 바뀔 때 useFrame이 채운다(아래 aspectSeen)
    uCurve: { value: Array.from({ length: 8 }, () => new THREE.Vector2()) },
    uArc: { value: new Array<number>(8).fill(0) },
    uHalf: { value: new THREE.Vector2(1, 1) },
    uPxY: { value: 0.002 },
    // 이륙 비행기(설계 2026-09-29 §7): 로컬 → 월드 행렬과 흩어짐 진행. 첫 프레임부터 목표 진행도의 자세로
    uPlane: { value: new THREE.Matrix4().fromArray(planePose(target.current?.plane ?? 1, planeStart).matrix) },
    uPlaneGo: { value: planeScatter(target.current?.plane ?? 1) },
  }), [instant, planeStart]);
  // 비행기 진행도(시안 눈금)도 다른 값과 같은 감쇠로 따라간다. 첫 화면 → ① 구간의 목표(t.plane)는 이미 TerrainScene의
  // 비행기 시계(최대 속도 PLANE.maxRate)라 빠른 휠에도 천천히 움직인다 — 카메라 고개(lookToward)도 같은 값으로 정해져
  // 둘이 같은 감쇠 지연만큼만 어긋난다
  const planeP = useRef(target.current?.plane ?? 1);
  // 마지막으로 곡선 배치를 계산한 화면 비율 — 바뀔 때만 다시 계산한다(매 프레임 JS 작업을 늘리지 않게)
  const aspectSeen = useRef(-1);
  // 새 uniform 묶음(캡처 전환 등)이나 새 구간 값이면 곡선 배치를 다시 넣는다
  useEffect(() => { aspectSeen.current = -1; }, [uniforms, bins]);

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
      const hl = geometry.getAttribute('aHl') as THREE.BufferAttribute;
      (hl.array as Float32Array).set(w.hl);
      hl.needsUpdate = true;
      slots.current!.pending = null;
    }
    const u = m.uniforms;
    // 전환 구간(follow, 빠른 휠 직후 잠깐 포함)에서는 목표(비행기 시계가 정한 전환 장면)를 바짝 따라가게 약 4배 빠르게 —
    // 느리면 시계가 멈춘 뒤에도 한참 흘러가고, 시계 값인 비행기 자세와 어긋난다
    const k = followActive(t, performance.now()) ? DAMP * 4 : DAMP;
    const step = (key: string, goal: number) => {
      u[key].value = instant ? goal : THREE.MathUtils.damp(u[key].value, goal, k, delta);
    };
    step('uAssemble', t.assemble);
    step('uMap', t.map);
    step('uNoise', showNoise ? t.noise : 0);
    step('uRemoved', t.removed);
    step('uDrop', t.drop);
    step('uDim', t.dim);
    // 차트가 전혀 안 보일 때(지형에서 막 들어오는 순간) 슬롯은 바로 맞춘다 — 천천히 옮기면 들어오는 동안
    // 옛 슬롯의 이전 차트 배치가 섞여 보인다. uChart를 움직이기 전 값으로 판정해야 첫 프레임을 놓치지 않는다
    if (u.uChart.value < 1e-3) u.uSlot.value = t.slot;
    else step('uSlot', t.slot);
    step('uChart', t.chart);
    step('uAirport', t.airport);
    step('uField', t.field);
    step('uFocusDist', focusDist(t));
    const pp = instant ? t.plane : THREE.MathUtils.damp(planeP.current, t.plane, k, delta);
    // 멈춰 있으면(대부분의 장면에서 1) 행렬을 다시 만들지 않는다. 캡처(instant)도 목표가 바뀔 때만 — 처음 값은
    // uniforms를 만들 때 목표 진행도로 이미 넣었다
    if (pp !== planeP.current) {
      planeP.current = pp;
      (u.uPlane.value as THREE.Matrix4).fromArray(planePose(pp, planeStart, poseScratch).matrix);
      u.uPlaneGo.value = planeScatter(pp);
      u.uSig.value = signalStage(pp);
    }
    // 이동량은 부드럽게 따라가지 않고 바로 넣는다 — 스크롤하는 이름표와 한 프레임도 어긋나지 않아야 한다
    u.uChartShift.value = t.shift;
    u.uFocus.value = slots.current?.focus ?? -1; // 강조는 부드럽게 옮기지 않는다 — 2D처럼 바로 바뀐다
    u.uFocusTone.value = slots.current?.focusTone ?? 2;
    u.uFocusDim.value = slots.current?.focusDim ?? 0.25;
    // 캡처 모드에서는 uTime을 0으로 고정한다. 매번 같은 시각에 찍어야 대체 이미지가 항상 똑같이 나온다
    u.uTime.value = instant ? 0 : state.clock.elapsedTime;
    u.uSize.value = 8 * state.viewport.dpr;
    u.uDpr.value = state.viewport.dpr;
    // 불 켜짐은 3D가 뜬 순간부터 센다(로딩 화면은 그 전에 끝난다). 캡처 모드는 다 켜진 상태로 고정
    u.uLightT.value = instant ? 99 : state.clock.elapsedTime;
    // 신호 물결: 3초 뒤부터 초당 700m로 활주로를 따라 달리고 5,800m마다 되풀이(시안과 같은 속도)
    const wt = state.clock.elapsedTime - 3;
    u.uWave.value = instant || wt < 0 ? -1e4 : (wt * 700) % 5800;
    // 포인터: 위치는 빠르게, 세기는 천천히 따라간다 — 점마다 상태가 없으므로 이 부드러움이 "비켰다가 제자리로"를 만든다
    const p = pointer.current;
    const aspect = state.size.width / Math.max(1, state.size.height);
    u.uAspect.value = aspect;
    if (aspect !== aspectSeen.current) {
      aspectSeen.current = aspect;
      const lay = signalLayout(aspect, bins);
      lay.pts.forEach((p, i) => (u.uCurve.value as THREE.Vector2[])[i].set(p[0], p[1]));
      u.uArc.value = lay.arc;
      const th = Math.tan((CHART_FOV * Math.PI) / 360);
      (u.uHalf.value as THREE.Vector2).set(th * aspect, th);
      u.uPxY.value = 2 / Math.max(1, state.size.height);
    }
    const pv = u.uPointer.value as THREE.Vector2;
    if (p.snap) {
      pv.set(p.x, p.y); // 막 다시 켜질 때는 그 자리에서 시작(화면을 가로질러 날아오지 않게)
      p.snap = false;
    }
    pv.x = THREE.MathUtils.damp(pv.x, p.x, 10, delta);
    pv.y = THREE.MathUtils.damp(pv.y, p.y, 10, delta);
    u.uPointerOn.value = instant ? 0 : THREE.MathUtils.damp(u.uPointerOn.value, p.on, 6, delta);
    const rv = u.uRipple.value as THREE.Vector3;
    rv.set(p.rx, p.ry, instant || p.rippleAt < 0 ? -1 : (performance.now() - p.rippleAt) / 1000);
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
