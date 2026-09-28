'use client';
// 밤의 공항(설계 2026-09-28 §4.1)에서 점 구름이 아닌 것: 활주로·유도로 바닥, 불빛이 바닥에 떨어진 웅덩이, 활주로 표시,
// 하늘의 별, 움직이는 불빛(착륙 비행기·진입등 섬광·유도로 비행기), 빨간 경고등 하나. 모두 첫 화면에서만 보이고
// ①로 넘어가며 사라진다(공항 장면 비율 airport를 TerrainPoints와 같은 속도로 따라간다).
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { buildAirport, landingPlane, runwayPoint, RUNWAY, taxiPlane, toWorld } from './airport';
import type { SceneState } from './scenes';

type Props = { target: React.RefObject<SceneState>; instant: boolean; portrait: boolean };

const DAMP = 2.2; // TerrainPoints와 같게 — 점과 곁가지가 함께 사라진다

// 둥근 빛 점 셰이더(곁가지 전용): 위치·색·크기(px)·알파를 받아 가산 합성으로 그린다
const glowVert = /* glsl */ `
  attribute vec3 color; attribute float size; attribute float alpha;
  uniform float uFade; uniform float uDpr; uniform float uTime;
  varying vec3 vColor; varying float vAlpha;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = size * uDpr;
    vColor = color;
    // 별(크기 ≤ 1.5px)만 천천히 반짝인다
    float tw = size <= 1.5 ? 0.7 + 0.3 * sin(uTime * 0.8 + position.x * 13.0) : 1.0;
    vAlpha = alpha * uFade * tw;
  }`;
const glowFrag = /* glsl */ `
  varying vec3 vColor; varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    gl_FragColor = vec4(vColor, vAlpha * exp(-d * d * 14.0));
  }`;

function glowMaterial() {
  return new THREE.ShaderMaterial({
    vertexShader: glowVert, fragmentShader: glowFrag, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uFade: { value: 1 }, uDpr: { value: 1 }, uTime: { value: 0 } },
  });
}

function glowGeometry(n: number) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('size', new THREE.BufferAttribute(new Float32Array(n), 1).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('alpha', new THREE.BufferAttribute(new Float32Array(n), 1).setUsage(THREE.DynamicDrawUsage));
  return g;
}

const C = { white: new THREE.Color('#EEF3FF'), warm: new THREE.Color('#FFE2B8'), blue: new THREE.Color('#8FB8FF'), amber: new THREE.Color('#FFB547'), red: new THREE.Color('#FF4A4A') };

