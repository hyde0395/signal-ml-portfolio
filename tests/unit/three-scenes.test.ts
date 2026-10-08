// 장면 표 검사: 모든 키 존재, problem·dataBoard만 지도, 제거 레이어·떨어짐을 쓰는 장면 없음(정보 전달 2에서 차트 3이 판으로),
// 차트 장면은 정면 고정 카메라이고 세로 화면에서도 카메라가 그대로다.
import { describe, expect, it } from 'vitest';
import { AIRPORT_CAM, blendScenes, CHART_DISTANCE, CHART_FOV, followActive, handoffProgress, HERO_FOV, horizonFrac, introScene, isChartScene, pickScene, SCENES, sceneFor, type SceneKey } from '@/three/scenes';
import { runwayPhases } from '@/three/plane';
import { SIGNAL } from '@/three/signal';

const KEYS: SceneKey[] = ['hero', 'about', 'problem', 'dataBoard', 'chartFilter', 'model', 'chartModel', 'features', 'chartDepart', 'chartCurve',
  'chartSplit', 'blank', 'chartCloud', 'limits', 'demo', 'contact'];
const CHARTS: SceneKey[] = ['chartFilter', 'chartModel', 'features', 'chartDepart', 'chartCurve', 'chartSplit', 'chartCloud'];

describe('SCENES', () => {
  it('모든 키가 있다', () => expect(Object.keys(SCENES).sort()).toEqual([...KEYS].sort()));
  it('problem·dataBoard만 지도 장면', () => {
    for (const k of KEYS) expect(SCENES[k].map, k).toBe(k === 'problem' || k === 'dataBoard' ? 1 : 0);
  });
  it('제거 레이어를 켜는 장면은 없다(차트 3이 판이 되어, 정보 전달 2)', () => {
    for (const k of KEYS) expect(SCENES[k].removed, k).toBe(0);
  });
  it('차트 장면 여덟 개(② 걸러내기·⑤ 검증 설계 포함 계획 8-1, ⑤ 차트 3 포함)만 chart = 1이고, 정면(z축)에서 CHART_DISTANCE만큼 떨어져 원점을 본다', () => {
    for (const k of KEYS) expect(isChartScene(k), k).toBe(CHARTS.includes(k));
    for (const k of CHARTS) {
      expect(SCENES[k].camera).toEqual([0, 0, CHART_DISTANCE]);
      expect(SCENES[k].target).toEqual([0, 0, 0]);
    }
  });
  // 설계 2026-09-28 §2.1: 데모·연락처는 글 뒤 판이 없어 조작 화면이 읽히도록 지형을 흐리게 둔다(dataBoard와 같은 이유).
  // ①(about)은 완성된 U자와 잡음이 흐린 배경으로 남는다(설계 2026-10-01 §1)
  const DIMMED: SceneKey[] = ['blank', 'dataBoard', 'about', 'demo', 'contact'];
  it('dataBoard·①·⑤ 큰 숫자(blank)·데모·연락처만 점을 흐리게(dim < 1) — 판 없는 화면이 읽히도록', () => {
    for (const k of KEYS) expect(SCENES[k].dim < 1, k).toBe(DIMMED.includes(k));
  });
  it('model(③ 섹션 바탕)은 지형 장면이다(지도·제거 레이어·차트·흐림 없음) — 설계 2026-09-29 이야기 흐름 §3.4, 계획 7-2', () => {
    const s = SCENES.model;
    expect([s.map, s.removed, s.chart, s.field, s.airport]).toEqual([0, 0, 0, 0, 0]);
    expect(s.dim).toBe(1);
  });
  it('장면 표의 slot은 모두 0(어느 슬롯을 보일지는 TerrainScene이 정한다)', () => {
    for (const k of KEYS) expect(SCENES[k].slot).toBe(0);
  });
});

