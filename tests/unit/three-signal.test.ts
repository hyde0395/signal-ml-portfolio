// 잡음 → 신호(계획 9-3) 순수 함수 검사: 단계(켜짐·선 머리·가라앉음), 스크롤 눈금(runwayProgress),
// U자 곡선 화면 배치·곡선 위 점(curvePoint), 점 배정(buildField).
import { describe, expect, it } from 'vitest';
import { PLANE, runwayProgress, takeoffProgress } from '@/three/plane';
import { binLit, buildField, curvePoint, FIELD, lineHead, settle, SIGNAL, signalLayout, signalStage } from '@/three/signal';

const BINS = [2.1, -4.3, -5.0, -3.7, -2.4, 0.9, 4.4, 11.1];

describe('단계', () => {
  it('signalStage: 시계 1 → 0, 끝(1.8) → 1, 밖은 자른다', () => {
    expect(signalStage(0.5)).toBe(0);
    expect(signalStage(SIGNAL.start)).toBe(0);
    expect(signalStage((SIGNAL.start + SIGNAL.end) / 2)).toBeCloseTo(0.5);
    expect(signalStage(SIGNAL.end)).toBe(1);
    expect(signalStage(9)).toBe(1);
  });
  it('binLit: 단계 1(q < 0.25)에는 꺼져 있고, 점마다 늦게 켜져 모두 0.65 전에 다 켜진다', () => {
    for (let i = 0; i < 8; i++) expect(binLit(0.24, i)).toBe(0);
    expect(binLit(0.3, 0)).toBeGreaterThan(binLit(0.3, 1));
    expect(binLit(0.3, 7)).toBe(0);
    for (let i = 0; i < 8; i++) expect(binLit(0.65, i)).toBeGreaterThan(0.99);
    expect(binLit(1, 3)).toBe(1);
  });
  it('lineHead: 0.5 → 0, 0.83 → 1(선은 마지막 점이 켜진 뒤 그 자리에 닿는다)', () => {
    expect(lineHead(0.4)).toBe(0);
    expect(lineHead(0.5)).toBe(0);
    expect(lineHead(0.83)).toBeCloseTo(1);
    expect(lineHead(1)).toBe(1);
    // 머리가 마지막 구간 점에 닿기 전에 그 점은 이미 켜져 있다
    expect(binLit(SIGNAL.line0 + (SIGNAL.line1 - SIGNAL.line0) * 0.999, 7)).toBeGreaterThan(0.99);
  });
  it('settle: 0.82 전 0, 끝에서 1', () => {
    expect(settle(0.8)).toBe(0);
    expect(settle(0.9)).toBeGreaterThan(0.5);
    expect(settle(1)).toBe(1);
  });
});

describe('runwayProgress', () => {
  const y0 = 810, yA = 1560, yB = 2500;
  it('yA 전은 이륙 눈금(takeoffProgress)과 같다', () => {
    for (const y of [0, 400, 810, 1000, 1559]) expect(runwayProgress(y, y0, yA, yB)).toBeCloseTo(takeoffProgress(y, y0, yA));
  });
  it('yA → yB는 신호 단계 1 → 1.8, 그 뒤 1.8', () => {
    expect(runwayProgress(yA, y0, yA, yB)).toBeCloseTo(SIGNAL.start);
    expect(runwayProgress((yA + yB) / 2, y0, yA, yB)).toBeCloseTo((SIGNAL.start + SIGNAL.end) / 2);
    expect(runwayProgress(yB, y0, yA, yB)).toBe(SIGNAL.end);
    expect(runwayProgress(9e4, y0, yA, yB)).toBe(SIGNAL.end);
  });
  it('단조 증가, yB <= yA면 yA에서 바로 끝', () => {
    let prev = -1;
    for (let y = 0; y < 3000; y += 9) { const p = runwayProgress(y, y0, yA, yB); expect(p).toBeGreaterThanOrEqual(prev); prev = p; }
    expect(runwayProgress(yA + 1, y0, yA, yA)).toBe(SIGNAL.end);
  });
  it('신호 단계는 이륙이 끝난 뒤(흩어짐·전환보다 뒤)', () => {
    expect(SIGNAL.start).toBeGreaterThanOrEqual(PLANE.handoffEnd);
  });
});

