// 점 셰이더: 점마다 흩어짐·지형·지도 세 목표 좌표를 받아 uniform 비율로 섞는다.
// 모든 움직임을 GPU에서 계산하므로 2만8천 개 점도 매 프레임 JS 작업 없이 움직인다.
export const vertexShader = /* glsl */ `
  attribute vec3 aTerrain;
  attribute vec3 aMap;
  attribute vec3 aScatter;
  attribute float aKind;     // 0 신호, 1 잡음, 2 제거
  attribute float aHoliday;
  attribute float aRoute;
  uniform float uAssemble;
  uniform float uMap;
  uniform float uNoise;
  uniform float uRemoved;
  uniform float uDrop;
  uniform float uTime;
  uniform float uSize;
  varying float vAlpha;
  varying float vHoliday;
  varying float vRoute;
  varying float vKind;

  void main() {
    vec3 target = mix(aTerrain, aMap, uMap);
    // 잡음은 신호보다 덜 모인다 → "잡음 속에서 신호가 떠오르는" 느낌
    float gather = aKind > 0.5 && aKind < 1.5 ? uAssemble * 0.9 : uAssemble;
    vec3 p = mix(aScatter, target, gather);
    // 덜 모인 점일수록 천천히 떠다닌다
    p += (1.0 - gather) * 0.35 * vec3(sin(uTime * 0.5 + aScatter.y), cos(uTime * 0.4 + aScatter.x), sin(uTime * 0.3 + aScatter.z));
    if (aKind > 1.5) p.y -= uDrop * uDrop * 14.0; // 제거 레이어는 가속하며 떨어진다

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float size = aKind < 0.5 ? 1.0 : (aKind < 1.5 ? 0.7 : 1.1);
    // 원래 12.0이었으나 첫 점검에서 점이 1~2px로 너무 작아 "지형"으로 안 읽혔다 → 20.0으로 키움
    gl_PointSize = uSize * size * (20.0 / -mv.z);

    if (aKind < 0.5) vAlpha = 0.95;
    else if (aKind < 1.5) vAlpha = 0.18 * uNoise;
    else vAlpha = 0.9 * uRemoved * (1.0 - uDrop);
    vHoliday = aHoliday * (1.0 - uMap); // 지도 장면에서는 공휴일 색을 끈다(지도 위 호박색은 노선 전용)
    vRoute = aRoute * uMap;
    vKind = aKind;
  }
`;

export const fragmentShader = /* glsl */ `
  uniform vec3 uDot;
  uniform vec3 uAmber;
  uniform vec3 uText;
  varying float vAlpha;
  varying float vHoliday;
  varying float vRoute;
  varying float vKind;

  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    float soft = smoothstep(0.5, 0.15, d); // 가장자리가 부드러운 원
    vec3 col = vKind > 1.5 ? uText : mix(uDot, uAmber, max(vHoliday, vRoute));
    gl_FragColor = vec4(col, vAlpha * soft);
  }
`;