describe('sceneFor', () => {
  it('drop은 모든 장면에서 0', () => {
    for (const k of KEYS) for (const p of [0, 0.5, 1]) expect(sceneFor(k, p, false).drop, k).toBe(0);
  });
  it('세로 화면은 카메라가 목표점에서 1.6배 멀다(차트 장면 제외)', () => {
    const land = sceneFor('limits', 0, false), port = sceneFor('limits', 0, true);
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
  // 세로 화면은 글이 아래라 옆으로 밀지 않는다. hero는 밤의 공항 전용 구도라 빠진다(설계 2026-09-28 §4.2).
  // about(①)도 빠진다 — 잡음 밭은 화면 좌표로 화면 전체를 덮고, U자는 셰이더가 글 반대쪽에 놓는다(설계 2026-10-01 §3)
  const TEXT_SIDE: SceneKey[] = ['model', 'blank', 'limits', 'demo', 'contact'];
  it('글 쪽 장면은 데스크톱에서 목표점이 왼쪽(x −5 이하), 세로 화면에서는 가운데', () => {
    // 지금은 이 목록의 모든 장면이 정확히 −5다(hero는 밤의 공항 전용 구도라 빠져 있다, 위 주석·scenes.ts
    // AIRPORT_CAM 참고). "−5 이하"로 느슨하게 검사해 두는 이유는, 나중에 화소 대비 검사 실패 등으로
    // 어느 장면을 −5보다 더 왼쪽으로 옮겨야 해도 이 값을 다시 정확히 맞출 필요가 없게 하기 위해서다
    for (const k of TEXT_SIDE) {
      expect(sceneFor(k, 0, false).target[0], k).toBeLessThanOrEqual(-5);
      expect(sceneFor(k, 0, true).target[0], k).toBe(0);
    }
  });
  // 설계 2026-10-08: ⑤ 큰 숫자 카드 뒤에는 점이 보이지 않는다
  it('blank는 점이 모두 투명(dim 0·잡음 0)', () => {
    expect(SCENES.blank.dim).toBe(0);
    expect(SCENES.blank.noise).toBe(0);
  });
  it('데모·연락처는 조작 화면이 주인공이라 점을 흐리게(dim ≤ 0.5)', () => {
    expect(SCENES.demo.dim).toBeLessThanOrEqual(0.5);
    expect(SCENES.contact.dim).toBeLessThanOrEqual(0.5);
  });
  // 설계 2026-10-01: 데모 뒤에는 점이 하나도 보이지 않는다. 카메라는 연락처와 같아 데모 → 연락처는 제자리에서 점만 떠오른다
  it('데모는 점이 모두 투명(dim 0·잡음 0)이고 카메라는 연락처와 같다', () => {
    expect(SCENES.demo.dim).toBe(0);
    expect(SCENES.demo.noise).toBe(0);
    for (const portrait of [false, true]) {
      const d = sceneFor('demo', 0, portrait), c = sceneFor('contact', 0, portrait);
      expect(d.camera).toEqual(c.camera);
      expect(d.target).toEqual(c.target);
    }
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

describe('① 잡음 밭(설계 2026-10-01 §3·§6)', () => {
  it('카메라는 차트 카메라와 같은 정면 고정(밭·곡선을 화면 좌표로 놓는다), 세로 화면도 같다', () => {
    for (const portrait of [false, true]) {
      expect(sceneFor('about', 0, portrait).camera).toEqual([0, 0, CHART_DISTANCE]);
      expect(sceneFor('about', 0, portrait).target).toEqual([0, 0, 0]);
    }
  });
  it('about만 잡음 밭(field 1)', () => {
    for (const k of KEYS) expect(SCENES[k].field, k).toBe(k === 'about' ? 1 : 0);
  });
  it('머리말 장면(introScene)은 ①과 같고 흐리지 않다(dim 1) — 신호가 그어지는 동안은 또렷하게', () => {
    expect(introScene(false)).toEqual({ ...sceneFor('about', 0, false), dim: 1 });
  });
  it('전환 구간 섞기에서 field도 선형으로 섞인다', () => {
    expect(blendScenes(SCENES.hero, SCENES.about, 0.25).field).toBeCloseTo(0.25, 9);
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

describe('blendScenes', () => {
  const a = SCENES.hero, b = SCENES.about;
  it('h 0은 a, 1은 b', () => {
    expect(blendScenes(a, b, 0)).toEqual(a);
    expect(blendScenes(a, b, 1)).toEqual(b);
  });
  it('중간값은 숫자 필드를 선형으로 섞는다(카메라·목표점 성분 포함)', () => {
    const m = blendScenes(a, b, 0.5);
    expect(m.airport).toBeCloseTo((a.airport + b.airport) / 2, 9);
    expect(m.noise).toBeCloseTo((a.noise + b.noise) / 2, 9);
    expect(m.sway).toBeCloseTo((a.sway + b.sway) / 2, 9);
    for (let i = 0; i < 3; i++) {
      expect(m.camera[i]).toBeCloseTo((a.camera[i] + b.camera[i]) / 2, 9);
      expect(m.target[i]).toBeCloseTo((a.target[i] + b.target[i]) / 2, 9);
    }
    expect(blendScenes(a, { ...SCENES.limits, removed: 1 }, 0.25).removed).toBeCloseTo(0.25, 9);
  });
  it('차트 장면이 끼면 던진다', () => {
    expect(() => blendScenes(SCENES.features, b, 0.5)).toThrow();
    expect(() => blendScenes(a, SCENES.chartCloud, 0.5)).toThrow();
  });
  it('follow는 섞기 결과에 넣지 않는다', () => {
    expect('follow' in blendScenes(a, b, 0.5)).toBe(false);
  });
  it('followUntil(시각)도 섞지 않는다 — 두 시각의 평균은 의미 없는 값이다', () => {
    const x = { ...a, followUntil: 1000 }, y = { ...b, followUntil: 3000 };
    expect('followUntil' in blendScenes(x, y, 0.5)).toBe(false);
  });
  it('숫자가 아닌 필드는 h >= 0.5면 b, 아니면 a', () => {
    const x = { ...a, tag: 'x' } as typeof a, y = { ...b, tag: 'y' } as typeof b;
    expect((blendScenes(x, y, 0.49) as unknown as { tag: string }).tag).toBe('x');
    expect((blendScenes(x, y, 0.5) as unknown as { tag: string }).tag).toBe('y');
  });
  it('한쪽에만 있는 숫자 필드는 없는 쪽을 0으로 본다', () => {
    const y = { ...b, extra: 10 } as typeof b;
    expect((blendScenes(a, y, 0.5) as unknown as { extra: number }).extra).toBeCloseTo(5, 9);
  });
});

describe('handoffProgress', () => {
  it('y0 이하 0, y1 이상 1', () => {
    expect(handoffProgress(0, 100, 300)).toBe(0);
    expect(handoffProgress(100, 100, 300)).toBe(0);
    expect(handoffProgress(300, 100, 300)).toBe(1);
    expect(handoffProgress(999, 100, 300)).toBe(1);
  });
  it('사이는 smoothstep(중간 0.5, 단조 증가)', () => {
    expect(handoffProgress(200, 100, 300)).toBeCloseTo(0.5, 9);
    expect(handoffProgress(150, 100, 300)).toBeLessThan(0.25);
    expect(handoffProgress(150, 100, 300)).toBeLessThan(handoffProgress(250, 100, 300));
  });
  it('y1 <= y0이면 0', () => {
    expect(handoffProgress(500, 300, 300)).toBe(0);
    expect(handoffProgress(500, 300, 100)).toBe(0);
  });
});

describe('followActive', () => {
  it('follow이면 참, followUntil 전이면 참, 지나면 거짓', () => {
    expect(followActive({ follow: true }, 0)).toBe(true);
    expect(followActive({ followUntil: 1000 }, 999)).toBe(true);
    expect(followActive({ followUntil: 1000 }, 1000)).toBe(false);
    expect(followActive({}, 0)).toBe(false);
    expect(followActive(null, 0)).toBe(false);
  });
});

// 설계 2026-09-29 §8: 첫 화면만 화각 45°(시안 카메라 fov 1.2·H ≈ 45.2°). 차트 장면은 판 px ↔ 월드 대응이
// CHART_FOV에 묶여 있어 그대로 40°, 나머지 장면도 지금 구도를 지키려고 40°
describe('화각(fov)', () => {
  it('hero만 HERO_FOV(45°), 나머지는 CHART_FOV', () => {
    expect(HERO_FOV).toBe(45);
    for (const k of KEYS) expect(SCENES[k].fov, k).toBe(k === 'hero' ? HERO_FOV : CHART_FOV);
    expect(sceneFor('hero', 0.5, true).fov).toBe(HERO_FOV);
    expect(sceneFor('chartCurve', 0, true).fov).toBe(CHART_FOV);
  });
  it('전환 중에는 화각도 섞인다', () => {
    expect(blendScenes(SCENES.hero, SCENES.about, 0.5).fov).toBeCloseTo((HERO_FOV + CHART_FOV) / 2, 9);
  });
});

describe('horizonFrac', () => {
  it('수평으로 보면 화면 가운데, 내려다보면 위로 올라간다', () => {
    expect(horizonFrac([0, 1, 0], [0, 1, -10], 45)).toBeCloseTo(0.5, 9);
    expect(horizonFrac([0, 1, 0], [0, 0, -10], 45)).toBeLessThan(0.5);
    expect(horizonFrac([0, 1, 0], [0, 2, -10], 45)).toBeGreaterThan(0.5);
  });
  // 시안: A는 pitch 0.085·가운데 0.5 → 지평선 39.8%, B는 pitch −0.03·가운데 0.33 → 36.6%(fov 1.2·H)
  it('공항 카메라 A·B의 지평선이 시안과 같은 높이(45°에서 39.8% / 36.6%)', () => {
    expect(horizonFrac(AIRPORT_CAM.a.camera, AIRPORT_CAM.a.target, HERO_FOV)).toBeCloseTo(0.398, 3);
    expect(horizonFrac(AIRPORT_CAM.b.camera, AIRPORT_CAM.b.target, HERO_FOV)).toBeCloseTo(0.366, 3);
  });
});

describe('이륙 비행기 진행도(plane)', () => {
  // 계획 9-3: 시계 끝은 신호 단계까지(SIGNAL.end) — 3D가 ①·②에서 켜져도 U자가 완성된 채로 보인다
  it('첫 화면은 0(서 있음), 그 밖 장면은 끝(SIGNAL.end, 다 흩어지고 U자 완성)', () => {
    expect(sceneFor('hero', 0.5, false).plane).toBe(0);
    for (const k of Object.keys(SCENES) as (keyof typeof SCENES)[]) if (k !== 'hero') expect(sceneFor(k, 0, false).plane).toBe(SIGNAL.end);
  });
});

// 첫 화면 → ① 장면 고르기(계획 6-6): 여백(hero-runway)이 있으면 활성 섹션이 아니라 비행기 시계로 고른다
describe('pickScene', () => {
  const base = { portrait: false, heroScroll: 0, intro: true };
  it('활성 섹션이 ①인데 시계가 아직 내려앉는 중(p < 0.3)이면 공항 내려앉기', () => {
    const s = pickScene({ ...base, active: { key: 'about', progress: 0.4 }, plane: 0.1, h: 0 });
    expect(s).toEqual(sceneFor('hero', runwayPhases(0.1).land, false));
  });
  it('맨 위(활성 hero)인데 시계가 아직 ①(1)이면 머리말 장면', () => {
    const s = pickScene({ ...base, active: { key: 'hero', progress: 0.5 }, plane: 1, h: 1 });
    expect(s).toEqual(introScene(false));
  });
  it('시계가 ①이고 활성 섹션도 ①이면 그 진행도', () => {
    const s = pickScene({ ...base, active: { key: 'about', progress: 0.7 }, plane: 1, h: 1 });
    expect(s).toEqual(sceneFor('about', 0.7, false));
  });
  it('전환 도중(0 < h < 1)이면 공항 끝과 ① 처음을 섞고 follow', () => {
    const s = pickScene({ ...base, active: null, plane: 0.6, h: 0.5 });
    expect(s).toEqual({ ...blendScenes(sceneFor('hero', 1, false), introScene(false), 0.5), follow: true });
  });
  it('차트 장면(①보다 뒤)은 보통 길 — 활성 섹션 진행도 그대로', () => {
    const s = pickScene({ ...base, active: { key: 'chartDepart', progress: 0.3 }, plane: 1, h: 1 });
    expect(s).toEqual(sceneFor('chartDepart', 0.3, false));
  });
  it('여백이 없으면(plane −1) 첫 화면은 스크롤 내려앉기(heroScroll)', () => {
    const s = pickScene({ ...base, heroScroll: 0.4, active: { key: 'hero', progress: 0.5 }, plane: -1, h: -1 });
    expect(s).toEqual(sceneFor('hero', 0.4, false));
  });
  it('활성 섹션도 전환도 여백도 없으면 null(장면을 바꾸지 않는다)', () => {
    expect(pickScene({ ...base, active: null, plane: -1, h: -1 })).toBeNull();
  });
  it('머리말 틈(① 위)에서 활성 섹션이 없으면 시계로 머리말 장면', () => {
    expect(pickScene({ ...base, active: null, plane: 1.4, h: 1 })).toEqual(introScene(false));
  });
  it('① 아래 틈(섹션 사이 여백·제목)에서는 여백이 있어도 null — 머리말 장면으로 되돌아가지 않는다', () => {
    expect(pickScene({ ...base, intro: false, active: null, plane: 1, h: 1 })).toBeNull();
  });
});
