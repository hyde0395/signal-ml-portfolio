// 장면 표 검사: 모든 키 존재, problem·dataBoard만 지도, bubble만 제거 레이어·떨어짐,
// 차트 장면은 정면 고정 카메라이고 세로 화면에서도 카메라가 그대로다.
import { describe, expect, it } from 'vitest';
import { CHART_DISTANCE, isChartScene, SCENES, sceneFor, type SceneKey } from '@/three/scenes';

const KEYS: SceneKey[] = ['hero', 'about', 'problem', 'dataBoard', 'features', 'chartDepart', 'chartCurve', 'bubble',
  'validation', 'chartCloud', 'limits', 'demo', 'contact'];
const CHARTS: SceneKey[] = ['features', 'chartDepart', 'chartCurve', 'chartCloud'];

describe('SCENES', () => {
  it('모든 키가 있다', () => expect(Object.keys(SCENES).sort()).toEqual([...KEYS].sort()));
  it('problem·dataBoard만 지도 장면', () => {
    for (const k of KEYS) expect(SCENES[k].map, k).toBe(k === 'problem' || k === 'dataBoard' ? 1 : 0);
  });
  it('제거 레이어는 bubble에서만', () => {
    for (const k of KEYS) expect(SCENES[k].removed, k).toBe(k === 'bubble' ? 1 : 0);
  });
  it('차트 장면 네 개만 chart = 1이고, 정면(z축)에서 CHART_DISTANCE만큼 떨어져 원점을 본다', () => {
    for (const k of KEYS) expect(isChartScene(k), k).toBe(CHARTS.includes(k));
    for (const k of CHARTS) {
      expect(SCENES[k].camera).toEqual([0, 0, CHART_DISTANCE]);
      expect(SCENES[k].target).toEqual([0, 0, 0]);
    }
  });
  it('dataBoard만 점을 흐리게(dim < 1) — 판 없는 보드가 읽히도록', () => {
    for (const k of KEYS) expect(SCENES[k].dim < 1, k).toBe(k === 'dataBoard');
  });
  it('장면 표의 slot은 모두 0(어느 슬롯을 보일지는 TerrainScene이 정한다)', () => {
    for (const k of KEYS) expect(SCENES[k].slot).toBe(0);
  });
});

describe('sceneFor', () => {
  it('bubble은 진행도로 drop이 0→1, 다른 장면은 0', () => {
    expect(sceneFor('bubble', 0, false).drop).toBe(0);
    expect(sceneFor('bubble', 1, false).drop).toBe(1);
    expect(sceneFor('bubble', 0.5, false).drop).toBeGreaterThan(0);
    expect(sceneFor('chartCurve', 0.9, false).drop).toBe(0);
  });
  it('세로 화면은 카메라가 목표점에서 1.6배 멀다(차트 장면 제외)', () => {
    const land = sceneFor('hero', 0, false), port = sceneFor('hero', 0, true);
    const dist = (s: typeof land) => Math.hypot(...s.camera.map((v, i) => v - s.target[i]));
    expect(dist(port) / dist(land)).toBeCloseTo(1.6, 5);
  });
  it('차트 장면은 세로 화면에서도 카메라가 같다 — 판 위치와 점 좌표의 대응이 카메라 거리에 묶여 있다', () => {
    for (const k of CHARTS) expect(sceneFor(k, 0, true).camera).toEqual(sceneFor(k, 0, false).camera);
  });
  it('problem은 세로 화면에서 목표점이 가운데로 돌아온다', () => {
    expect(sceneFor('problem', 0, true).target).toEqual([0, 0, 0]);
    expect(sceneFor('problem', 0, false).target).toEqual([-4.5, 0, 0]);
  });
});
