// 점 셰이더: 점마다 흩어짐·지형·지도 세 목표 좌표와, 차트 배치 두 벌(A/B)의 좌표·모양을 받아 uniform 비율로 섞는다.
// 모든 움직임을 GPU에서 계산하므로 2만8천 개 점도 매 프레임 JS 작업 없이 움직인다.
// 차트 배치는 두 벌을 두고 번갈아 쓴다(uSlot) — 차트에서 차트로 넘어갈 때 점이 지형을 거치지 않고 바로 옮겨 간다.
export const vertexShader = /* glsl */ `
  attribute vec3 aTerrain;
  attribute vec3 aMap;
  attribute vec3 aScatter;
  attribute float aKind;     // 0 신호, 1 잡음, 2 제거
  attribute float aHoliday;
  attribute float aRoute;
  attribute vec3 aChartA;    // 차트 배치 A의 목표 좌표(z=0 평면)
  attribute vec3 aChartB;
  attribute vec3 aStyleA;    // 차트 배치 A에서의 (알파, 색 번호, 지름 px). 알파 0 = 이 차트에 안 쓰는 점
  attribute vec3 aStyleB;
  uniform float uAssemble;
  uniform float uMap;
  uniform float uNoise;
  uniform float uRemoved;
  uniform float uDrop;
  uniform float uTime;
  uniform float uSize;
  uniform float uDim;
  uniform float uChart;      // 0 = 지형·지도, 1 = 차트 배치
  uniform float uSlot;       // 0 = A, 1 = B
  uniform float uChartShift; // 차트 배치의 세계 y 이동(판이 고정되기 전·풀린 뒤 이름표를 따라가게)
  uniform float uDpr;
  uniform vec3 uDot;
  uniform vec3 uAmber;
  uniform vec3 uText;
  varying float vAlpha;
  varying vec3 vColor;
  varying float vEdge;

  // 색 번호: 1 점 파랑, 2 호박, 3 글자색(src/charts/types.ts TONE과 같은 순서)
  vec3 toneColor(float t) { return t > 2.5 ? uText : (t > 1.5 ? uAmber : uDot); }

  void main() {
    vec3 target = mix(aTerrain, aMap, uMap);
    // 잡음은 신호보다 덜 모인다 → "잡음 속에서 신호가 떠오르는" 느낌
    float gather = aKind > 0.5 && aKind < 1.5 ? uAssemble * 0.9 : uAssemble;
    vec3 p = mix(aScatter, target, gather);
    // 덜 모인 점일수록 천천히 떠다닌다
    p += (1.0 - gather) * 0.35 * vec3(sin(uTime * 0.5 + aScatter.y), cos(uTime * 0.4 + aScatter.x), sin(uTime * 0.3 + aScatter.z));
    if (aKind > 1.5) p.y -= uDrop * uDrop * 14.0; // 제거 레이어(kind 2)만 가속하며 떨어진다
    p = mix(p, mix(aChartA, aChartB, uSlot) + vec3(0.0, uChartShift, 0.0), uChart);

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float size = aKind < 0.5 ? 1.0 : (aKind < 1.5 ? 0.7 : 1.1);
    // 지형은 거리에 따라 작아지고(20.0: 계획 3에서 점이 1~2px로 너무 작아 키운 값), 차트는 판 px 그대로다
    float terrainPx = uSize * size * (20.0 / -mv.z);
    float chartPx = mix(aStyleA.z, aStyleB.z, uSlot) * uDpr;
    gl_PointSize = mix(terrainPx, chartPx, uChart);

    float a = aKind < 0.5 ? 0.95 : (aKind < 1.5 ? 0.18 * uNoise : 0.9 * uRemoved * (1.0 - uDrop));
    // 지도 장면에서는 공휴일 색을 끈다(지도 위 호박색은 노선 전용). 제거 레이어는 글자색
    vec3 terrainCol = aKind > 1.5 ? uText : mix(uDot, uAmber, max(aHoliday * (1.0 - uMap), aRoute * uMap));
    float chartA = mix(aStyleA.x, aStyleB.x, uSlot);
    vec3 chartCol = mix(toneColor(aStyleA.y), toneColor(aStyleB.y), uSlot);
    vAlpha = mix(a * uDim, chartA, uChart);
    vColor = mix(terrainCol, chartCol, uChart);
    // 차트 점은 가장자리를 덜 흐려 또렷한 원으로(2D 대체 그림과 같게)
    vEdge = mix(0.15, 0.38, uChart);
  }
`;

export const fragmentShader = /* glsl */ `
  varying float vAlpha;
  varying vec3 vColor;
  varying float vEdge;

  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    gl_FragColor = vec4(vColor, vAlpha * smoothstep(0.5, vEdge, d));
  }
`;