describe('signalLayout', () => {
  const L = signalLayout(1.6, BINS);
  it('점 8개, 왼 → 오른쪽, 화면 오른쪽(글 반대쪽)', () => {
    expect(L.pts.length).toBe(8);
    for (let i = 1; i < 8; i++) expect(L.pts[i][0]).toBeGreaterThan(L.pts[i - 1][0]);
    for (const p of L.pts) { expect(p[0]).toBeGreaterThan(0.05); expect(p[0]).toBeLessThan(0.9); expect(Math.abs(p[1])).toBeLessThan(0.6); }
  });
  it('높이는 값 순서 그대로(가장 낮은 = 구간 2, 가장 높은 = 구간 7)', () => {
    const ys = L.pts.map((p) => p[1]);
    expect(ys.indexOf(Math.min(...ys))).toBe(2);
    expect(ys.indexOf(Math.max(...ys))).toBe(7);
    expect(ys[0]).toBeGreaterThan(ys[1]);
  });
  it('누적 호 길이 0 → 1 증가', () => {
    expect(L.arc[0]).toBe(0);
    expect(L.arc[7]).toBeCloseTo(1);
    for (let i = 1; i < 8; i++) expect(L.arc[i]).toBeGreaterThan(L.arc[i - 1]);
  });
  it('세로 화면은 위쪽(글은 아래), 가로 폭을 넓게', () => {
    const P = signalLayout(390 / 844, BINS);
    for (const p of P.pts) expect(p[1]).toBeGreaterThan(0.1);
    expect(P.pts[7][0] - P.pts[0][0]).toBeGreaterThan(1.5);
  });
  it('값이 모두 같아도(곡선 없음) 깨지지 않는다', () => {
    const F = signalLayout(1.6, new Array(8).fill(0));
    for (const p of F.pts) expect(Number.isFinite(p[1])).toBe(true);
    expect(F.arc[7]).toBeCloseTo(1);
  });
});

describe('curvePoint', () => {
  const L = signalLayout(1.6, BINS);
  it('s = arc[i]이면 구간 점 i', () => {
    for (let i = 0; i < 8; i++) {
      const p = curvePoint(L, L.arc[i]);
      expect(p[0]).toBeCloseTo(L.pts[i][0], 5);
      expect(p[1]).toBeCloseTo(L.pts[i][1], 5);
    }
  });
  it('s가 늘면 x도 늘고(왼 → 오른쪽으로 그어진다), 밖은 양끝', () => {
    let prev = -9;
    for (let s = 0; s <= 1; s += 0.01) { const x = curvePoint(L, s)[0]; expect(x).toBeGreaterThan(prev); prev = x; }
    expect(curvePoint(L, -1)).toEqual(curvePoint(L, 0));
    expect(curvePoint(L, 2)[0]).toBeCloseTo(L.pts[7][0], 5);
  });
});

describe('buildField', () => {
  // 점 600개: 0..199 신호, 200..599 잡음. 신호 0..59는 공항 불빛·비행기 점
  const n = 600;
  const kind = new Float32Array(n).map((_, i) => (i < 200 ? 0 : 1));
  const air = new Float32Array(n * 4);
  for (let i = 0; i < 60; i++) air[i * 4] = i < 50 ? 1 : 2;
  const opts = { kind, air, target: 300, lineCount: 40, seed: 3 };
  const f = buildField(opts);
  const roles = Array.from(f.role);
  it('공항 불빛·비행기 점은 모두 밭에 든다(같은 점이 잡음이 된다)', () => {
    for (let i = 0; i < 60; i++) expect(roles[i]).toBeGreaterThanOrEqual(1);
  });
  it('잡음 역할 + 구간 점 8 = target', () => {
    expect(roles.filter((r) => r === 1).length + 8).toBe(300);
  });
  it('구간 점 2..9가 하나씩, 공항 점이 아니고 곡선 근처(0.2 NDC 안)에서 켜진다', () => {
    for (let b = 0; b < 8; b++) {
      const at = roles.indexOf(2 + b);
      expect(at).toBeGreaterThanOrEqual(60);
      expect(roles.filter((r) => r === 2 + b).length).toBe(1);
      expect(Math.hypot(f.field[at * 3], f.field[at * 3 + 1])).toBeLessThan(0.2);
    }
  });
  it('선 점은 lineCount개, 밭 밖 잡음 점에서, 호 길이 0..1을 고르게', () => {
    const line = roles.map((r, i) => [r, i]).filter(([r]) => r >= 10);
    expect(line.length).toBe(40);
    for (const [, i] of line) expect(kind[i]).toBe(1);
    const s = line.map(([r]) => r - 10).sort((a, b) => a - b);
    expect(s[0]).toBe(0);
    expect(s[39]).toBeCloseTo(1);
  });
  it('잡음 자리는 화면(NDC) 안팎 조금, 깊이 0..1', () => {
    roles.forEach((r, i) => {
      if (r !== 1) return;
      expect(Math.abs(f.field[i * 3])).toBeLessThanOrEqual(1.05);
      expect(Math.abs(f.field[i * 3 + 1])).toBeLessThanOrEqual(1.05);
      expect(f.field[i * 3 + 2]).toBeGreaterThanOrEqual(0);
      expect(f.field[i * 3 + 2]).toBeLessThanOrEqual(1);
    });
  });
  it('공항 점이 target보다 많으면 공항 점은 다 넣고 구간 점 8개를 더한다', () => {
    const g = buildField({ ...opts, target: 20 });
    expect(Array.from(g.role).filter((r) => r >= 1 && r < 10).length).toBe(60 + 8);
  });
  it('같은 시드면 같은 결과', () => {
    expect(buildField(opts)).toEqual(f);
  });
  it('기본 개수: 세로 화면은 화면이 작아 적게', () => {
    expect(FIELD.portrait.target).toBeLessThan(FIELD.desktop.target);
  });
});
