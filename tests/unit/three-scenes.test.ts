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
  // 설계 2026-09-28 §2.1: 데모·연락처는 글 뒤 판이 없어 조작 화면이 읽히도록 지형을 흐리게 둔다(dataBoard와 같은 이유)
  const DIMMED: SceneKey[] = ['dataBoard', 'demo', 'contact'];
  it('dataBoard·데모·연락처만 점을 흐리게(dim < 1) — 판 없는 화면이 읽히도록', () => {
    for (const k of KEYS) expect(SCENES[k].dim < 1, k).toBe(DIMMED.includes(k));
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
    const land = sceneFor('about', 0, false), port = sceneFor('about', 0, true);
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

  // 설계 2026-09-28 §2.1: 글 뒤 판 대신 장면 구도로 대비를 지킨다 — 데스크톱은 글이 왼쪽이라 점을 오른쪽으로,
  // 세로 화면은 글이 아래라 옆으로 밀지 않는다. hero는 밤의 공항 전용 구도라 빠진다(설계 2026-09-28 §4.2)
  const TEXT_SIDE: SceneKey[] = ['about', 'bubble', 'validation', 'limits', 'demo', 'contact'];
  it('글 쪽 장면은 데스크톱에서 목표점이 왼쪽(x −5 이하), 세로 화면에서는 가운데', () => {
    // 지금은 이 목록의 모든 장면이 정확히 −5다(hero는 밤의 공항 전용 구도라 빠져 있다, 위 주석·scenes.ts
    // AIRPORT_CAM 참고). "−5 이하"로 느슨하게 검사해 두는 이유는, 나중에 화소 대비 검사 실패 등으로
    // 어느 장면을 −5보다 더 왼쪽으로 옮겨야 해도 이 값을 다시 정확히 맞출 필요가 없게 하기 위해서다
    for (const k of TEXT_SIDE) {
      expect(sceneFor(k, 0, false).target[0], k).toBeLessThanOrEqual(-5);
      expect(sceneFor(k, 0, true).target[0], k).toBe(0);
    }
  });
  it('데모·연락처는 조작 화면이 주인공이라 점을 흐리게(dim ≤ 0.5)', () => {
    expect(SCENES.demo.dim).toBeLessThanOrEqual(0.5);
    expect(SCENES.contact.dim).toBeLessThanOrEqual(0.5);
  });

  // 세로 화면은 지형이 위쪽 절반에서 보이도록 카메라·목표점의 y를 내리지만(코드 리뷰 2026-09-28),
  // 카메라−목표점 벡터(구도)는 데스크톱과 같아야 한다 — 그래야 세로 화면 1.6배 확대만 다르고 각도는 그대로다
  it('글 쪽 장면은 세로 화면의 카메라−목표점 벡터가 데스크톱의 1.6배다(구도는 그대로, 거리만 다르다)', () => {
    for (const k of TEXT_SIDE) {
      const land = sceneFor(k, 0, false), port = sceneFor(k, 0, true);
      const landDelta = land.camera.map((v, i) => v - land.target[i]);
      const portDelta = port.camera.map((v, i) => v - port.target[i]);
      portDelta.forEach((d, i) => expect(d, `${k}[${i}]`).toBeCloseTo(landDelta[i] * 1.6, 5));
    }
  });
});

describe('밤의 공항 첫 화면(설계 2026-09-28 §4.2)', () => {
  it('hero만 공항 장면', () => {
    for (const k of KEYS) expect(SCENES[k].airport, k).toBe(k === 'hero' ? 1 : 0);
  });
  it('진행도 0은 A(높은 창가), 1은 B(낮게 내려앉음) — 같은 x·z, 눈높이만 낮다', () => {
    const a = sceneFor('hero', 0, false), b = sceneFor('hero', 1, false);
    expect(a.camera[0]).toBeCloseTo(b.camera[0], 6);
    expect(a.camera[2]).toBeCloseTo(b.camera[2], 6);
    expect(b.camera[1]).toBeLessThan(a.camera[1]);
    const m = sceneFor('hero', 0.5, false);
    expect(m.camera[1]).toBeLessThan(a.camera[1]);
    expect(m.camera[1]).toBeGreaterThan(b.camera[1]);
  });
  it('첫 화면 마우스 시차는 공항 크기에 맞게 작다', () => {
    expect(SCENES.hero.sway).toBeLessThanOrEqual(0.1);
  });
  it('세로 화면은 목표점을 오른쪽으로 밀어 활주로 소실점을 화면 안에 둔다(Task 9 스크린샷으로 맞춤)', () => {
    const landscape = sceneFor('hero', 0, false), portrait = sceneFor('hero', 0, true);
    expect(portrait.target[0]).toBeGreaterThan(landscape.target[0]);
  });
});
