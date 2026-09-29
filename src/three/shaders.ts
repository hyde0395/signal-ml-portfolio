// 점 셰이더: 점마다 흩어짐·지형·지도 세 목표 좌표와, 차트 배치 두 벌(A/B)의 좌표·모양을 받아 uniform 비율로 섞는다.
// 모든 움직임을 GPU에서 계산하므로 2만8천 개 점도 매 프레임 JS 작업 없이 움직인다.
// 차트 배치는 두 벌을 두고 번갈아 쓴다(uSlot) — 차트에서 차트로 넘어갈 때 점이 지형을 거치지 않고 바로 옮겨 간다.
import { PUSH, RIPPLE } from './pointerField';
import { AIR_SIZE } from './airport';
import { PLANE } from './plane';
import { DEPTH_FADE, MAP_POINT, POINT, SOFT_POINT, glslFloat as f } from './pointStyle';

// 아래 두 GLSL 문자열 안에는 // 주석을 두지 않는다 — 문자열이라 빌드 때 안 지워지고 그대로 gzip에 실려
// 3D 청크를 불필요하게 키운다(2026-09-29 최종 점검, 약 4KB 절감). 원래 줄 옆에 있던 설명을 여기로 옮긴다.

// vertexShader 정점 속성·유니폼(이름 옆에 있던 설명):
// - aMeta: x = 종류(0 신호, 1 잡음, 2 제거), y = 공휴일 ±3일이면 1, z = 지도 노선(1 노선, 0 해안선, −1 지도에 안 씀),
//   w = ① 물결 줄에서 호박색 줄이면 1. float 속성 넷을 vec4 하나로 묶었다 — aWave를 더하면 정점 속성이
//   16개(WebGL 공통 한계)를 넘어 셰이더 링크가 실패한다(계획 6-5). main() 첫 줄에서 옛 이름(aKind 등)으로 풀어 쓴다
// - aWave: ① 물결 줄 자리(data.ts buildWave)
// - uRows: 0 = 지형 자리, 1 = 물결 줄 자리(장면 값 rows)
// - uSoft: 지형 점 크기·알파를 SOFT_POINT 배율로 줄이는 정도(장면 값 soft)
// - aChartA: 차트 배치 A의 목표 좌표(z=0 평면)
// - aStyleA: 차트 배치 A에서의 (알파, 색 번호, 지름 px). 알파 0 = 이 차트에 안 쓰는 점
// - aHl: 강조 번호(설계 2026-09-28 §3, 계획 5-3b로 일반화 — ③ 와플 그룹, ④ 차트 1·4 출발일, 차트 2 구간), 아니면 -1
// - aAirport: xyz = 공항 불빛 자리, w = 활주로 위 거리(m, 신호 물결. 아니면 -1) — 지형용 float 속성 하나(aRunS)를
//   따로 두면 정점 속성이 16개(WebGL 공통 한계, position·normal·uv 3개 포함)를 넘어 셰이더 링크가 실패한다
// - aAirStyle: (공항 불빛이면 1 · 이륙 비행기 점이면 2, 색 번호, 크기 배율, 켜지는 순서 — 비행기 점은 흩어짐 지연).
//   비행기 점(설계 2026-09-29 §7)은 aAirport.xyz에 비행기 로컬 좌표(plane.ts planeShape)를 담는다 — 새 속성 없이
//   기존 두 속성을 재사용한다(정점 속성 16개 한계, 지금 13개)
// - uPlane: 비행기 로컬 → 월드 행렬(plane.ts planePose, TerrainPoints가 매 프레임). uPlaneGo: 흩어짐 진행(planeScatter)
// - uChart: 0 = 지형·지도, 1 = 차트 배치
// - uSlot: 0 = A, 1 = B
// - uChartShift: 차트 배치의 세계 y 이동(판이 고정되기 전·풀린 뒤 이름표를 따라가게)
// - uFocus: 강조할 번호(aHl과 비교), 없으면 -1
// - uFocusTone: 강조됐을 때 칠할 색 번호(차트마다 다르다, charts/types.ts ChartLayout.focusTone)
// - uFocusDim: 강조 중일 때 강조 안 된 점의 알파 배율(charts/types.ts ChartLayout.focusDim)
// - uAirport: 1 = 공항 장면, 0 = 지형·지도·차트
// - uLightT: 불이 켜지기 시작한 뒤 흐른 초(앞에서 뒤로 차례로 켜짐)
// - uWave: 신호 물결의 지금 위치(활주로 거리 m)
// - uWarm: 따뜻한 흰색(공항 전용)
// - uFocusDist: 카메라~장면 목표점 거리(거리 흐림 기준, TerrainPoints가 넣는다)
// - uPointer: 포인터 위치(NDC). TerrainPoints가 부드럽게 따라가게 넣는다 — 점마다 상태가 없어서, 포인터가 움직이면
//   밀린 자리가 함께 옮겨 가며 지나간 자리의 점이 제자리로 돌아온다
// - uPointerOn: 밀기 세기 0..1. 마우스가 창 안에서 움직이면 1, 창을 나가거나 터치·캡처면 0(부드럽게)
// - uAspect: 화면 가로/세로 — 밀기 영역을 원으로 만든다(pointerField.ts의 "정사각 화면 단위")
// - uRipple: 휴대폰 물결 (x, y = 누른 곳 NDC, z = 누른 뒤 흐른 초, 없으면 음수)
// - vAir: 이 점이 지금 공항 불빛으로 그려지는 정도(조각 셰이더가 모양을 바꾼다)
//
// toneColor: 색 번호 1 점 파랑, 2 호박, 3 글자색(src/charts/types.ts TONE과 같은 순서)
// airTone: 공항 색 번호(airport.ts AIR_TONE) 1 파랑, 2 호박, 3 흰색, 4 따뜻한 흰색
// toSrgbTone: 선형 → sRGB(정확한 sRGB 전달 함수). three는 THREE.Color('#…') uniform을 선형 값으로 바꿔 넣는데,
//   우리 ShaderMaterial 출력은 sRGB로 되돌려지지 않아 점이 디자인 토큰(sRGB)보다 어둡게(짙은 파랑·주황) 찍혔다
//   — 빛 더하기 시절엔 겹쳐 쌓이며 가려졌지만 보통 섞기에선 그대로 보인다. 2D 대체 그림(draw2d.ts)도 sRGB 토큰을 쓴다.
//   three 내장(sRGBTransferOETF 등)과 이름이 겹치지 않게 따로 이름을 붙였다. pow의 밑이 음수면 정의되지 않아 0으로 자른다
//
// main() 안 로직(위에서 아래 순서):
// - gather: 잡음은 신호보다 덜 모인다 → "잡음 속에서 신호가 떠오르는" 느낌
// - p += (...): 덜 모인 점일수록 천천히 떠다닌다
// - if (aKind > 1.5) p.y -= ...: 제거 레이어(kind 2)만 가속하며 떨어진다
// - isAir / p = mix(p, aAirport.xyz, ...): 공항은 불빛으로 배정된 점만 공항 자리로. uAirport가 1→0으로 줄면
//   자기 지형 자리로 옮겨 간다
// - isPlane / mi / bow / pq: 이륙 비행기 점(시안 A). 비행기 위 자리 = uPlane × 로컬 좌표, 점마다 지연(aAirStyle.w)만큼
//   늦게 PLANE.dotMove(0.45) 동안(quart.out) 자기 지형·물결 자리(위에서 계산한 p)로 간다. 가는 동안 아래·앞으로 부푼 곡선
//   (시안 bow: 아래 54m·앞 36m) — 빛이 흘러내리는 느낌. planeOn = 아직 비행기에 붙은 정도(1 − mi)로 vAir처럼 쓴다.
//   uAirport와 상관없이 uPlaneGo만 따른다(첫 화면 밖에서는 늘 1이라 보통 점과 같다)
// - 포인터 밀기·물결(설계 2026-09-25 §4.1, 계획 5-3a, gl_Position 바로 뒤): 장면 평면에 투영하지 않고 화면 공간(NDC)에서 민다.
//   지형(xz)·지도·차트(z=0)·공항처럼 장면마다 평면이 달라도 식 하나로 되고, 셰이더가 짧다(3D 청크 여유).
//   식·상수는 pointerField.ts와 같다(단위 테스트). 차트 장면은 uChart만큼 PUSH.chartScale로 줄인다.
//   이동은 w를 곱해 클립 좌표에 더한다 — 원근 나눗셈 뒤 화면에서 정확히 그만큼 옮겨진다
// - terrainPx: 지형은 거리에 따라 작아지고(20.0: 계획 3에서 점이 1~2px로 너무 작아 키운 값), 차트는 판 px 그대로다
// - corePx: 공항 불빛 핵의 반지름 px(시안 core = clamp(5.5·size/거리, 0.6, 2.6)px). 조각 셰이더가 핵을 또렷하게,
//   그 둘레를 시안 halo 곡선으로 칠한다(설계 2026-09-29 §8)
// - airPx: 스프라이트 지름 = 시안 번짐 지름(번짐 반지름 9·핵 → 18·핵, 큰 불빛(크기 배율 ≥ 1.5, 계류장 조명 4개)은
//   16·핵 → 32·핵). 성능 검토(2026-09-28)로 12·핵까지 줄였었지만, 번짐이 스프라이트 가장자리(곡선 값 약 0.02)에서
//   잘려 어두운 바닥 위에 테두리가 보였다(2026-09-29 실제 GPU 비교). 불빛 약 1,300개 중 가까운 몇십 개만 크다
// - 비행기 점 크기(시안 pdot): 핵 = clamp(0.42·(1m의 px), 0.55, 1.7)px ≈ clamp(4.5/거리), 스프라이트 = 핵·11(번짐 반지름 5.5·핵),
//   번짐 세기는 불빛의 0.35/0.55(조각 셰이더가 vShape.z < 0으로 알아본다)
// - big / isWin / isCenter: 공항 불빛 종류를 크기 배율(aAirStyle.z)로 가려낸다 — 종류 속성을 더하면 정점 속성
//   16개 한계를 넘는다. center·win 크기 배율은 다른 종류와 겹치지 않는다(airport.ts AIR_SIZE, 단위 테스트)
// - barW / barH: 창문은 둥근 불빛이 아니라 가로 막대(시안: 폭 max(1.6, 6·s), 높이 max(1, 1.4·s)px, s = 1m의 px).
//   s는 corePx와 같은 근사(5.5 = 0.55·10)로 10/거리. 스프라이트 지름 = 막대 폭, 막대 높이는 vShape.z로 넘긴다.
//   지형으로 반 넘게 옮겨 가면(vAir < 0.5) 막대를 끄고 둥근 불빛으로 — 시안도 모이는 도중(0.35)에 점으로 바꾼다
// - vShape: (핵 반지름, 번짐 반지름(= 스프라이트 반지름 0.5), 창문 막대 높이 px — 창문이 아니면 0). 앞 둘은 gl_PointCoord 단위(0.5 = 스프라이트 반지름)
// - vPx: 스프라이트 지름(기기 px) — 조각 셰이더가 핵·막대 가장자리를 딱 1화소만 부드럽게 한다
// - fade: 거리 흐림(설계 첫 화면 다듬기 §2.2): 장면 목표점보다 먼 점일수록 흐리게 — 지형·지도에만(차트 점은
//   아래 mix에서 빠진다)
// - terrainCol: 지도 장면에서는 공휴일 색을 끈다(지도 위 호박색은 노선 전용). 제거 레이어는 글자색
// - uFocus 분기: 강조 규칙(설계 2026-09-28 §3, 계획 5-3b로 일반화) — 2D 그리기(charts/draw2d.ts)와 같은
//   규칙을 uFocusTone·uFocusDim 유니폼으로 받는다(차트마다 값이 다르다, TerrainPoints가 슬롯에서 넣는다)
// - vColor = toSrgbTone(...): 지형·지도·차트 색을 sRGB로 되돌린다. 공항 색(airTone)도 설계 2026-09-29 §8로
//   sRGB로 되돌린다(시안의 색 그대로 — 선형 값이라 파랑·호박이 짙게 가라앉아 시안보다 탁했다)
// - vEdge = mix(0.15, 0.38, uChart): 차트 점은 가장자리를 덜 흐려 또렷한 원으로(2D 대체 그림과 같게)
// - on / haze / wave: 켜지는 순서(로딩 뒤 앞에서 뒤로) + 공기 원근(멀수록 흐림) + 신호 물결.
//   중앙등은 ×0.7(시안), 창문 막대는 ×0.75(시안 fillRect 알파)
// - planeA: 비행기 점 알파(시안): 붙어 있을 때 흰 점 1·파란 점 0.82, 떠나는 동안 0.8 → 0.25 → 0.8(성기어 보이게),
//   거리 흐림 1/(1 + 거리/70). 켜짐은 앞쪽 불빛(순서 0.1)과 함께
// - vAlpha = mix(vAlpha * (1.0 - uAirport), ...): 공항 장면에서 불빛이 아닌 점은 숨긴다. 내려앉은 비행기 점(mi 1)도
//   같은 규칙 — 시안처럼 바로 지형 점 밝기로 두면 머리말 글 뒤에 밝은 점이 먼저 모여 휴대폰 #intro-h 대비가
//   4.37:1로 떨어졌다(terrain.spec 화소 검사). 다른 지형 점과 함께 공항이 걷히는 만큼 밝아진다
// - if (vAlpha < 0.003): 화면에 안 보이는 점(알파가 거의 0)은 크기 0 + 화면 밖으로 보내 래스터화를 아예
//   건너뛴다(성능 검토 2026-09-28) — 공항 장면의 배경 점 약 27,000개, 차트 장면에서 이번 배치에 안 쓰는 점이
//   여기 걸린다
//
// - target: 지형 → 물결 줄(uRows) → 지도(uMap) 순서로 섞는다. 물결 줄 공휴일 색도 uRows로 지형 공휴일과 섞는다
//
// 지도 장면(설계 2026-09-29 §1, 계획 6-4): aRoute = 1 노선, 0 해안선, −1 지도에 안 쓰는 점(알파 0으로 숨김 — 새 속성을
// 더하지 않으려고 기존 aRoute에 담았다, 정점 속성 16개 한계). 지도에서는 종류와 상관없이 같은 알파·크기(MAP_POINT)로
// 그리고, 잡음 점도 끝까지 모인다(gather를 uMap만큼 uAssemble로) — 덜 모인 잡음 점이 해안선 둘레에 뿌옇게 남았었다.
// terrainCol의 노선 색은 max(aRoute, 0.0)로 −1을 0으로 자른다
export const vertexShader = /* glsl */ `
  attribute vec3 aTerrain;
  attribute vec3 aMap;
  attribute vec3 aScatter;
  attribute vec4 aMeta;
  attribute vec3 aWave;
  attribute vec3 aChartA;
  attribute vec3 aChartB;
  attribute vec3 aStyleA;
  attribute vec3 aStyleB;
  attribute float aHl;
  attribute vec4 aAirport;
  attribute vec4 aAirStyle;
  uniform float uRows;
  uniform float uSoft;
  uniform float uAssemble;
  uniform float uMap;
  uniform float uNoise;
  uniform float uRemoved;
  uniform float uDrop;
  uniform float uTime;
  uniform float uSize;
  uniform float uDim;
  uniform float uChart;
  uniform float uSlot;
  uniform float uChartShift;
  uniform float uFocus;
  uniform float uFocusTone;
  uniform float uFocusDim;
  uniform float uDpr;
  uniform vec3 uDot;
  uniform vec3 uAmber;
  uniform vec3 uText;
  uniform float uAirport;
  uniform float uLightT;
  uniform float uWave;
  uniform vec3 uWarm;
  uniform float uFocusDist;
  uniform vec2 uPointer;
  uniform float uPointerOn;
  uniform float uAspect;
  uniform vec3 uRipple;
  uniform mat4 uPlane;
  uniform float uPlaneGo;
  varying float vAlpha;
  varying vec3 vColor;
  varying float vEdge;
  varying float vAir;
  varying float vPx;
  varying vec3 vShape;

  vec3 toneColor(float t) { return t > 2.5 ? uText : (t > 1.5 ? uAmber : uDot); }
  vec3 airTone(float t) { return t > 3.5 ? uWarm : (t > 2.5 ? uText : (t > 1.5 ? uAmber : uDot)); }
  vec3 toSrgbTone(vec3 c) {
    c = max(c, vec3(0.0));
    return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c));
  }

  void main() {
    float aKind = aMeta.x;
    float aHoliday = mix(aMeta.y, aMeta.w, uRows);
    float aRoute = aMeta.z;
    vec3 target = mix(mix(aTerrain, aWave, uRows), aMap, uMap);
    float gather = mix(aKind > 0.5 && aKind < 1.5 ? uAssemble * 0.9 : uAssemble, uAssemble, uMap);
    vec3 p = mix(aScatter, target, gather);
    p += (1.0 - gather) * 0.35 * vec3(sin(uTime * 0.5 + aScatter.y), cos(uTime * 0.4 + aScatter.x), sin(uTime * 0.3 + aScatter.z));
    if (aKind > 1.5) p.y -= uDrop * uDrop * 14.0;
    float isPlane = step(1.5, aAirStyle.x);
    float isAir = aAirStyle.x * (1.0 - isPlane);
    p = mix(p, aAirport.xyz, uAirport * isAir);
    float mi = 1.0 - pow(1.0 - clamp((uPlaneGo - aAirStyle.w) / ${f(PLANE.dotMove)}, 0.0, 1.0), 4.0);
    float bow = sin(mi * 3.14159);
    vec3 pq = mix((uPlane * vec4(aAirport.xyz, 1.0)).xyz, p, mi) - vec3(0.0, 0.54, 0.36) * bow;
    p = mix(p, pq, isPlane);
    float planeOn = isPlane * (1.0 - mi);
    p = mix(p, mix(aChartA, aChartB, uSlot) + vec3(0.0, uChartShift, 0.0), uChart);

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    vec2 ndc = gl_Position.xy / gl_Position.w;
    vec2 dv = (ndc - uPointer) * vec2(uAspect, 1.0);
    float dp = length(dv);
    float kp = 1.0 - smoothstep(0.0, ${f(PUSH.radius)}, dp);
    float push = ${f(PUSH.strength)} * kp * kp * uPointerOn * mix(1.0, ${f(PUSH.chartScale)}, uChart);
    vec2 dr = (ndc - uRipple.xy) * vec2(uAspect, 1.0);
    float drl = length(dr);
    float rip = 0.0;
    if (uRipple.z >= 0.0 && uRipple.z < ${f(RIPPLE.life)}) {
      rip = ${f(RIPPLE.amp)} * (1.0 - smoothstep(0.0, ${f(RIPPLE.width)}, abs(drl - ${f(RIPPLE.speed)} * uRipple.z))) * (1.0 - uRipple.z / ${f(RIPPLE.life)});
    }
    vec2 off = (dp > 1e-4 ? dv / dp * push : vec2(0.0)) + (drl > 1e-4 ? dr / drl * rip : vec2(0.0));
    gl_Position.xy += off / vec2(uAspect, 1.0) * gl_Position.w;
    float size = aKind < 0.5 ? ${f(POINT.signalSize)} : (aKind < 1.5 ? ${f(POINT.noiseSize)} : 1.1);
    size *= mix(1.0, ${f(SOFT_POINT.size)}, uSoft);
    size = mix(size, ${f(MAP_POINT.size)}, uMap);
    float terrainPx = uSize * size * (20.0 / -mv.z);
    float chartPx = mix(aStyleA.z, aStyleB.z, uSlot) * uDpr;
    float dz = max(-mv.z, 0.01);
    float big = step(1.5, aAirStyle.z);
    float isWin = 1.0 - step(0.01, abs(aAirStyle.z - ${f(AIR_SIZE.win)}));
    float isCenter = 1.0 - step(0.01, abs(aAirStyle.z - ${f(AIR_SIZE.center)}));
    float corePx = mix(clamp(5.5 * aAirStyle.z / dz, 0.6, 2.6), clamp(4.5 / dz, 0.55, 1.7), isPlane) * uDpr;
    float airPx = corePx * mix(mix(18.0, 32.0, big), 11.0, isPlane);
    float barW = max(1.6, 60.0 / dz) * uDpr;
    float barH = max(1.0, 14.0 / dz) * uDpr;
    airPx = mix(airPx, barW, isWin);
    vShape = vec3(corePx / airPx, 0.5, isWin * barH * step(0.5, uAirport * isAir) - isPlane);
    float basePx = mix(terrainPx, chartPx, uChart);
    vAir = uAirport * isAir + planeOn;
    gl_PointSize = mix(basePx, airPx, vAir);
    vPx = gl_PointSize;

    float a = aKind < 0.5 ? ${f(POINT.signalAlpha)} : (aKind < 1.5 ? ${f(POINT.noiseAlpha)} * uNoise : 0.9 * uRemoved * (1.0 - uDrop));
    a *= mix(1.0, ${f(SOFT_POINT.alpha)}, uSoft);
    float onMap = step(-0.5, aRoute);
    a = mix(a, onMap * mix(${f(MAP_POINT.coastAlpha)}, ${f(MAP_POINT.routeAlpha)}, max(aRoute, 0.0)), uMap);
    float fade = clamp(${f(DEPTH_FADE.base)} - (-mv.z - uFocusDist) / ${f(DEPTH_FADE.span)}, ${f(DEPTH_FADE.min)}, 1.0);
    vec3 terrainCol = aKind > 1.5 ? uText : mix(uDot, uAmber, max(aHoliday * (1.0 - uMap), max(aRoute, 0.0) * uMap));
    float chartA = mix(aStyleA.x, aStyleB.x, uSlot);
    vec3 chartCol = mix(toneColor(aStyleA.y), toneColor(aStyleB.y), uSlot);
    if (uFocus > -0.5 && aHl > -0.5) {
      if (abs(aHl - uFocus) < 0.5) chartCol = toneColor(uFocusTone); else chartA *= uFocusDim;
    }
    vAlpha = mix(a * uDim * fade, chartA, uChart);
    vColor = toSrgbTone(mix(terrainCol, chartCol, uChart));
    vEdge = mix(0.15, 0.38, uChart);
    float on = clamp((uLightT - mix(aAirStyle.w, 0.1, isPlane) * 1.2) / 0.18, 0.0, 1.0);
    float haze = 1.0 / (1.0 + dz / 52.0);
    float wave = aAirport.w < 0.0 ? 0.0 : exp(-pow((aAirport.w - uWave) / 90.0, 2.0));
    float airA = on * haze * (1.0 + wave * 2.2) * mix(1.0, 0.7, isCenter) * mix(1.0, 0.75, isWin);
    float planeA = on * (mi > 0.0 ? mix(0.8, 0.25, bow) : (aAirStyle.y > 2.5 ? 1.0 : 0.82)) / (1.0 + dz / 70.0);
    vAlpha = mix(vAlpha * (1.0 - uAirport), mix(airA, planeA, isPlane), vAir);
    vColor = mix(vColor, toSrgbTone(airTone(aAirStyle.y)), vAir);
    vEdge = mix(vEdge, 0.0, vAir);
    if (vAlpha < 0.003) {
      gl_PointSize = 0.0;
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    }
  }
`;