export function AirportExtras({ target, instant, portrait }: Props) {
  const fade = useRef(target.current?.airport ?? 0);
  const air = useMemo(() => buildAirport({ stride: portrait ? 2 : 1 }), [portrait]);

  // 고정: 별 + 빛 웅덩이(계류장 조명·활주로 가장자리 아래 바닥)
  const statics = useMemo(() => {
    const pts: { p: [number, number, number]; c: THREE.Color; s: number; a: number }[] = [];
    let seed = 11; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < 90; i++) { // 별: 멀리(반경 150) 지평선 위 하늘에만
      const az = -1.1 + rnd() * 2.2, el = 0.03 + rnd() * 0.5, r = 150;
      pts.push({ p: [Math.sin(az) * r * Math.cos(el), Math.sin(el) * r, -Math.cos(az) * r * Math.cos(el)], c: C.white, s: 1 + rnd() * 0.5, a: 0.05 + rnd() * 0.2 });
    }
    for (const l of air.lights) {
      if (l.kind === 'apron') pts.push({ p: [l.pos[0], 0.002, l.pos[2]], c: C.amber, s: 120, a: 0.16 });
      else if (l.kind === 'edge') pts.push({ p: [l.pos[0], 0.002, l.pos[2]], c: C.white, s: 26, a: 0.07 });
      else if (l.kind === 'taxi') pts.push({ p: [l.pos[0], 0.002, l.pos[2]], c: C.blue, s: 18, a: 0.06 });
    }
    const g = glowGeometry(pts.length);
    pts.forEach((q, i) => {
      (g.attributes.position.array as Float32Array).set(q.p, i * 3);
      (g.attributes.color.array as Float32Array).set([q.c.r, q.c.g, q.c.b], i * 3);
      (g.attributes.size.array as Float32Array)[i] = q.s;
      (g.attributes.alpha.array as Float32Array)[i] = q.a;
    });
    return g;
  }, [air]);

  // 바닥: 활주로·평행 유도로 판(풀밭보다 아주 조금 밝게) + 활주로 표시(끝 줄무늬·착지 막대·중앙 점선)
  const ground = useMemo(() => {
    const quads: number[] = [];
    const quad = (s1: number, s2: number, o1: number, o2: number, y = 0) => {
      const a = runwayPoint(s1, o1), b = runwayPoint(s2, o1), c = runwayPoint(s2, o2), d = runwayPoint(s1, o2);
      const w = (p: [number, number]) => toWorld(p[0], y, p[1]);
      quads.push(...w(a), ...w(b), ...w(c), ...w(a), ...w(c), ...w(d));
    };
    const { length: RLEN, half: RH, taxiOffset: TO } = RUNWAY;
    const surface: number[] = [];
    quad(-30, RLEN + 30, -RH - 4, RH + 4); quad(-260, RLEN, TO - 13, TO + 13);
    surface.push(...quads.splice(0));
    for (const s of [RLEN - 40, 10]) for (let o = -26; o <= 26; o += 4.2) if (Math.abs(o) > 3) quad(s, s + 30, o - 1, o + 0.8, 0.05);
    for (const s of [150, 300, 450, RLEN - 480, RLEN - 330, RLEN - 180]) { quad(s, s + 22, -14, -9, 0.05); quad(s, s + 22, 9, 14, 0.05); }
    for (let s = 60; s < RLEN - 60; s += 50) quad(s, s + 30, -0.5, 0.5, 0.05);
    const geo = (arr: number[]) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3)); return g; };
    return { surface: geo(surface), marks: geo(quads) };
  }, []);
  const surfaceMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#0a0e18', transparent: true, depthWrite: false }), []);
  const markMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#c9d4ee', transparent: true, opacity: 0.08, depthWrite: false, blending: THREE.AdditiveBlending }), []);

  // 움직이는 것: 진입등 14 + 착륙 비행기 3(착륙등·양 날개) + 유도 비행기 3 + 경고등 1
  const movers = useMemo(() => glowGeometry(21), []);
  const staticMat = useMemo(glowMaterial, []);
  const moverMat = useMemo(glowMaterial, []);
  // 착륙등의 가는 가로 렌즈 플레어(설계 §4.1)
  const flare = useRef<THREE.Sprite>(null);
  const flareMat = useMemo(() => {
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 4;
    const g = cv.getContext('2d')!; const gr = g.createLinearGradient(0, 0, 256, 0);
    gr.addColorStop(0, 'rgba(238,243,255,0)'); gr.addColorStop(0.5, 'rgba(238,243,255,0.9)'); gr.addColorStop(1, 'rgba(238,243,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 256, 4);
    return new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: false });
  }, []);

  useFrame((state, delta) => {
    const goal = target.current?.airport ?? 0;
    fade.current = instant ? goal : THREE.MathUtils.damp(fade.current, goal, DAMP, delta);
    const f = fade.current, t = instant ? 6 : state.clock.elapsedTime, dpr = state.viewport.dpr;
    for (const m of [staticMat, moverMat]) { m.uniforms.uFade.value = f; m.uniforms.uDpr.value = dpr; m.uniforms.uTime.value = t; }
    surfaceMat.opacity = 0.9 * f; markMat.opacity = 0.08 * f; flareMat.opacity = f;
    const P = movers.attributes.position.array as Float32Array, Cc = movers.attributes.color.array as Float32Array;
    const S = movers.attributes.size.array as Float32Array, A = movers.attributes.alpha.array as Float32Array;
    const set = (i: number, p: [number, number, number] | null, c: THREE.Color, s: number, a: number) => {
      if (p) P.set(p, i * 3); Cc.set([c.r, c.g, c.b], i * 3); S[i] = s; A[i] = p ? a : 0;
    };
    // 진입등: 활주로 쪽으로 달리는 섬광 하나(초당 16칸, 22칸 주기)
    const step = Math.floor((t * 16) % 22);
    air.approach.forEach((p, i) => set(i, p, C.white, 13 - i === step ? 14 : 4, 13 - i === step ? 1 : 0.25));
    // 착륙 비행기(20초 주기) — 착륙등 + 양 날개 흰 불빛
    const lp = landingPlane(((t % 20) / 20));
    set(14, lp, C.white, 18, 0.95);
    const wing = (dx: number, dz: number): [number, number, number] | null => (lp ? [lp[0] + dx, lp[1] + 0.01, lp[2] + dz] : null);
    set(15, wing(0.14, -0.1), C.white, 4, 0.45);
    set(16, wing(-0.14, 0.1), C.white, 4, 0.45);
    if (flare.current) { flare.current.visible = !!lp; if (lp) flare.current.position.set(...lp); }
    // 유도로 비행기
    const tp = taxiPlane(t);
    set(17, tp, C.white, 8, 0.9); set(18, [tp[0] + 0.1, tp[1], tp[2]], C.white, 3, 0.5); set(19, [tp[0] - 0.1, tp[1], tp[2]], C.white, 3, 0.5);
    // 경고등: 1.6초마다 0.5초 켜짐 — 화면에서 유일한 빨강
    set(20, air.beacon, C.red, 7, (t % 1.6) < 0.5 ? 1 : 0.06);
    for (const k of ['position', 'color', 'size', 'alpha'] as const) movers.attributes[k].needsUpdate = true;
  });

  return (
    <group>
      <mesh geometry={ground.surface} material={surfaceMat} renderOrder={-2} />
      <mesh geometry={ground.marks} material={markMat} renderOrder={-1} />
      <points geometry={statics} material={staticMat} frustumCulled={false} />
      <points geometry={movers} material={moverMat} frustumCulled={false} />
      <sprite ref={flare} material={flareMat} scale={[0.22, 0.003, 1]} />
    </group>
  );
}
