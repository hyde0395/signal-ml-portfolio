// 점 셰이더: 점마다 흩어짐·지형·지도 세 목표 좌표를 받아 uniform 비율로 섞는다.
// 모든 움직임을 GPU에서 계산하므로 2만8천 개 점도 매 프레임 JS 작업 없이 움직인다.
export const vertexShader = /* glsl */ `
  attribute vec3 aTerrain;
  attribute vec3 aMap;
  attribute vec3 aScatter;
  attribute float aKind;     // 0 신호, 1 잡음, 2 제거, 3 예약 곡선(인사이트 전용)
  attribute float aHoliday;
  attribute float aRoute;
  uniform float uAssemble;
  uniform float uMap;
  uniform float uNoise;
  uniform float uRemoved;
  uniform float uDrop;
  uniform float uCurve;
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
    // 예약 곡선(kind 3)은 "선"으로 읽혀야 해서 제거 레이어보다도 살짝 더 크게(1.3)
    float size = aKind < 0.5 ? 1.0 : (aKind < 1.5 ? 0.7 : (aKind < 2.5 ? 1.1 : 1.3));
    // 원래 12.0이었으나 첫 점검에서 점이 1~2px로 너무 작아 "지형"으로 안 읽혔다 → 20.0으로 키움
    gl_PointSize = uSize * size * (20.0 / -mv.z);

    if (aKind < 0.5) vAlpha = 0.95;
    else if (aKind < 1.5) vAlpha = 0.18 * uNoise;
    else if (aKind < 2.5) vAlpha = 0.9 * uRemoved * (1.0 - uDrop);
    else vAlpha = 0.95 * uCurve; // 예약 곡선은 uMap과 무관하게 uCurve로만 나타났다 사라진다(지도 장면에서는 페이드아웃)
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
    // 예약 곡선(kind 3)은 파란 지형 점과 구별돼야 해서 호박색·흰색을 섞은 톤 하나로 고정한다
    // (팔레트 밖 색을 새로 만들지 않는다는 규칙을 지키면서도 지형 위에 도드라지게)
    vec3 col = vKind > 2.5 ? mix(uAmber, uText, 0.5) : (vKind > 1.5 ? uText : mix(uDot, uAmber, max(vHoliday, vRoute)));
    gl_FragColor = vec4(col, vAlpha * soft);
  }
`;