// fragmentShader 로직(이름 옆에 있던 설명):
// - core / glow / air: 공항 불빛(설계 2026-09-29 §8, 시안 point()): 또렷한 핵(반지름 vShape.x, 가장자리 딱 1화소
//   aa만 부드럽게) + 시안 halo 곡선(번짐 반지름에 대해 0 → 1, 0.15 → 0.35, 0.45 → 0.06, 1 → 0을 선형으로, ×0.55).
//   시안처럼 핵과 번짐을 더한다(둘 다 빛 더하기로 그렸다). 예전 가우스 번짐·작은 핵(1/24)은 핵이 흐려 보였다
// - bar: 창문 막대(vShape.z > 0) — 세로로 막대 높이만큼만, 가장자리 1화소 부드럽게. 막대 끝은 스프라이트 원
//   (d > 0.5) 밖으로 나가므로 막대는 원으로 자르지 않는다
// - disc = smoothstep(0.5, vEdge, d): 이름을 dot으로 하면 GLSL 내장 함수와 겹친다
// - a = min(vAlpha * mix(disc, air, vAir), 1.0): 미리 곱한 알파(TerrainPoints의 섞기 ONE, ONE_MINUS_SRC_ALPHA와
//   짝) — 색은 늘 vColor·a를 그대로 더하고, 뒤 화소를 줄이는 비율(= 출력 알파)만 점마다 바꾼다. 지형·지도·차트
//   점(vAir 0)은 알파 a → 보통 섞기(겹쳐도 하얗게 타지 않는다), 공항 불빛(vAir 1)은 알파 a² → 뒤 화소에
//   (1 − a²)만 곱해 사실상 빛 더하기다. 재질 하나로 두 방식을 점마다 나누므로 공항 → 지형으로 넘어가는 동안
//   섞기 방식이 튀지 않는다.
//   1로 자른다: 공항 불빛 알파(airA)는 신호 물결 꼭대기에서 약 3.2까지 오른다. 예전엔 섞기 전에 출력 알파가
//   1로 잘려 불빛 하나가 더하는 색이 vColor를 넘지 않았는데, vColor·a로 미리 곱하면 a > 1에서 따뜻한 불빛이
//   하얗게 타고 알파 ≥ 1이 뒤 화소를 지워 번짐이 더해지지 않고 덮어쓴다. 자르면 예전 출력(색 c·min(a,1),
//   알파 min(a,1)²)과 같다
// - gl_FragColor 알파 채널(a * mix(1.0, a, vAir)): 보통 점(vAir 0)은 a, 공항 불빛(vAir 1)은 a² — 예전
//   빛 더하기(SRC_ALPHA, ONE)가 알파에 a²를 쌓던 것을 그대로 옮겨, 페이지 위 합성이 예전과 같게(실제로는
//   C + 배경·(1 − A), 즉 빛 더하기 번짐) 보이고 toDataURL 대체 캡처에도 불빛이 남게 한다. 불빛 화소는
//   예전과 마찬가지로 명세상 "색 > 알파"(결과가 정해지지 않은) 경우에 남는다
export const fragmentShader = /* glsl */ `
  varying float vAlpha;
  varying vec3 vColor;
  varying float vEdge;
  varying float vAir;
  varying float vPx;
  varying vec3 vShape;

  void main() {
    vec2 q = gl_PointCoord - 0.5;
    float d = length(q);
    float bar = vShape.z > 0.0 ? clamp(0.5 * vShape.z - abs(q.y) * vPx + 0.5, 0.0, 1.0) : 0.0;
    if (d > 0.5 && bar <= 0.0) discard;
    float aa = 0.5 / max(vPx, 1.0);
    float core = 1.0 - smoothstep(vShape.x - aa, vShape.x + aa, d);
    float t = d / vShape.y;
    float glow = (t < 0.15 ? mix(1.0, 0.35, t / 0.15) : (t < 0.45 ? mix(0.35, 0.06, (t - 0.15) / 0.3) : mix(0.06, 0.0, min((t - 0.45) / 0.55, 1.0)))) * 0.55;
    float air = vShape.z > 0.0 ? bar : min(core + glow * (vShape.z < 0.0 ? 0.64 : 1.0), 1.0);
    float disc = smoothstep(0.5, vEdge, d);
    float a = min(vAlpha * mix(disc, air, vAir), 1.0);
    gl_FragColor = vec4(vColor * a, a * mix(1.0, a, vAir));
  }
`;
