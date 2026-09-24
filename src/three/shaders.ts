// 점 셰이더: 점마다 흩어짐·지형·지도 세 목표 좌표를 받아 uniform 비율로 섞는다.
// 모든 움직임을 GPU에서 계산하므로 2만8천 개 점도 매 프레임 JS 작업 없이 움직인다.
export const vertexShader = /* glsl */ `
  attribute vec3 aTerrain;
  attribute vec3 aMap;
  attribute vec3 aScatter;
  attribute float aKind;     // 0 신호, 1 잡음, 2 제거, 3 예약 곡선(3-2 전용), 4 예측 구간 띠(3-5 전용)
  attribute float aHoliday;
  attribute float aRoute;
  attribute float aWeight;   // 예약 곡선의 표본 수 가중치(0..1, 로그 척도). 다른 레이어는 1
  uniform float uAssemble;
  uniform float uMap;
  uniform float uNoise;
  uniform float uRemoved;
  uniform float uDrop;
  uniform float uCurve;
  uniform float uBand;
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
    if (aKind > 1.5 && aKind < 2.5) p.y -= uDrop * uDrop * 14.0; // 제거 레이어(kind 2)만 가속하며 떨어진다

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    // 표본 수 가중치를 대비가 보이게 펼친다. 실제 곡선의 가중치는 약 0.39(수십 행)~1(만여 행)이라
    // 그대로 쓰면 차이가 작다 → 0.35~1을 0~1로 늘려, 수십 행짜리 먼 dtd는 거의 바닥값(흐리고 작게)이 된다
    float trust = smoothstep(0.35, 1.0, aWeight);
    // 예약 곡선(kind 3)은 "선"으로 읽혀야 해서 제거 레이어보다도 살짝 더 크게(1.3), 표본이 적으면 절반 이하로
    // 예측 구간 띠(kind 4)는 지형 출발일에만 듬성듬성 세우므로(data.ts), 듬성해진 만큼 점을 키워 선이 끊겨 보이지 않게 1.25
    float size = aKind < 0.5 ? 1.0 : (aKind < 1.5 ? 0.7 : (aKind < 2.5 ? 1.1 : (aKind < 3.5 ? 1.3 * mix(0.4, 1.0, trust) : 1.25)));
    // 원래 12.0이었으나 첫 점검에서 점이 1~2px로 너무 작아 "지형"으로 안 읽혔다 → 20.0으로 키움
    gl_PointSize = uSize * size * (20.0 / -mv.z);

    if (aKind < 0.5) vAlpha = 0.95;
    else if (aKind < 1.5) vAlpha = 0.18 * uNoise;
    else if (aKind < 2.5) vAlpha = 0.9 * uRemoved * (1.0 - uDrop);
    // 예약 곡선은 uMap과 무관하게 uCurve로만 나타났다 사라진다(지도 장면에서는 페이드아웃).
    // 표본이 적은 dtd는 알파를 0.12배까지 낮춰, 출렁이는 값이 믿을 만한 구간과 같은 무게로 보이지 않게 한다
    else if (aKind < 3.5) vAlpha = 0.95 * uCurve * mix(0.12, 1.0, trust);
    // 예측 구간 띠: 3-5 장면에서만 uBand로 나타난다(지도·다른 장면에서는 0)
    else vAlpha = 0.85 * uBand;
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
    // 예약 곡선(kind 3)은 파란 지형 점과 구별돼야 해서 텍스트 색(uText)으로 고정한다
    // (팔레트 밖 색을 새로 만들지 않는다는 규칙을 지키면서도 지형 위에 도드라지게)
    vec3 col = vKind > 2.5 ? uText : (vKind > 1.5 ? uText : mix(uDot, uAmber, max(vHoliday, vRoute)));
    gl_FragColor = vec4(col, vAlpha * soft);
  }
`;
