'use client';
// 밤의 공항(설계 2026-09-28 §4.1)에서 점 구름이 아닌 것: 활주로·유도로 바닥, 불빛이 바닥에 떨어진 웅덩이, 활주로 표시,
// 하늘의 별, 움직이는 불빛(착륙 비행기·진입등 섬광·유도로 비행기), 빨간 경고등 하나, 젖은 노면 반사, 계류장 기둥선
// (설계 2026-09-29 §8). 모두 첫 화면에서만 보이고
// ①로 넘어가며 사라진다(공항 장면 비율 airport를 TerrainPoints와 같은 속도로 따라간다).
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { buildAirport, landingPlane, runwayPoint, RUNWAY, taxiPlane, toWorld, type AirKind } from './airport';
import { followActive, type SceneState } from './scenes';

// takeoff: 점 비행기가 같은 활주로에서 이륙하는 중(설계 2026-09-29 §7) — 착륙 비행기를 끈다(두 비행기가 겹쳐 헷갈림, 시안 A)
type Props = { target: React.RefObject<SceneState>; instant: boolean; portrait: boolean; takeoff: boolean };

const DAMP = 2.2; // TerrainPoints와 같게 — 점과 곁가지가 함께 사라진다
// useFrame마다 새로 만들지 않게 미리 둔다(리뷰 2026-09-28): movers 속성 갱신 키 목록,
// set()이 색을 채울 때 쓰는 임시 버퍼(매 호출마다 배열을 새로 만들지 않고 재사용한다)
const ATTR_KEYS = ['position', 'color', 'size', 'alpha'] as const;
const colorScratch = new Float32Array(3);

