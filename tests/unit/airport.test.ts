// 공항 배치 검사: 종류별 개수, 색은 파랑·호박·흰색·따뜻한 흰색뿐(빨강·초록 없음), 켜지는 순서 0~1.1,
// 활주로 등만 신호 물결 위치(runS)를 가진다, 좌표 변환(z 뒤집기·축척), 휴대폰은 절반.
import { describe, expect, it } from 'vitest';
import { AIR_TONE, buildAirport, K, runwayPoint, toWorld } from '@/three/airport';

describe('buildAirport', () => {
  const A = buildAirport({ stride: 1 });
  const count = (k: string) => A.lights.filter((l) => l.kind === k).length;
  it('종류별 개수(시안과 같은 간격)', () => {
    expect(count('edge')).toBe(108);
    expect(count('center')).toBe(177); // s = 30, 48, …, 3198
    expect(count('thr') + count('end')).toBe(22);
    expect(count('taxi')).toBe(202 + 60);
    expect(count('apron')).toBe(4);
    expect(count('city')).toBe(160);
    expect(count('win')).toBeGreaterThan(250); // 시드 7 기준 실제 값 339(stride 1) — 시드 의존이라 정확한 수 대신 하한만 검사
  });
  it('색은 파랑·호박·흰색·따뜻한 흰색뿐', () => {
    const tones = new Set(A.lights.map((l) => l.tone));
    for (const t of tones) expect([AIR_TONE.blue, AIR_TONE.amber, AIR_TONE.white, AIR_TONE.warm]).toContain(t);
  });
  it('켜지는 순서는 0~1.1, 활주로 가장자리·중앙등만 runS ≥ 0', () => {
    for (const l of A.lights) {
      expect(l.ord).toBeGreaterThanOrEqual(0); expect(l.ord).toBeLessThanOrEqual(1.1);
      expect(l.runS >= 0).toBe(l.kind === 'edge' || l.kind === 'center');
    }
  });
  it('같은 시드면 같은 배치(캡처 이미지가 매번 같다)', () => {
    expect(buildAirport({ stride: 1 }).lights.map((l) => l.pos.join()).join()).toBe(A.lights.map((l) => l.pos.join()).join());
  });
  it('휴대폰(stride 2)은 약 절반', () => {
    const half = buildAirport({ stride: 2 }).lights.length;
    expect(half).toBeGreaterThanOrEqual(Math.floor(A.lights.length / 2) - 1);
    expect(half).toBeLessThanOrEqual(Math.ceil(A.lights.length / 2) + 1);
  });
  it('경고등은 불빛 목록 밖 한 개, 진입등 14개', () => {
    expect(A.beacon).toHaveLength(3);
    expect(A.approach).toHaveLength(14);
  });
});

describe('좌표', () => {
  it('시안 미터 → 사이트 월드: 축척 K, z 뒤집기', () => {
    expect(toWorld(100, 50, 200)).toEqual([100 * K, 50 * K, -200 * K]);
  });
  it('활주로 시작점과 끝점', () => {
    expect(runwayPoint(0, 0)).toEqual([-60, 180]);
    const [x, z] = runwayPoint(3200, 0);
    expect(x).toBeCloseTo(-60 + Math.sin(0.62) * 3200, 6);
    expect(z).toBeCloseTo(180 + Math.cos(0.62) * 3200, 6);
  });
});
