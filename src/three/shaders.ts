// 점 셰이더: 점마다 흩어짐·지형·지도 세 목표 좌표와, 차트 배치 두 벌(A/B)의 좌표·모양을 받아 uniform 비율로 섞는다.
// 모든 움직임을 GPU에서 계산하므로 2만8천 개 점도 매 프레임 JS 작업 없이 움직인다.
// 차트 배치는 두 벌을 두고 번갈아 쓴다(uSlot) — 차트에서 차트로 넘어갈 때 점이 지형을 거치지 않고 바로 옮겨 간다.
import { FOCUS_DIM } from '@/charts/types';
import { DEPTH_FADE, POINT, glslFloat as f } from './pointStyle';

// 아래 두 GLSL 문자열 안에는 // 주석을 두지 않는다 — 문자열이라 빌드 때 안 지워지고 그대로 gzip에 실려
// 3D 청크를 불필요하게 키운다(2026-09-29 최종 점검, 약 4KB 절감). 원래 줄 옆에 있던 설명을 여기로 옮긴다.

// vertexShader 정점 속성·유니폼(이름 옆에 있던 설명):
// - aKind: 0 신호, 1 잡음, 2 제거
// - aChartA: 차트 배치 A의 목표 좌표(z=0 평면)
// - aStyleA: 차트 배치 A에서의 (알파, 색 번호, 지름 px). 알파 0 = 이 차트에 안 쓰는 점
// - aWaffle: ③ 와플 그룹 번호(강조용), 아니면 -1
// - aAirport: xyz = 공항 불빛 자리, w = 활주로 위 거리(m, 신호 물결. 아니면 -1) — 지형용 float 속성 하나(aRunS)를
//   따로 두면 정점 속성이 16개(WebGL 공통 한계, position·normal·uv 3개 포함)를 넘어 셰이더 링크가 실패한다
// - aAirStyle: (공항 불빛이면 1, 색 번호, 크기 배율, 켜지는 순서)
// - uChart: 0 = 지형·지도, 1 = 차트 배치
// - uSlot: 0 = A, 1 = B
// - uChartShift: 차트 배치의 세계 y 이동(판이 고정되기 전·풀린 뒤 이름표를 따라가게)
// - uFocus: 강조할 와플 그룹, 없으면 -1
// - uAirport: 1 = 공항 장면, 0 = 지형·지도·차트
// - uLightT: 불이 켜지기 시작한 뒤 흐른 초(앞에서 뒤로 차례로 켜짐)
// - uWave: 신호 물결의 지금 위치(활주로 거리 m)
// - uWarm: 따뜻한 흰색(공항 전용)
// - uFocusDist: 카메라~장면 목표점 거리(거리 흐림 기준, TerrainPoints가 넣는다)
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
// - terrainPx: 지형은 거리에 따라 작아지고(20.0: 계획 3에서 점이 1~2px로 너무 작아 키운 값), 차트는 판 px 그대로다
// - corePx: 공항 불빛은 작고 선명한 점 + 옅은 번짐(시안 core = clamp(5.5·size/거리, 0.6, 2.6)px, 번짐 반경 = core × 6).
//   스프라이트 지름 = 번짐 지름이고, 조각 셰이더가 가운데 core만 또렷하게 칠한다
// - airPx: 번짐 반경을 12배로 줄인다(18 → 12) — 스프라이트 픽셀 수는 지름의 제곱이라 18px 스프라이트가 화면을
//   채우는 비용이 컸다(성능 검토 2026-09-28). 핵 반경(조각 셰이더)도 같은 비로 키워 핵 크기는 그대로 유지한다
// - fade: 거리 흐림(설계 첫 화면 다듬기 §2.2): 장면 목표점보다 먼 점일수록 흐리게 — 지형·지도에만(차트 점은
//   아래 mix에서 빠진다)
// - terrainCol: 지도 장면에서는 공휴일 색을 끈다(지도 위 호박색은 노선 전용). 제거 레이어는 글자색
// - uFocus 분기: 강조 규칙(설계 2026-09-28 §3) — 2D 그리기(charts/draw2d.ts)와 같은 숫자(charts/types.ts
//   FOCUS_DIM)를 문자열에 박아 넣는다
// - vColor = toSrgbTone(...): 지형·지도·차트 색만 sRGB로 되돌린다. 공항 색(airTone)은 6-2에서 지금 모습
//   그대로 맞춰 둔 값이라 손대지 않는다
// - vEdge = mix(0.15, 0.38, uChart): 차트 점은 가장자리를 덜 흐려 또렷한 원으로(2D 대체 그림과 같게)
// - on / haze / wave: 켜지는 순서(로딩 뒤 앞에서 뒤로) + 공기 원근(멀수록 흐림) + 신호 물결
// - vAlpha = mix(vAlpha * (1.0 - uAirport), airA, vAir): 공항 장면에서 불빛이 아닌 점은 숨긴다
// - vColor = mix(vColor, airTone(...), vAir) 다음: 넘어가는 동안(0 < vAir < 1)은 sRGB로 되돌린 지형 색과
//   되돌리지 않은 공항 색이 섞인다 — 의도한 것이고 눈에 띄지 않는다(공항 색은 6-2에서 맞춘 그대로 둔다)
// - if (vAlpha < 0.003): 화면에 안 보이는 점(알파가 거의 0)은 크기 0 + 화면 밖으로 보내 래스터화를 아예
//   건너뛴다(성능 검토 2026-09-28) — 공항 장면의 배경 점 약 27,000개, 차트 장면에서 이번 배치에 안 쓰는 점이
//   여기 걸린다
export const vertexShader = /* glsl */ `
  attribute vec3 aTerrain;
  attribute vec3 aMap;
  attribute vec3 aScatter;
  attribute float aKind;
  attribute float aHoliday;
  attribute float aRoute;
  attribute vec3 aChartA;
  attribute vec3 aChartB;
  attribute vec3 aStyleA;
  attribute vec3 aStyleB;
  attribute float aWaffle;
  attribute vec4 aAirport;
  attribute vec4 aAirStyle;
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
  uniform float uDpr;
  uniform vec3 uDot;
  uniform vec3 uAmber;
  uniform vec3 uText;
  uniform float uAirport;
  uniform float uLightT;
  uniform float uWave;
  uniform vec3 uWarm;
  uniform float uFocusDist;
  varying float vAlpha;
  varying vec3 vColor;
  varying float vEdge;
  varying float vAir;

  vec3 toneColor(float t) { return t > 2.5 ? uText : (t > 1.5 ? uAmber : uDot); }
  vec3 airTone(float t) { return t > 3.5 ? uWarm : (t > 2.5 ? uText : (t > 1.5 ? uAmber : uDot)); }
  vec3 toSrgbTone(vec3 c) {
    c = max(c, vec3(0.0));
    return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c));
  }

  void main() {
    vec3 target = mix(aTerrain, aMap, uMap);
    float gather = aKind > 0.5 && aKind < 1.5 ? uAssemble * 0.9 : uAssemble;
    vec3 p = mix(aScatter, target, gather);
    p += (1.0 - gather) * 0.35 * vec3(sin(uTime * 0.5 + aScatter.y), cos(uTime * 0.4 + aScatter.x), sin(uTime * 0.3 + aScatter.z));
    if (aKind > 1.5) p.y -= uDrop * uDrop * 14.0;
    float isAir = aAirStyle.x;
    p = mix(p, aAirport.xyz, uAirport * isAir);
    p = mix(p, mix(aChartA, aChartB, uSlot) + vec3(0.0, uChartShift, 0.0), uChart);

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float size = aKind < 0.5 ? ${f(POINT.signalSize)} : (aKind < 1.5 ? ${f(POINT.noiseSize)} : 1.1);
    float terrainPx = uSize * size * (20.0 / -mv.z);
    float chartPx = mix(aStyleA.z, aStyleB.z, uSlot) * uDpr;
    float corePx = clamp(5.5 * aAirStyle.z / max(-mv.z, 0.01), 0.6, 2.6) * uDpr;
    float airPx = corePx * 12.0;
    float basePx = mix(terrainPx, chartPx, uChart);
    vAir = uAirport * isAir;
    gl_PointSize = mix(basePx, airPx, vAir);

    float a = aKind < 0.5 ? ${f(POINT.signalAlpha)} : (aKind < 1.5 ? ${f(POINT.noiseAlpha)} * uNoise : 0.9 * uRemoved * (1.0 - uDrop));
    float fade = clamp(${f(DEPTH_FADE.base)} - (-mv.z - uFocusDist) / ${f(DEPTH_FADE.span)}, ${f(DEPTH_FADE.min)}, 1.0);
    vec3 terrainCol = aKind > 1.5 ? uText : mix(uDot, uAmber, max(aHoliday * (1.0 - uMap), aRoute * uMap));
    float chartA = mix(aStyleA.x, aStyleB.x, uSlot);
    vec3 chartCol = mix(toneColor(aStyleA.y), toneColor(aStyleB.y), uSlot);
    if (uFocus > -0.5 && aWaffle > -0.5) {
      if (abs(aWaffle - uFocus) < 0.5) chartCol = uAmber; else chartA *= ${FOCUS_DIM.toFixed(2)};
    }
    vAlpha = mix(a * uDim * fade, chartA, uChart);
    vColor = toSrgbTone(mix(terrainCol, chartCol, uChart));
    vEdge = mix(0.15, 0.38, uChart);
    float on = clamp((uLightT - aAirStyle.w * 1.2) / 0.18, 0.0, 1.0);
    float haze = 1.0 / (1.0 + (-mv.z) / 52.0);
    float wave = aAirport.w < 0.0 ? 0.0 : exp(-pow((aAirport.w - uWave) / 90.0, 2.0));
    float airA = on * haze * (1.0 + wave * 2.2);
    vAlpha = mix(vAlpha * (1.0 - uAirport), airA, vAir);
    vColor = mix(vColor, airTone(aAirStyle.y), vAir);
    vEdge = mix(vEdge, 0.0, vAir);
    if (vAlpha < 0.003) {
      gl_PointSize = 0.0;
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    }
  }
`;

// fragmentShader 로직(이름 옆에 있던 설명):
// - core / glow / air: 공항 불빛은 가운데 또렷한 핵(반경 = 스프라이트의 1/12, 번짐 반경 축소(18→12)에 맞춰
//   핵 반지름도 키워 화면 픽셀 크기는 그대로 유지한다) + 가우스 번짐
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

  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    float core = 1.0 - smoothstep(0.033, 0.05, d);
    float glow = exp(-d * d * 28.0) * 0.55;
    float air = max(core, glow);
    float disc = smoothstep(0.5, vEdge, d);
    float a = min(vAlpha * mix(disc, air, vAir), 1.0);
    gl_FragColor = vec4(vColor * a, a * mix(1.0, a, vAir));
  }
`;