// GLSL 문자열 안에는 주석을 두지 않는다(shaders.ts 머리 주석과 같은 이유 — 3D 청크에 그대로 실린다). 설명은 여기에:
//
// srgb: 선형 → sRGB(shaders.ts toSrgbTone과 같은 식). THREE.Color('#…')는 선형 값으로 바뀌어 들어오는데
//   ShaderMaterial 출력은 sRGB로 되돌려지지 않아 곁가지 색이 시안보다 짙게 가라앉았다(설계 2026-09-29 §8)
//
// glowVert / glowFrag — 둥근 빛 점(별·움직이는 불빛): 위치·색·크기(px)·알파를 받아 빛 더하기로 그린다.
// 별(크기 ≤ 1.5px)만 천천히 반짝인다
const glowVert = /* glsl */ `
  attribute vec3 color; attribute float size; attribute float alpha;
  uniform float uFade; uniform float uDpr; uniform float uTime;
  varying vec3 vColor; varying float vAlpha;
  vec3 srgb(vec3 c) { c = max(c, vec3(0.0)); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c)); }
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = size * uDpr;
    vColor = srgb(color);
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

// poolVert / poolFrag — 바닥 빛 웅덩이(설계 2026-09-29 §8, 시안 pool): 불빛마다 화면을 향한 사각형 하나(꼭짓점 4개가
// 같은 중심 position을 갖고 aCorner로 모서리를 가린다). 점(gl_PointSize)으로 그리면 GPU 점 크기 한계(이 맥 511px)에
// 걸려 가까운 계류장 웅덩이(DPR 2에서 지름 1,000px 넘음)가 잘려 작아졌다.
// - 반지름 px = 바닥 반지름(aPool.x, m → 월드 ×0.01) × 투영 배율 × 화면 높이/2 ÷ 거리, 시안처럼 2~420 CSS px로 자른다
// - 납작함 = clamp(카메라 높이/거리·1.3, 0.04, 0.9)(시안 그대로) — 세로 반지름에만 곱해 땅에 누운 타원
// - 모양은 시안 soft 곡선(0 → 1, 0.5 → 0.35, 1 → 0), 알파 aPool.y
const poolVert = /* glsl */ `
  attribute vec3 color; attribute vec2 aCorner; attribute vec2 aPool;
  uniform float uFade; uniform float uDpr; uniform vec2 uView;
  varying vec3 vColor; varying float vAlpha; varying vec2 vQ;
  vec3 srgb(vec3 c) { c = max(c, vec3(0.0)); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c)); }
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    float dz = max(-mv.z, 0.01);
    float r = clamp(aPool.x * 0.01 * projectionMatrix[1][1] * 0.5 * uView.y / dz, 2.0 * uDpr, 420.0 * uDpr);
    float fl = clamp(cameraPosition.y / dz * 1.3, 0.04, 0.9);
    gl_Position.xy += aCorner * vec2(r, r * fl) * 2.0 / uView * gl_Position.w;
    vQ = aCorner;
    vColor = srgb(color);
    vAlpha = aPool.y * uFade;
  }`;
const poolFrag = /* glsl */ `
  varying vec3 vColor; varying float vAlpha; varying vec2 vQ;
  void main() {
    float r = length(vQ);
    if (r > 1.0) discard;
    float g = r < 0.5 ? mix(1.0, 0.35, r / 0.5) : mix(0.35, 0.0, (r - 0.5) / 0.5);
    gl_FragColor = vec4(vColor, vAlpha * g);
  }`;

// markVert / markFrag — 활주로 표시(끝 줄무늬·착지 막대·중앙 점선): 시안처럼 불빛에 비친 만큼만, 멀수록 흐리게
// (알파 = min(0.22/(1 + 거리/700m), 0.2)). 예전엔 거리와 상관없이 0.08이라 가까운 표시가 시안보다 훨씬 흐렸다
const markVert = /* glsl */ `
  uniform float uFade;
  varying float vAlpha;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    vAlpha = min(0.22 / (1.0 + -mv.z / 7.0), 0.2) * uFade;
  }`;
const markFrag = /* glsl */ `
  uniform vec3 uColor;
  varying float vAlpha;
  void main() { gl_FragColor = vec4(uColor, vAlpha); }`;

// reflVert / reflFrag — 젖은 노면 반사(설계 2026-09-29 §8, 시안 O.wet): 바닥 불빛 아래로 늘어진 세로 빛줄기.
// 시안: hr = 핵 반지름·7, 폭 hr·0.6, 높이 hr·3.2, 불빛 1px 아래에서 시작, 알파 = 그 불빛 알파·0.1, soft 곡선.
// - 핵 반지름은 점 셰이더 corePx와 같은 식(clamp(5.5·크기/거리, 0.6, 2.6)·DPR)
// - 스프라이트 지름 = 줄기 높이, 가로는 폭/높이(0.6/3.2)로 좁힌 타원만 칠한다. 중심을 (1px + 높이/2)만큼 아래로
//   옮긴다(클립 좌표 y에 w를 곱해 더하면 화면에서 정확히 그 px만큼)
// - 알파는 불빛과 같은 규칙: 켜지는 순서(uLightT, aMeta.x = ord), 공기 원근 1/(1+거리/52), 신호 물결(aMeta.y = 활주로
//   거리, 없으면 −1), 중앙등 ×0.7은 alpha 속성에 미리 곱해 둔다
const reflVert = /* glsl */ `
  attribute vec3 color; attribute float size; attribute float alpha; attribute vec2 aMeta;
  uniform float uFade; uniform float uDpr; uniform float uVh; uniform float uLightT; uniform float uWave;
  varying vec3 vColor; varying float vAlpha;
  vec3 srgb(vec3 c) { c = max(c, vec3(0.0)); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c)); }
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    float dz = max(-mv.z, 0.01);
    float h = clamp(5.5 * size / dz, 0.6, 2.6) * uDpr * 7.0 * 3.2;
    gl_PointSize = h;
    gl_Position.y -= (uDpr + h * 0.5) * 2.0 / uVh * gl_Position.w;
    float on = clamp((uLightT - aMeta.x * 1.2) / 0.18, 0.0, 1.0);
    float wave = aMeta.y < 0.0 ? 0.0 : exp(-pow((aMeta.y - uWave) / 90.0, 2.0));
    vAlpha = alpha * uFade * 0.1 * on * (1.0 + wave * 2.2) / (1.0 + dz / 52.0);
    vColor = srgb(color);
  }`;
const reflFrag = /* glsl */ `
  varying vec3 vColor; varying float vAlpha;
  void main() {
    vec2 q = gl_PointCoord - 0.5;
    float r = length(vec2(q.x / (0.6 / 3.2), q.y)) * 2.0;
    if (r > 1.0) discard;
    float g = r < 0.5 ? mix(1.0, 0.35, r / 0.5) : mix(0.35, 0.0, (r - 0.5) / 0.5);
    gl_FragColor = vec4(vColor, vAlpha * g);
  }`;

// 반사가 생기는 바닥 불빛(시안: 높이 1m 미만, 도시 제외 — 계류장·창문은 높이 떠 있어 빠진다)
const WET: readonly AirKind[] = ['edge', 'center', 'thr', 'end', 'taxi'];
// 바닥 빛 웅덩이(시안 pool): 종류별 반지름(m)·알파. 중앙등은 웅덩이가 없다
const POOL: Partial<Record<AirKind, { r: number; a: number }>> = {
  apron: { r: 60, a: 0.13 }, edge: { r: 22, a: 0.09 }, taxi: { r: 14, a: 0.07 }, thr: { r: 10, a: 0.05 }, end: { r: 10, a: 0.05 },
};

function glowGeometry(n: number) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('size', new THREE.BufferAttribute(new Float32Array(n), 1).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('alpha', new THREE.BufferAttribute(new Float32Array(n), 1).setUsage(THREE.DynamicDrawUsage));
  return g;
}

const C = { white: new THREE.Color('#EEF3FF'), warm: new THREE.Color('#FFE2B8'), blue: new THREE.Color('#8FB8FF'), amber: new THREE.Color('#FFB547'), red: new THREE.Color('#FF4A4A') };
// 공항 색 번호(airport.ts AIR_TONE: 1 파랑, 2 호박, 3 흰색, 4 따뜻한 흰색) → 색
const TONE_COLOR = [C.white, C.blue, C.amber, C.white, C.warm];

export function AirportExtras({ target, instant, portrait, takeoff }: Props) {
  const fade = useRef(target.current?.airport ?? 0);
  const root = useRef<THREE.Group>(null);
  const air = useMemo(() => buildAirport({ stride: portrait ? 2 : 1 }), [portrait]);

  // 고정: 별
  const statics = useMemo(() => {
    const pts: { p: [number, number, number]; c: THREE.Color; s: number; a: number }[] = [];
    let seed = 11; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < 90; i++) { // 별: 멀리(반경 150) 지평선 위 하늘에만
      const az = -1.1 + rnd() * 2.2, el = 0.03 + rnd() * 0.5, r = 150;
      pts.push({ p: [Math.sin(az) * r * Math.cos(el), Math.sin(el) * r, -Math.cos(az) * r * Math.cos(el)], c: C.white, s: 1 + rnd() * 0.5, a: 0.05 + rnd() * 0.2 });
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

  // 빛 웅덩이: 계류장 조명·활주로 가장자리·유도로·시작·끝 줄 아래 바닥(사각형 하나 = 꼭짓점 4개·삼각형 2개)
  const pools = useMemo(() => {
    const ls = air.lights.filter((l) => POOL[l.kind]);
    const n = ls.length, pos = new Float32Array(n * 12), col = new Float32Array(n * 12), corner = new Float32Array(n * 8), pool = new Float32Array(n * 8);
    const idx: number[] = [];
    const CORNERS = [-1, -1, 1, -1, 1, 1, -1, 1];
    ls.forEach((l, i) => {
      const c = TONE_COLOR[l.tone], P = POOL[l.kind]!;
      for (let k = 0; k < 4; k++) {
        pos.set([l.pos[0], 0.002, l.pos[2]], (i * 4 + k) * 3);
        col.set([c.r, c.g, c.b], (i * 4 + k) * 3);
        corner.set([CORNERS[k * 2], CORNERS[k * 2 + 1]], (i * 4 + k) * 2);
        pool.set([P.r, P.a], (i * 4 + k) * 2);
      }
      idx.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3);
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('aCorner', new THREE.BufferAttribute(corner, 2));
    g.setAttribute('aPool', new THREE.BufferAttribute(pool, 2));
    g.setIndex(idx);
    return g;
  }, [air]);
  const poolMat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: poolVert, fragmentShader: poolFrag, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uFade: { value: 1 }, uDpr: { value: 1 }, uView: { value: new THREE.Vector2(1440, 900) } },
  }), []);

  // 젖은 노면 반사: 바닥 불빛마다 세로 빛줄기 하나(속성은 glowGeometry + aMeta(켜지는 순서, 활주로 거리))
  const refl = useMemo(() => {
    const ls = air.lights.filter((l) => WET.includes(l.kind));
    const g = glowGeometry(ls.length);
    const meta = new Float32Array(ls.length * 2);
    ls.forEach((l, i) => {
      (g.attributes.position.array as Float32Array).set(l.pos, i * 3);
      const c = TONE_COLOR[l.tone];
      (g.attributes.color.array as Float32Array).set([c.r, c.g, c.b], i * 3);
      (g.attributes.size.array as Float32Array)[i] = l.size;
      (g.attributes.alpha.array as Float32Array)[i] = l.kind === 'center' ? 0.7 : 1; // 중앙등 ×0.7(불빛과 같게)
      meta.set([l.ord, l.runS], i * 2);
    });
    g.setAttribute('aMeta', new THREE.BufferAttribute(meta, 2));
    return g;
  }, [air]);
  const reflMat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: reflVert, fragmentShader: reflFrag, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uFade: { value: 1 }, uDpr: { value: 1 }, uVh: { value: 900 }, uLightT: { value: 0 }, uWave: { value: -1e4 } },
  }), []);

  // 계류장 기둥선(시안): 높이 26m 조명에서 바닥까지 가는 호박색 선. 시안은 1 CSS px 선이라 기기 px 1줄인
  // WebGL 선은 DPR만큼 알파를 올려 같은 밝기로 보이게 한다(useFrame)
  const poles = useMemo(() => {
    const v: number[] = [];
    for (const l of air.lights) if (l.kind === 'apron') v.push(l.pos[0], l.pos[1] - 0.02, l.pos[2], l.pos[0], 0, l.pos[2]);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    return g;
  }, [air]);
  const poleMat = useMemo(() => new THREE.LineBasicMaterial({ color: '#FFB547', transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending }), []);

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
  // 양면: 사이트 좌표는 z를 뒤집어(airport.ts toWorld) 사각형 감김 방향이 거울처럼 바뀐다 — 앞면만 그리면 위에서 본
  // 바닥·표시가 뒷면으로 잘려 활주로 판과 표시가 통째로 안 보였다(2026-09-29 시안 비교에서 발견)
  const surfaceMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#0a0e18', transparent: true, depthWrite: false, side: THREE.DoubleSide }), []);
  // 색은 sRGB 그대로 넣는다(ShaderMaterial 출력은 변환되지 않으므로 선형으로 바꾸지 않은 값이 곧 화면 색)
  const markMat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: markVert, fragmentShader: markFrag, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uFade: { value: 1 }, uColor: { value: new THREE.Vector3(0xc9 / 255, 0xd4 / 255, 0xee / 255) } },
  }), []);

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

  // GPU 자원 정리: portrait가 바뀌어(휴대폰 회전 등) 의존 memo가 새로 만들어지거나 컴포넌트가
  // 사라질 때 옛 geometry·material·텍스처가 GPU에 남지 않게 각각의 memo와 같은 키로 지운다
  useEffect(() => () => statics.dispose(), [statics]);
  useEffect(() => () => refl.dispose(), [refl]);
  useEffect(() => () => pools.dispose(), [pools]);
  useEffect(() => () => poolMat.dispose(), [poolMat]);
  useEffect(() => () => reflMat.dispose(), [reflMat]);
  useEffect(() => () => poles.dispose(), [poles]);
  useEffect(() => () => poleMat.dispose(), [poleMat]);
  useEffect(() => () => { ground.surface.dispose(); ground.marks.dispose(); }, [ground]);
  useEffect(() => () => surfaceMat.dispose(), [surfaceMat]);
  useEffect(() => () => markMat.dispose(), [markMat]);
  useEffect(() => () => movers.dispose(), [movers]);
  useEffect(() => () => staticMat.dispose(), [staticMat]);
  useEffect(() => () => moverMat.dispose(), [moverMat]);
  useEffect(() => () => { flareMat.map?.dispose(); flareMat.dispose(); }, [flareMat]);

  // useFrame마다 새 배열을 만들지 않도록 재질 목록을 한 번만 묶어 둔다
  const glowMats = useMemo(() => [staticMat, moverMat], [staticMat, moverMat]);

  useFrame((state, delta) => {
    const goal = target.current?.airport ?? 0;
    // 전환 구간(follow, 빠른 휠 직후 잠깐 포함)에서는 점과 같은 규칙으로 4배 빠르게 — 곁가지만 늦게 사라지면 점과 따로 논다
    const k = followActive(target.current, performance.now()) ? DAMP * 4 : DAMP;
    fade.current = instant ? goal : THREE.MathUtils.damp(fade.current, goal, k, delta);
    const f = fade.current, t = instant ? 6 : state.clock.elapsedTime, dpr = state.viewport.dpr;
    // 히어로를 벗어나 fade가 거의 0이면 그룹을 통째로 안 그린다 — 알파만 0으로 두면 GPU는 여전히
    // 픽셀마다 래스터화를 시도한다(점 구름의 "숨은 점" 최적화와 같은 이유, shaders.ts 주석 참고)
    if (root.current) root.current.visible = f > 0.002;
    const vh = state.size.height * dpr; // 기기 px 화면 높이(웅덩이·반사 크기 계산)
    for (const m of glowMats) { m.uniforms.uFade.value = f; m.uniforms.uDpr.value = dpr; m.uniforms.uTime.value = t; }
    poolMat.uniforms.uFade.value = f; poolMat.uniforms.uDpr.value = dpr;
    (poolMat.uniforms.uView.value as THREE.Vector2).set(state.size.width * dpr, vh);
    // 반사는 불빛과 같은 켜짐 시각·신호 물결(TerrainPoints의 uLightT·uWave와 같은 식)
    const ru = reflMat.uniforms, wt = state.clock.elapsedTime - 3;
    ru.uFade.value = f; ru.uDpr.value = dpr; ru.uVh.value = vh;
    ru.uLightT.value = instant ? 99 : state.clock.elapsedTime;
    ru.uWave.value = instant || wt < 0 ? -1e4 : (wt * 700) % 5800;
    poleMat.opacity = 0.16 * Math.min(dpr, 2) * f;
    surfaceMat.opacity = 0.9 * f; markMat.uniforms.uFade.value = f; flareMat.opacity = f;
    const P = movers.attributes.position.array as Float32Array, Cc = movers.attributes.color.array as Float32Array;
    const S = movers.attributes.size.array as Float32Array, A = movers.attributes.alpha.array as Float32Array;
    const set = (i: number, p: [number, number, number] | null, c: THREE.Color, s: number, a: number) => {
      if (p) P.set(p, i * 3);
      colorScratch[0] = c.r; colorScratch[1] = c.g; colorScratch[2] = c.b;
      Cc.set(colorScratch, i * 3);
      S[i] = s; A[i] = p ? a : 0;
    };
    // 진입등: 활주로 쪽으로 달리는 섬광 하나(초당 16칸, 22칸 주기)
    const step = Math.floor((t * 16) % 22);
    air.approach.forEach((p, i) => set(i, p, C.white, 13 - i === step ? 14 : 4, 13 - i === step ? 1 : 0.25));
    // 착륙 비행기(20초 주기) — 착륙등 + 양 날개 흰 불빛
    const lp = takeoff ? null : landingPlane(((t % 20) / 20));
    set(14, lp, C.white, 18, 0.95);
    const wing = (dx: number, dz: number): [number, number, number] | null => (lp ? [lp[0] + dx, lp[1] + 0.01, lp[2] + dz] : null);
    set(15, wing(0.14, -0.1), C.white, 4, 0.45);
    set(16, wing(-0.14, 0.1), C.white, 4, 0.45);
    if (flare.current) { flare.current.visible = !!lp; if (lp) flare.current.position.set(...lp); }
    // 유도로 비행기
    const tp = taxiPlane(t);
    set(17, tp, C.white, 8, 0.9); set(18, [tp[0] + 0.1, tp[1], tp[2]], C.white, 3, 0.5); set(19, [tp[0] - 0.1, tp[1], tp[2]], C.white, 3, 0.5);
    // 경고등: 1.6초마다 0.5초 켜짐 — 화면에서 유일한 빨강. 캡처(대체 이미지)에서는 깜빡임 중 꺼진
    // 순간이 찍히지 않게 늘 켜진 것으로 고정한다(리뷰 2026-09-28)
    set(20, air.beacon, C.red, 7, instant ? 1 : (t % 1.6) < 0.5 ? 1 : 0.06);
    for (const k of ATTR_KEYS) movers.attributes[k].needsUpdate = true;
  });

  return (
    <group ref={root}>
      <mesh geometry={ground.surface} material={surfaceMat} renderOrder={-2} />
      <mesh geometry={ground.marks} material={markMat} renderOrder={-1} />
      <mesh geometry={pools} material={poolMat} frustumCulled={false} />
      <points geometry={refl} material={reflMat} frustumCulled={false} />
      <lineSegments geometry={poles} material={poleMat} />
      <points geometry={statics} material={staticMat} frustumCulled={false} />
      <points geometry={movers} material={moverMat} frustumCulled={false} />
      <sprite ref={flare} material={flareMat} scale={[0.22, 0.003, 1]} />
    </group>
  );
}
