# 계획 5-1: 페이지 구조 개편 · 데이터 · 플립 보드 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 홈 화면을 `첫 화면 → ① PROJECT → ② DATA → ③ FEATURES → ④ CHARTS → 데모 → 연락처` 순서로 바꾸고, ②에 공항 플립 보드를, 옆에 섹션 번호 목차를 넣는다. 3D는 기존 장면을 새 섹션에 연결만 한다(점 → 차트는 계획 5-2, 인터랙션은 계획 5-3).

**Architecture:** 섹션 목록(`src/lib/sections.ts`) 한 곳이 순서·머리표 번호·옆 목차를 만든다. 3D 장면은 요소의 `data-scene` 속성으로 고른다(기존 `data-section`/`data-chapter` 대체). 플립 보드는 서버가 완성된 글자로 그리고, 지연 로딩되는 연출 모듈(`run.ts` → `board.ts`)이 화면에 들어올 때 글자를 넘긴다. 새 수치(노선별 행 수, 수집 일수·개월 수, 피처 그룹)는 `export_facts.py`가 `facts.json`에 넣는다.

**Tech Stack:** Next.js 16(App Router, 정적 export), React 19, TypeScript, zod, vitest, Playwright, Python 3.11(pandas, pytest).

**설계 문서:** `docs/superpowers/specs/2026-09-25-page-restructure-design.md` (이 계획은 §2, §2.1, §3.1~3.3, §3.4의 글·장면 연결, §5의 facts 항목, §6을 구현한다)

---

## 공통 규칙 (모든 태스크)

- **코드 주석**: 한국어. 파일마다 맨 위에 무엇을 하는 파일인지 한두 줄, 이유가 드러나지 않는 로직에는 "왜"를 적는다. 코드를 한 줄씩 옮겨 적는 주석은 달지 않는다.
- **문구**: 문장은 `content/{ko,en,ja}.json`에만, 수치는 `data/facts.json`에만. 문구에 숫자를 직접 쓰면 `tests/unit/content.test.ts`가 실패한다(자리표시 `{data.routes}` 등을 쓴다). 세 파일의 키가 같아야 한다.
- **초기 JS 150KB**: `lib/content`·`lib/facts`·zod·gsap·lenis를 클라이언트 파일이 정적 import하면 `tests/unit/client-imports.test.ts`가 실패한다.
- **커밋**: 브랜치 `feat/page-restructure`(이미 있음)에서. 메시지 끝에 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. 커밋 이메일은 noreply(`git config user.email` 확인).
- 명령은 저장소 루트(`~/dev/untitled folder/signal-ml-portfolio`, 맥미니는 `~/dev/signal-ml-portfolio`)에서 실행한다.

## 이 계획에서 3D 장면 연결 (임시, 계획 5-2에서 바뀜)

| 요소 | `data-scene` | 이유 |
|---|---|---|
| 첫 화면 `#hero` | `hero` | 그대로 |
| ① `#project` | `about` | 기존 소개 자리의 비스듬한 지형 |
| ② `#data` | `problem` | 한·일 지도 + 노선 궤적(설계 §3.2) |
| ③ `#features` | `validation` | 위에서 내려다본 지형(덩어리는 5-2) |
| ④ 차트 1 출발일별 가격 | `limits` | 멀리서 본 지형(차트는 5-2) |
| ④ 차트 2 U자 곡선 | `insight` | 기존 U자 곡선 장면 |
| ④ 차트 3 R² 거품 | `bubble` | 기존 떨어지는 점 |
| ④ 검증 글 | `validation` | 기존 |
| ④ 차트 4 예측 구간 | `interval` | 기존 띠 |
| ④ 한계 글 | `limits` | 기존 |
| 데모 `#demo`, 연락처 `#contact` | `demo`, `contact` | 그대로 |

`SceneKey`의 `about`·`stack` 등 이름은 이 계획에서 바꾸지 않는다(내부 이름, 5-2에서 정리).

## 파일 구조

| 파일 | 할 일 |
|---|---|
| `scripts/export_facts.py` / `scripts/tests/test_export_facts.py` | 수정: `byRoute`, `collectDays`, `collectMonths`, 피처 그룹 검사·`featureCount` |
| `scripts/model_metrics.json` | 수정: `featureGroups`(gain) 추가 |
| `data/facts.json` | 재생성 + `codeLinks.paths.features` 추가 |
| `src/lib/facts.ts` / `tests/unit/facts.test.ts` | 수정: 스키마 |
| `src/lib/sections.ts` / `tests/unit/sections.test.ts` | 새로: 섹션 목록 |
| `src/three/activeScene.ts` / `tests/unit/three-active.test.ts` | 수정: `data-scene` |
| `content/{ko,en,ja}.json` | 수정: 키 이동·추가·삭제 |
| `src/components/sections/Project.tsx` | 새로: ① |
| `src/components/sections/DataSection.tsx` | 새로: ② |
| `src/components/sections/DepartureBoard.tsx` | 새로: 플립 보드 마크업 |
| `src/motion/board.ts` / `tests/unit/board.test.ts` | 새로: 보드 연출 |
| `src/motion/run.ts` | 수정: 보드 연출 연결 |
| `src/components/sections/Features.tsx` | 새로: ③(이번엔 글 목록) |
| `src/components/sections/Charts.tsx` | 새로: ④(CaseStudy 대체) |
| `src/components/sections/Contact.tsx` | 수정: 개인 소개 이동 |
| `src/components/SideNav.tsx` | 새로: 옆 목차 |
| `src/components/HomePage.tsx` | 수정: 섹션 목록으로 조립 |
| `src/components/sections/{Hero,Demo}.tsx`, `ValidationTable.tsx` | 수정: `data-scene`, 문구 키 |
| `src/components/sections/{About,CaseStudy,Stack}.tsx` | 삭제 |
| `src/styles/globals.css` | 수정: 새 섹션·보드·옆 목차 |
| `tests/e2e/{site,motion,terrain}.spec.ts` | 수정: 새 구조 |
| `tests/e2e/board.spec.ts` | 새로: 보드·옆 목차 |
| `CLAUDE.md` | 수정: 페이지 구성·상태 |

---

### Task 1: facts에 노선별 행 수·수집 일수·피처 그룹 넣기

**Files:**
- Modify: `scripts/export_facts.py`
- Modify: `scripts/model_metrics.json`
- Modify: `scripts/tests/test_export_facts.py`
- Modify: `data/facts.json` (스크립트로 재생성 + 손으로 `codeLinks.paths.features`)

- [ ] **Step 1: 실패하는 테스트 쓰기** — `scripts/tests/test_export_facts.py`의 `test_counts_filters_and_cutoff` 끝에 단언을 더하고, 피처 그룹 테스트 두 개를 파일 끝에 더한다.

`test_counts_filters_and_cutoff`의 마지막 `assert stats["routes"] == 1` 아래에:

```python
    # 왕복을 한 줄로 합친 노선별 행 수(ICN이 앞). 합은 filteredRows와 같다
    assert stats["byRoute"] == [{"pair": "ICN_NRT", "rows": 2}]
    assert stats["collectDays"] == 1
    assert stats["collectMonths"] == 0
```

파일 끝에:

```python
def test_by_route_merges_both_directions_and_sorts_by_rows():
    raw = frame([
        row("2026-04-23 10:00:00"),
        row("2026-04-23 11:00:00", o="NRT", d="ICN"),
        row("2026-09-22 12:00:00", o="ICN", d="KIX"),
    ])
    stats = ef.compute_data_stats(raw, "2026-09-22")
    assert stats["byRoute"] == [{"pair": "ICN_NRT", "rows": 2}, {"pair": "ICN_KIX", "rows": 1}]
    assert sum(r["rows"] for r in stats["byRoute"]) == stats["filteredRows"]
    assert stats["collectDays"] == 153
    assert stats["collectMonths"] == 5


def test_feature_groups_must_cover_model_features_exactly():
    model_features = ["a", "b", "c"]
    good = [{"id": "x", "gain": 60.0, "features": ["a", "b"]}, {"id": "y", "gain": 40.0, "features": ["c"]}]
    assert ef.check_feature_groups(good, model_features) == 3
    with pytest.raises(SystemExit, match="c"):
        ef.check_feature_groups([{"id": "x", "gain": 100.0, "features": ["a", "b"]}], model_features)
    with pytest.raises(SystemExit, match="z"):
        ef.check_feature_groups(good + [{"id": "z", "gain": 0.0, "features": ["z"]}], model_features)
```

- [ ] **Step 2: 실패 확인**

Run: `npm run pytest`
Expected: FAIL — `KeyError: 'byRoute'`, `AttributeError: module 'export_facts' has no attribute 'check_feature_groups'`

- [ ] **Step 3: 구현** — `scripts/export_facts.py`

`compute_data_stats`의 `return {...}` 바로 위에 추가하고 반환 dict에 세 키를 더한다:

```python
    # ② 플립 보드용(설계 2026-09-25 §3.2): 왕복을 한 줄로 합친다. 모든 노선이 인천 출발·도착이라
    # 인천(ICN)을 앞에 둔 이름으로 묶고, 행 수가 많은 노선부터 보여 준다
    pair = [f"ICN_{d if o == 'ICN' else o}" for o, d in zip(df["origin"].astype(str), df["destination"].astype(str))]
    by_route = pd.Series(pair).value_counts()
    days = (fetch.max().normalize() - fetch.min().normalize()).days + 1
```

반환 dict 끝에:

```python
        "byRoute": [{"pair": p, "rows": int(n)} for p, n in by_route.items()],
        "collectDays": int(days),
        # ① 숫자판의 "5개월". 30.4일(평균 한 달)로 나눠 반올림한다
        "collectMonths": int(round(days / 30.4)),
```

`value_counts()`는 많은 순으로 정렬하고, 같은 수이면 먼저 나온 순서다(테스트의 두 노선은 수가 달라 순서가 정해진다).

`check_snapshot` 아래에 새 함수:

```python
def model_feature_names() -> list[str]:
    """서비스 모델(V2Predictor)이 실제로 쓰는 피처 33개. 항공권 저장소의 상수를 그대로 모은다."""
    from src.models.lookup_features import LOOKUP_FEATURES  # 기본 구성 A_rah
    from src.processing.features import (
        BASE_NUMERIC_FEATURES, CATEGORICAL_FEATURES, DAYS_DERIVED_FEATURES,
        JP_HOLIDAY_FEATURES, KR_HOLIDAY_FEATURES, MARKET_FEATURES,
    )
    return (BASE_NUMERIC_FEATURES + DAYS_DERIVED_FEATURES + KR_HOLIDAY_FEATURES + JP_HOLIDAY_FEATURES
            + MARKET_FEATURES + CATEGORICAL_FEATURES + list(LOOKUP_FEATURES))


def check_feature_groups(groups: list[dict], model_features: list[str]) -> int:
    # ③ 피처 섹션의 그룹 목록(model_metrics.json, 손으로 옮긴 값)이 모델 피처와 정확히 같은지 확인한다.
    # 재학습으로 피처가 늘거나 줄었는데 목록을 안 고치면 사이트의 "33 FEATURES"가 틀리므로 여기서 멈춘다
    listed = [f for g in groups for f in g["features"]]
    missing = sorted(set(model_features) - set(listed))
    extra = sorted(set(listed) - set(model_features))
    if missing or extra or len(listed) != len(set(listed)):
        raise SystemExit(f"피처 그룹 불일치 — 빠짐 {missing}, 모델에 없음 {extra}. scripts/model_metrics.json의 featureGroups를 고친다.")
    return len(listed)
```

`main()`에서 `check_snapshot(data, meta)` 다음 줄에:

```python
    metrics["featureCount"] = check_feature_groups(metrics["featureGroups"], model_feature_names())
```

- [ ] **Step 4: `scripts/model_metrics.json`에 그룹 추가** — `"curveWidth": 16,` 다음 줄에 넣는다(gain은 항공권 저장소 CLAUDE.md "피처 중요도·SHAP", 2026-09-23 서비스 pkl A_rah 기준):

```json
  "featureGroups": [
    { "id": "lookup", "gain": 46.8, "features": ["rd_med", "rd_min", "rd_max", "rd_std", "rah_med", "rah_std", "ra_med", "ra_std", "rm_med", "rm_std", "r_med", "r_std", "global_med"] },
    { "id": "categorical", "gain": 26.0, "features": ["origin", "destination", "route", "airline", "airline_class"] },
    { "id": "holiday", "gain": 11.4, "features": ["is_kr_holiday", "is_kr_near_holiday", "is_jp_holiday", "is_jp_near_holiday"] },
    { "id": "days", "gain": 6.8, "features": ["days_to_departure", "log_days", "days_sq", "days_bucket_num"] },
    { "id": "flight", "gain": 4.6, "features": ["stops", "duration_minutes", "departure_hour", "is_weekend_flight", "departure_month"] },
    { "id": "market", "gain": 1.2, "features": ["krw_jpy_rate", "fuel_tier"] }
  ],
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npm run pytest`
Expected: PASS (모든 테스트)

- [ ] **Step 6: facts.json 재생성** — 항공권 저장소가 필요하다. iCloud 워밍(항공권 저장소 CLAUDE.md "iCloud 동기화 I/O 병목")을 먼저 한다.

```bash
cd ~/Documents/airfare-forecasting-ml && find src data -type f \( -name "*.py" -o -name "*.csv" \) -print0 | xargs -0 -n 40 -P 16 cat > /dev/null; cd -
npm run facts
```

Expected: `facts.json 갱신: 2026-09-22, 242,874행`. 오류 `피처 그룹 불일치`가 나면 메시지의 피처 이름으로 `model_metrics.json`을 고친다(목록은 `features.py`·`lookup_features.py`가 원본).

`git diff data/facts.json`으로 `data.byRoute`(3개, 합 242,874), `collectDays`(153), `collectMonths`(5), `model.featureGroups`, `model.featureCount`(33)가 생겼는지 본다. 수집 끝 날짜는 `collectEnd: 2026-09-22` 그대로여야 한다(원본 CSV의 09-23 행은 기준일 자르기로 빠진다 — 설계 §5의 날짜 확인은 이것으로 끝).

- [ ] **Step 7: 코드 링크 경로 추가** — `data/facts.json`의 `codeLinks.paths`에 한 줄(스크립트가 건드리지 않는 영역이라 손으로):

```json
      "features": "blob/main/src/processing/features.py",
```

(`"limits": ...` 줄 앞에 넣고 쉼표를 맞춘다.)

- [ ] **Step 8: 커밋**

```bash
git add scripts/export_facts.py scripts/model_metrics.json scripts/tests/test_export_facts.py data/facts.json
git commit -m "feat(data): per-route rows, collection days, feature groups in facts

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: facts 스키마

**Files:**
- Modify: `src/lib/facts.ts`
- Test: `tests/unit/facts.test.ts`

- [ ] **Step 1: 실패하는 테스트** — `tests/unit/facts.test.ts`의 `describe` 안 끝에:

```ts
  it('노선별 행 수의 합은 필터 후 행 수와 같다(플립 보드 TOTAL)', () => {
    expect(facts.data.byRoute.map((r) => r.pair)).toEqual(['ICN_NRT', 'ICN_KIX', 'ICN_HND']);
    expect(facts.data.byRoute.reduce((s, r) => s + r.rows, 0)).toBe(facts.data.filteredRows);
  });

  it('피처 그룹의 피처 수 합이 featureCount다', () => {
    expect(facts.model.featureGroups.map((g) => g.id)).toEqual(['lookup', 'categorical', 'holiday', 'days', 'flight', 'market']);
    expect(facts.model.featureGroups.reduce((s, g) => s + g.features.length, 0)).toBe(facts.model.featureCount);
  });

  it('피처 섹션 코드 링크', () => {
    expect(codeUrl('features')).toBe('https://github.com/hyde0395/airfare-forecasting-ml/blob/main/src/processing/features.py');
  });
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/unit/facts.test.ts`
Expected: FAIL — `facts.data.byRoute` 타입 오류/undefined

- [ ] **Step 3: 구현** — `src/lib/facts.ts`

`chapters` 줄을 바꾼다:

```ts
const chapters = ['problem', 'insight', 'bubble', 'validation', 'interval', 'limits', 'features'] as const;
```

`data: z.object({...})`의 `routes: z.number().int(),` 뒤에 더한다:

```ts
    // ② 플립 보드(설계 2026-09-25 §3.2): 왕복 합산, 행 수가 많은 순
    byRoute: z.array(z.object({ pair: z.enum(['ICN_NRT', 'ICN_KIX', 'ICN_HND']), rows: z.number().int() })).min(1),
    collectDays: z.number().int(), collectMonths: z.number().int(),
```

`model: z.object({...})`의 `bookingCurve: ...` 뒤에 더한다:

```ts
    // ③ 피처 섹션: 그룹별 XGBoost gain(%)과 피처 이름. 순서 = 화면 순서
    featureGroups: z.array(z.object({
      id: z.enum(['lookup', 'categorical', 'holiday', 'days', 'flight', 'market']),
      gain: z.number(), features: z.array(z.string()).min(1),
    })).length(6),
    featureCount: z.number().int(),
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run tests/unit/facts.test.ts && npm run typecheck`
Expected: PASS, 타입 오류 없음

- [ ] **Step 5: 커밋**

```bash
git add src/lib/facts.ts tests/unit/facts.test.ts
git commit -m "feat: facts schema for route rows and feature groups

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: 섹션 목록

**Files:**
- Create: `src/lib/sections.ts`
- Test: `tests/unit/sections.test.ts`

- [ ] **Step 1: 실패하는 테스트** — `tests/unit/sections.test.ts`

```ts
// 섹션 목록 검사: 순서대로 번호가 매겨지고, 머리표가 "NN — 이름" 모양이며, id가 겹치지 않는다.
import { describe, expect, it } from 'vitest';
import { eyebrow, sectionNumber, SECTIONS } from '@/lib/sections';

describe('섹션 목록', () => {
  it('설계 순서(①~④)', () => {
    expect(SECTIONS.map((s) => s.id)).toEqual(['project', 'data', 'features', 'charts']);
  });
  it('번호는 목록 순서로 두 자리', () => {
    expect(SECTIONS.map((s) => sectionNumber(s.id))).toEqual(['01', '02', '03', '04']);
  });
  it('머리표', () => {
    expect(eyebrow('data')).toBe('02 — DATA COLLECTION');
    expect(eyebrow('charts')).toBe('04 — CHARTS');
  });
  it('id가 겹치지 않는다', () => {
    expect(new Set(SECTIONS.map((s) => s.id)).size).toBe(SECTIONS.length);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/unit/sections.test.ts`
Expected: FAIL — `Cannot find module '@/lib/sections'`

- [ ] **Step 3: 구현** — `src/lib/sections.ts`

```ts
// 홈 화면 번호 섹션 목록(설계 2026-09-25 §2.1). 섹션을 더하려면 여기에 한 줄 + HomePage의 SECTION_VIEWS에
// 부품 한 줄 + content 문구 키. 머리표 번호(01, 02…)와 옆 목차는 이 목록 순서에서 저절로 만들어진다.
// 옆 목차(클라이언트)도 이 파일을 읽으므로 부품·문구·facts 모듈을 import하지 않는다(초기 JS).
export const SECTIONS = [
  { id: 'project', label: 'PROJECT' },
  { id: 'data', label: 'DATA COLLECTION' },
  { id: 'features', label: 'FEATURES' },
  { id: 'charts', label: 'CHARTS' },
] as const;

export type SectionId = (typeof SECTIONS)[number]['id'];

export function sectionNumber(id: SectionId): string {
  return String(SECTIONS.findIndex((s) => s.id === id) + 1).padStart(2, '0');
}

// 섹션 머리표(세 언어 공통 영어). 플립 글자판으로 넘어간다
export function eyebrow(id: SectionId): string {
  return `${sectionNumber(id)} — ${SECTIONS.find((s) => s.id === id)!.label}`;
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run tests/unit/sections.test.ts`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/lib/sections.ts tests/unit/sections.test.ts
git commit -m "feat: section registry with automatic numbering

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: 3D 장면을 `data-scene`으로 고르기

**Files:**
- Modify: `src/three/activeScene.ts:18-29`
- Modify: `src/components/sections/Hero.tsx:11`, `src/components/sections/Demo.tsx:12`, `src/components/sections/Contact.tsx:14`
- Test: `tests/unit/three-active.test.ts`

이 태스크 뒤 `CaseStudy`·`About`·`Stack`은 아직 옛 속성(`data-chapter`/`data-section`)이라 그 구간은 3D 장면이 바뀌지 않는다. Task 12에서 파일째 지운다. 그 사이 사이트는 동작한다(장면 없는 구간은 직전 장면 유지).

- [ ] **Step 1: 실패하는 테스트** — `tests/unit/three-active.test.ts` 끝에:

```ts
describe('readCandidates', () => {
  // DOM 없이 querySelectorAll·getBoundingClientRect만 흉내 낸다(vitest 환경이 node)
  const el = (scene: string, top: number, bottom: number) => ({ dataset: { scene }, getBoundingClientRect: () => ({ top, bottom }) });
  const doc = (els: unknown[], seen: string[] = []) => ({
    querySelectorAll: (sel: string) => { seen.push(sel); return els; },
  }) as unknown as Document;

  it('data-scene 요소를 후보로 읽는다', () => {
    const seen: string[] = [];
    expect(readCandidates(doc([el('about', 0, 900), el('insight', 100, 500)], seen))).toEqual([
      { key: 'about', top: 0, bottom: 900 },
      { key: 'insight', top: 100, bottom: 500 },
    ]);
    expect(seen).toEqual(['[data-scene]']);
  });

  it('장면 표에 없는 이름은 버린다', () => {
    expect(readCandidates(doc([el('bogus', 0, 900)]))).toEqual([]);
  });
});
```

파일 맨 위 import를 바꾼다:

```ts
import { pickActive, readCandidates } from '@/three/activeScene';
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/unit/three-active.test.ts`
Expected: FAIL — 선택자가 `[data-section], [data-chapter]`

- [ ] **Step 3: 구현** — `src/three/activeScene.ts`의 파일 머리 주석 둘째 줄과 `SECTION_KEYS`~`readCandidates` 전체를 바꾼다.

머리 주석(1~2줄)을:

```ts
// 활성 장면 고르기: 뷰포트 세로 중앙에 걸린 [data-scene] 요소를 찾는다. 차트 블록은 섹션 안에
// 있으므로 "중앙을 포함하는 것 중 가장 짧은 요소"를 고르면 자연스럽게 안쪽 블록이 이긴다.
```

import에 `SCENES`를 더한다:

```ts
import { SCENES, type SceneKey } from './scenes';
```

`const SECTION_KEYS ...`부터 파일 끝까지를:

```ts
// 섹션·블록은 자기 장면 이름을 data-scene으로 적는다(설계 2026-09-25 §4). 섹션 id와 장면 이름을 떼어 두어
// 섹션을 더하거나 한 섹션 안에서 장면을 여러 번 바꿔도 이 파일은 그대로다
export function readCandidates(doc: Document): Candidate[] {
  const out: Candidate[] = [];
  doc.querySelectorAll<HTMLElement>('[data-scene]').forEach((el) => {
    const key = el.dataset.scene;
    if (!key || !(key in SCENES)) return; // 장면 표에 없는 이름이면 sceneFor가 터지므로 버린다
    const r = el.getBoundingClientRect();
    out.push({ key: key as SceneKey, top: r.top, bottom: r.bottom });
  });
  return out;
}
```

- [ ] **Step 4: 섹션 속성 바꾸기** — 세 파일에서 `data-section="…"`을 `data-scene="…"`으로(값 그대로):

- `src/components/sections/Hero.tsx`: `data-section="hero"` → `data-scene="hero"`, 머리 주석의 "data-section 속성은 … 참조할 자리다." 문장을 "data-scene 속성으로 3D 장면(hero)을 고른다."로.
- `src/components/sections/Demo.tsx`: `data-section="demo"` → `data-scene="demo"`
- `src/components/sections/Contact.tsx`: `data-section="contact"` → `data-scene="contact"`

- [ ] **Step 5: 통과 확인**

Run: `npx vitest run tests/unit/three-active.test.ts && npm run typecheck`
Expected: PASS

- [ ] **Step 6: 커밋**

```bash
git add src/three/activeScene.ts tests/unit/three-active.test.ts src/components/sections/Hero.tsx src/components/sections/Demo.tsx src/components/sections/Contact.tsx
git commit -m "refactor: pick 3D scene from data-scene attributes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: 문구 키 옮기기·추가하기 (옛 키는 Task 12에서 삭제)

**Files:**
- Modify: `content/ko.json`, `content/en.json`, `content/ja.json`

옛 섹션(About/CaseStudy/Stack)이 아직 옛 키를 쓰므로 이 태스크는 **복사·추가만** 한다. 한 번만 돌리는 파이썬 스크립트로 세 파일을 같이 고친다(스크립트는 커밋하지 않는다).

- [ ] **Step 1: 스크립트 작성** — 임시 파일 `/tmp/migrate_content.py`(scratchpad 아무 곳이나):

```python
# content/{ko,en,ja}.json에 새 섹션 키를 더한다(설계 2026-09-25 §6). 옛 키는 지우지 않는다(계획 5-1 Task 12).
import copy, json, pathlib

ROOT = pathlib.Path("content")
NEW = {
  "ko": {
    "nav.sections": "섹션 목차",
    "project.body": "인천과 도쿄·오사카를 오가는 항공권 가격을 매일 모아, 출발일별 가격과 지금 살지 기다릴지를 예측했습니다.",
    "project.stats.routes.value": "{data.routes}", "project.stats.routes.label": "노선",
    "project.stats.period.value": "{data.collectMonths}개월", "project.stats.period.label": "매일 자동 수집",
    "project.stats.features.value": "{model.featureCount}", "project.stats.features.label": "피처",
    "project.stats.interval.value": "{model.interval.level}%", "project.stats.interval.label": "예측 구간",
    "data.heading": "수집한 데이터",
    "data.steps.collect": "SerpApi · Google Flights 검색 결과",
    "data.steps.schedule": "GitHub Actions · 매일(먼 출발일은 매주)",
    "data.steps.filter": "무결성·직항 확인 · {data.rawRows}행 → {data.filteredRows}행",
    "data.steps.join": "원/엔 환율 · 한·일 공휴일 · 유가",
    "data.board.sub": "수집 현황", "data.board.caption": "노선별 수집 현황(왕복 합계)",
    "data.board.route": "노선", "data.board.destination": "목적지", "data.board.rows": "수집 행", "data.board.status": "상태",
    "data.board.daily": "매일 수집", "data.board.total": "합계",
    "data.tools": "Python · requests · tenacity · yfinance · workalendar",
    "features.heading": "{model.featureCount} FEATURES",
    "features.lead": "가격 하나를 예측하기 위해 넣은 것들입니다. 숫자는 모델 안에서 각 그룹이 차지한 중요도(XGBoost gain)입니다.",
    "features.unit": "개",
    "features.groups.lookup": "lookup 통계", "features.groups.categorical": "노선·항공사", "features.groups.holiday": "공휴일",
    "features.groups.days": "출발까지 남은 일수", "features.groups.flight": "항공편 정보", "features.groups.market": "시장",
    "features.lookupNote": "lookup 중요도는 노선·항공사 정보를 나눠 가진 몫이라 실제보다 크게 나옵니다. 처음 보는 출발일에서는 이 통계가 기본값으로 떨어지는데, 이것을 검증 단계에서 찾았습니다.",
    "charts.heading": "데이터가 보여 준 것",
    "charts.depart.heading": "출발일별 가격",
    "charts.curve.heading": "U자 예약 곡선",
  },
  "en": {
    "nav.sections": "Sections",
    "project.body": "I collected airfares between Incheon and Tokyo/Osaka every day and built a model that forecasts prices by departure date and whether to buy now or wait.",
    "project.stats.routes.value": "{data.routes}", "project.stats.routes.label": "routes",
    "project.stats.period.value": "{data.collectMonths} months", "project.stats.period.label": "of daily collection",
    "project.stats.features.value": "{model.featureCount}", "project.stats.features.label": "features",
    "project.stats.interval.value": "{model.interval.level}%", "project.stats.interval.label": "prediction interval",
    "data.heading": "The data",
    "data.steps.collect": "SerpApi · Google Flights search results",
    "data.steps.schedule": "GitHub Actions · daily (weekly for far-off dates)",
    "data.steps.filter": "Integrity and nonstop checks · {data.rawRows} → {data.filteredRows} rows",
    "data.steps.join": "KRW/JPY rate · Korea/Japan holidays · oil price",
    "data.board.sub": "Collection status", "data.board.caption": "Rows collected per route (both directions)",
    "data.board.route": "Route", "data.board.destination": "Destination", "data.board.rows": "Rows", "data.board.status": "Status",
    "data.board.daily": "Collected daily", "data.board.total": "Total",
    "data.tools": "Python · requests · tenacity · yfinance · workalendar",
    "features.heading": "{model.featureCount} FEATURES",
    "features.lead": "What goes into predicting a single price. Percentages are each group's share of importance in the model (XGBoost gain).",
    "features.unit": "features",
    "features.groups.lookup": "Lookup statistics", "features.groups.categorical": "Route & airline", "features.groups.holiday": "Holidays",
    "features.groups.days": "Days to departure", "features.groups.flight": "Flight details", "features.groups.market": "Market",
    "features.lookupNote": "Lookup importance is inflated because it shares route and airline information. On unseen departure dates these statistics fall back to defaults — something the validation step uncovered.",
    "charts.heading": "What the data showed",
    "charts.depart.heading": "Price by departure date",
    "charts.curve.heading": "The U-shaped booking curve",
  },
  "ja": {
    "nav.sections": "セクション目次",
    "project.body": "仁川と東京・大阪を結ぶ航空券の価格を毎日集め、出発日ごとの価格と「今買うか待つか」を予測しました。",
    "project.stats.routes.value": "{data.routes}", "project.stats.routes.label": "路線",
    "project.stats.period.value": "{data.collectMonths}か月", "project.stats.period.label": "毎日自動収集",
    "project.stats.features.value": "{model.featureCount}", "project.stats.features.label": "特徴量",
    "project.stats.interval.value": "{model.interval.level}%", "project.stats.interval.label": "予測区間",
    "data.heading": "集めたデータ",
    "data.steps.collect": "SerpApi · Google Flights の検索結果",
    "data.steps.schedule": "GitHub Actions · 毎日(遠い出発日は毎週)",
    "data.steps.filter": "整合性・直行便チェック · {data.rawRows}行 → {data.filteredRows}行",
    "data.steps.join": "ウォン/円レート · 日韓の祝日 · 原油価格",
    "data.board.sub": "収集状況", "data.board.caption": "路線別の収集状況(往復合計)",
    "data.board.route": "路線", "data.board.destination": "目的地", "data.board.rows": "収集行数", "data.board.status": "状態",
    "data.board.daily": "毎日収集", "data.board.total": "合計",
    "data.tools": "Python · requests · tenacity · yfinance · workalendar",
    "features.heading": "{model.featureCount} FEATURES",
    "features.lead": "一つの価格を予測するために入れたものです。数字はモデル内で各グループが占める重要度(XGBoost gain)です。",
    "features.unit": "個",
    "features.groups.lookup": "lookup 統計", "features.groups.categorical": "路線・航空会社", "features.groups.holiday": "祝日",
    "features.groups.days": "出発までの日数", "features.groups.flight": "便の情報", "features.groups.market": "市場",
    "features.lookupNote": "lookup の重要度は路線・航空会社の情報を分け合った分だけ実際より大きく出ます。初めて見る出発日ではこの統計が既定値に落ちることを、検証の段階で見つけました。",
    "charts.heading": "データが示したこと",
    "charts.depart.heading": "出発日別の価格",
    "charts.curve.heading": "U字型の予約カーブ",
  },
}

def put(d, dotted, value):
    *parents, last = dotted.split(".")
    for p in parents:
        d = d.setdefault(p, {})
    d[last] = value

for lang, new in NEW.items():
    path = ROOT / f"{lang}.json"
    d = json.loads(path.read_text(encoding="utf-8"))
    c = d["case"]
    # 옛 문구를 새 자리로 복사(원래 자리는 Task 12에서 지움)
    put(d, "project.heading", c["heading"])
    put(d, "data.body1", c["problem"]["body1"])
    put(d, "data.body2", c["problem"]["body2"])
    put(d, "data.sparse", c["problem"]["body3"])
    put(d, "features.model", d["stack"]["model"]["body"])
    put(d, "features.serve", d["stack"]["serve"]["body"])
    put(d, "common.codeLink", c["codeLink"])
    put(d, "charts.depart.body1", c["insight"]["body2"])
    put(d, "charts.curve.body1", c["insight"]["body1"])
    for src, dst in [("bubble", "bubble"), ("validation", "validation"), ("interval", "band"), ("limits", "limits")]:
        put(d, f"charts.{dst}", copy.deepcopy(c[src]))
    put(d, "contact.about", copy.deepcopy(d["about"]))
    for k, v in new.items():
        put(d, k, v)
    path.write_text(json.dumps(d, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(lang, "ok")
```

- [ ] **Step 2: 들여쓰기 확인 후 실행** — 기존 파일이 몇 칸 들여쓰기인지 보고(`head -3 content/ko.json`) 스크립트의 `indent=1`을 같은 값으로 맞춘 뒤:

Run: `python3 /tmp/migrate_content.py`
Expected: `ko ok` / `en ok` / `ja ok`

- [ ] **Step 3: 문구 테스트**

Run: `npx vitest run tests/unit/content.test.ts`
Expected: PASS (세 언어 키 일치, 자리표시 해석, 숫자 직접 기입 없음)

- [ ] **Step 4: 커밋**

```bash
git add content/ko.json content/en.json content/ja.json
git commit -m "content: keys for project, data, features, charts sections

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: ① PROJECT 섹션

**Files:**
- Create: `src/components/sections/Project.tsx`
- Modify: `src/styles/globals.css` (끝에 추가)

- [ ] **Step 1: 부품** — `src/components/sections/Project.tsx`

```tsx
// ① 프로젝트 소개(설계 2026-09-25 §3.1): 큰 질문 + 설명 두 줄 + 숫자 4개. 배경은 첫 화면 지형이 이어진다.
import { getT } from '@/lib/content';
import type { Locale } from '@/lib/i18n';
import { eyebrow } from '@/lib/sections';

// content/*.json의 project.stats.<키>.value/label과 순서를 맞춘다
const STATS = ['routes', 'period', 'features', 'interval'] as const;

export function Project({ locale }: { locale: Locale }) {
  const t = getT(locale);
  return (
    <section id="project" data-scene="about" className="wrap project" aria-labelledby="project-h">
      <div className="text-scrim">
        <p className="eyebrow" data-flip-on-enter>{eyebrow('project')}</p>
        <h2 id="project-h" className="display project-q" data-reveal>{t('project.heading')}</h2>
        <p className="project-lead">{t('project.body')}</p>
        <dl className="project-stats">
          {STATS.map((k) => (
            // 숫자를 위에, 이름을 아래에 보이도록 CSS(column-reverse)로 뒤집는다. 읽는 순서는 이름 → 숫자
            <div key={k}><dt>{t(`project.stats.${k}.label`)}</dt><dd className="mono">{t(`project.stats.${k}.value`)}</dd></div>
          ))}
        </dl>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: 스타일** — `src/styles/globals.css` 끝에:

```css
/* ① PROJECT(설계 2026-09-25 §3.1): 큰 질문, 설명, 호박색 숫자 4개 */
.project { min-height: 80vh; display: flex; flex-direction: column; justify-content: center; }
.project-q { font-size: clamp(2.2rem, 6vw, 4.75rem); max-width: 16ch; word-break: keep-all; text-transform: none; }
.project-lead { font-size: clamp(1.05rem, 1.8vw, 1.2rem); max-width: 40ch; color: var(--mute); }
.project-stats { display: flex; flex-wrap: wrap; gap: 40px; margin-top: 32px; }
.project-stats div { display: flex; flex-direction: column-reverse; }
.project-stats dd { font-size: clamp(2rem, 4vw, 2.75rem); font-weight: 600; color: var(--amb); line-height: 1.1; }
.project-stats dt { font-size: 0.85rem; color: var(--mute); }
@media (max-width: 640px) { .project-stats { gap: 24px; } }
```

(`.project-q`의 `text-transform: none`: `display` 클래스가 대문자로 바꾸는데, 영어 질문 문장은 대문자로 두면 읽기 어렵다.)

- [ ] **Step 3: 타입 확인**

Run: `npm run typecheck`
Expected: 오류 없음 (아직 화면에 연결 안 됨 — Task 12)

- [ ] **Step 4: 커밋**

```bash
git add src/components/sections/Project.tsx src/styles/globals.css
git commit -m "feat: project section (question + four figures)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: 플립 보드 연출 모듈

**Files:**
- Create: `src/motion/board.ts`
- Test: `tests/unit/board.test.ts`

- [ ] **Step 1: 실패하는 테스트** — `tests/unit/board.test.ts`

```ts
// 플립 보드 글자 순서 검사: 정해진 순서로만 한 칸씩 넘어가고, 최대 횟수를 넘지 않으며, 전체 약 2초 안에 끝난다.
import { describe, expect, it } from 'vitest';
import { BOARD, boardDurationMs, flipPath, SEQ } from '@/motion/board';

describe('flipPath', () => {
  it('빈칸이면 넘기지 않는다', () => expect(flipPath(' ')).toEqual([' ']));
  it('가까운 글자는 빈칸부터 순서대로', () => expect(flipPath('C')).toEqual([' ', 'A', 'B', 'C']));
  it('먼 글자는 최대 횟수 앞에서 출발한다', () => {
    const p = flipPath('9');
    expect(p).toHaveLength(BOARD.maxFlips + 1);
    expect(p.at(-1)).toBe('9');
  });
  it('이어지는 두 글자는 순서표에서 바로 옆이다', () => {
    for (const target of ['⇄', ',', 'Y', '0']) {
      const p = flipPath(target);
      for (let i = 1; i < p.length; i++) expect(SEQ.indexOf(p[i])).toBe(SEQ.indexOf(p[i - 1]) + 1);
    }
  });
  it('순서표에 없는 글자는 그대로 둔다', () => expect(flipPath('→')).toEqual(['→']));
});

describe('boardDurationMs', () => {
  it('칸 100개여도 2초 안(프레임 여유 빼고)', () => expect(boardDurationMs(100)).toBeLessThanOrEqual(2000));
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/unit/board.test.ts`
Expected: FAIL — `Cannot find module '@/motion/board'`

- [ ] **Step 3: 구현** — `src/motion/board.ts`

```ts
// ② 플립 보드 연출(설계 2026-09-25 §3.2). 칸마다 위 날개(지금 글자)가 경첩에서 0→-90° 접히고, 아래 날개(다음 글자)가
// 90→0° 펴진다. 글자는 공항 보드처럼 정해진 순서로만 넘어간다.
// 이 보드만 기존 플립 규칙(글자당 40ms·0.8초·튕김 금지)의 예외다: 전체 약 2초, 펴질 때 살짝 튕김(사용자 승인 2026-09-25).
// run.ts가 불러오므로 움직임 줄이기에서는 아예 실행되지 않는다(서버가 그린 완성 글자가 그대로 보인다).
export const SEQ = ' ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789,.-⇄';
// 빈칸부터 모두 넘기면 숫자 칸이 40번 가까이 넘어가 5초를 넘긴다(시안 실측). 14번으로 잘라 약 2초
export const BOARD = { flipMs: 60, maxFlips: 14, staggerMs: 5 } as const;

export function flipPath(target: string, maxFlips: number = BOARD.maxFlips): string[] {
  const to = SEQ.indexOf(target);
  if (to < 0) return [target];
  return [...SEQ.slice(Math.max(0, to - maxFlips), to + 1)];
}

// 이론상 걸리는 시간(가장 늦게 시작하는 칸이 최대 횟수를 넘길 때). 실제로는 프레임 경계만큼 조금 더 걸린다
export function boardDurationMs(cells: number): number {
  return BOARD.maxFlips * BOARD.flipMs + BOARD.staggerMs * Math.max(0, cells - 1);
}

type Halves = { top: HTMLElement; bot: HTMLElement; fold: HTMLElement; unfold: HTMLElement };

function halves(flap: HTMLElement): Halves {
  const [top, bot, fold, unfold] = flap.querySelectorAll<HTMLElement>(':scope > .flap-half');
  return { top, bot, fold, unfold };
}

function write(h: HTMLElement, c: string) { h.firstElementChild!.textContent = c; }

function reset(h: Halves, c: string) {
  // 지난번 날개 애니메이션을 지우면 CSS 기본값(fold 0°, unfold 90° = 숨김)으로 돌아간다
  h.fold.getAnimations().forEach((a) => a.cancel());
  h.unfold.getAnimations().forEach((a) => a.cancel());
  for (const x of [h.top, h.bot, h.fold, h.unfold]) write(x, c);
}

async function flipOnce(h: Halves, cur: string, next: string) {
  h.fold.getAnimations().forEach((a) => a.cancel());
  h.unfold.getAnimations().forEach((a) => a.cancel());
  write(h.top, next); write(h.bot, cur); write(h.fold, cur); write(h.unfold, next);
  const half = BOARD.flipMs / 2;
  await h.fold.animate(
    [{ transform: 'rotateX(0deg)', filter: 'brightness(1)' }, { transform: 'rotateX(-90deg)', filter: 'brightness(.45)' }],
    { duration: half, easing: 'ease-in', fill: 'forwards' },
  ).finished;
  await h.unfold.animate(
    [{ transform: 'rotateX(90deg)', filter: 'brightness(.6)' }, { transform: 'rotateX(0deg)', filter: 'brightness(1)' }],
    { duration: half, easing: 'cubic-bezier(.3,1.5,.6,1)', fill: 'forwards' }, // 살짝 튕김(이 보드만 허용)
  ).finished;
  write(h.bot, next);
}

const flapsOf = (board: HTMLElement) => [...board.querySelectorAll<HTMLElement>('.flap')];

// 연출 준비: 칸마다 출발 글자로 돌려 둔다. 화면에 들어오기 전에 불러야 완성 글자 → 출발 글자로 튀는 게 안 보인다
export function prepareBoard(board: HTMLElement): void {
  for (const f of flapsOf(board)) reset(halves(f), flipPath(f.dataset.c ?? ' ')[0]);
}

// 글자를 넘긴다. 되돌리는 함수(취소 → 완성 글자)를 돌려준다
export function animateBoard(board: HTMLElement): () => void {
  let cancelled = false;
  const timers: number[] = [];
  const flaps = flapsOf(board);
  flaps.forEach((f, i) => {
    const path = flipPath(f.dataset.c ?? ' ');
    const h = halves(f);
    timers.push(window.setTimeout(async () => {
      for (let k = 1; k < path.length && !cancelled; k++) await flipOnce(h, path[k - 1], path[k]);
    }, i * BOARD.staggerMs));
  });
  return () => {
    cancelled = true;
    timers.forEach((t) => window.clearTimeout(t));
    for (const f of flaps) reset(halves(f), f.dataset.c ?? ' ');
  };
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run tests/unit/board.test.ts && npm run typecheck`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/motion/board.ts tests/unit/board.test.ts
git commit -m "feat: split-flap board motion (hinged flaps, ordered characters, ~2s)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: ② DATA 섹션과 보드 마크업

**Files:**
- Create: `src/components/sections/DepartureBoard.tsx`
- Create: `src/components/sections/DataSection.tsx`
- Modify: `src/motion/run.ts`
- Modify: `src/styles/globals.css` (끝에 추가)

- [ ] **Step 1: 보드 마크업** — `src/components/sections/DepartureBoard.tsx`

```tsx
// ② 공항 출발 안내판(설계 2026-09-25 §3.2). 서버가 완성된 글자로 그려 두어 JS가 없거나 움직임 줄이기여도 그대로
// 읽힌다. 화면에 들어오면 src/motion/board.ts가 칸마다 글자를 넘긴다(run.ts가 연결).
// 칸 하나 = 위·아래 반쪽(정지) + 접히는 위 날개 + 펴지는 아래 날개. 화면 낭독기는 칸 대신 sr-only 완성값을 읽는다.
import { getT } from '@/lib/content';
import { facts } from '@/lib/facts';
import type { Locale } from '@/lib/i18n';

const DEST: Record<string, string> = { NRT: 'NARITA', KIX: 'KANSAI', HND: 'HANEDA' };
const fmt = (n: number) => new Intl.NumberFormat('en-US').format(n);

function Flaps({ text }: { text: string }) {
  return (
    <span className="flaps" aria-hidden="true">
      {[...text].map((c, i) => (
        <span key={i} className="flap" data-c={c}>
          <span className="flap-half flap-top"><span>{c}</span></span>
          <span className="flap-half flap-bot"><span>{c}</span></span>
          <span className="flap-half flap-top flap-fold"><span>{c}</span></span>
          <span className="flap-half flap-bot flap-unfold"><span>{c}</span></span>
        </span>
      ))}
    </span>
  );
}

function Cell({ text, read }: { text: string; read?: string }) {
  return <><span className="sr-only">{read ?? text}</span><Flaps text={text} /></>;
}

export function DepartureBoard({ locale }: { locale: Locale }) {
  const t = getT(locale);
  const { byRoute, filteredRows, collectStart, collectEnd, collectDays } = facts.data;
  // 행 수 칸 너비를 맞춘다(오른쪽 정렬, 앞을 빈칸으로). 실제 보드처럼 칸 개수가 줄마다 같아야 한다
  const width = Math.max(fmt(filteredRows).length, ...byRoute.map((r) => fmt(r.rows).length));
  const pad = (n: number) => fmt(n).padStart(width, ' ');
  return (
    <div className="board-housing">
      <div className="board" data-board>
        <div className="board-head">
          <p><span className="board-title mono">DEPARTURES</span> <span className="board-sub">{t('data.board.sub')}</span></p>
          <p className="board-range mono">{collectStart} → {collectEnd} · {collectDays} DAYS</p>
        </div>
        <table className="board-table">
          <caption className="sr-only">{t('data.board.caption')}</caption>
          <thead>
            <tr>
              <th scope="col">ROUTE<small>{t('data.board.route')}</small></th>
              <th scope="col" className="board-dest">DESTINATION<small>{t('data.board.destination')}</small></th>
              <th scope="col">ROWS<small>{t('data.board.rows')}</small></th>
              <th scope="col" className="board-status">STATUS<small>{t('data.board.status')}</small></th>
            </tr>
          </thead>
          <tbody>
            {byRoute.map(({ pair, rows }) => {
              const [a, b] = pair.split('_');
              return (
                <tr key={pair}>
                  <th scope="row"><Cell text={`${a}⇄${b}`} read={`${a} ⇄ ${b}`} /></th>
                  <td className="board-dest"><Cell text={DEST[b]} /></td>
                  <td><Cell text={pad(rows)} read={fmt(rows)} /></td>
                  <td className="board-status"><span className="board-lamp" aria-hidden="true" /><Cell text="DAILY" read={t('data.board.daily')} /></td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row"><Cell text="TOTAL" read={t('data.board.total')} /></th>
              <td className="board-dest" />
              <td><Cell text={pad(filteredRows)} read={fmt(filteredRows)} /></td>
              <td className="board-status" />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 섹션** — `src/components/sections/DataSection.tsx`

```tsx
// ② 데이터 수집(설계 2026-09-25 §3.2): 수집 라인 4단계 + 공항 출발 안내판. 배경은 한·일 지도와 노선 궤적(장면 problem).
// 옛 기술 스택 섹션의 수집·외부 데이터 도구는 이 섹션 아래 한 줄(data.tools)로 옮겼다.
import { ChapterFigure } from './ChapterFigure';
import { DepartureBoard } from './DepartureBoard';
import { getT } from '@/lib/content';
import { codeUrl } from '@/lib/facts';
import type { Locale } from '@/lib/i18n';
import { eyebrow } from '@/lib/sections';

// 단계 이름은 세 언어 공통 영어(보드 글자와 같은 결), 설명은 content의 data.steps.<키>
const STEPS = ['collect', 'schedule', 'filter', 'join'] as const;

export function DataSection({ locale }: { locale: Locale }) {
  const t = getT(locale);
  return (
    <section id="data" data-scene="problem" className="wrap data" aria-labelledby="data-h">
      <p className="eyebrow" data-flip-on-enter>{eyebrow('data')}</p>
      <h2 id="data-h" className="display" data-reveal>{t('data.heading')}</h2>
      <p>{t('data.body1')}</p>
      <p>{t('data.body2')}</p>
      <ol className="pipeline collect-line">
        {STEPS.map((s) => (
          <li key={s}>
            <strong className="mono">{s.toUpperCase()}</strong>
            <span>{t(`data.steps.${s}`)}</span>
          </li>
        ))}
      </ol>
      <DepartureBoard locale={locale} />
      <p className="muted">{t('data.sparse')}</p>
      <p className="muted mono data-tools">{t('data.tools')}</p>
      <ChapterFigure locale={locale} sceneKey="problem" />
      <a className="code-link mono" href={codeUrl('problem')} target="_blank" rel="noopener noreferrer">
        {t('common.codeLink')} ↗
      </a>
    </section>
  );
}
```

- [ ] **Step 3: 연출 연결** — `src/motion/run.ts`

import에 추가(`import { flip } from './flip';` 아래):

```ts
import { animateBoard, prepareBoard } from './board';
```

머리 주석의 목록 끝에 한 줄:

```ts
// - [data-board] 플립 보드: 화면에 들어오면 한 번, 칸마다 글자를 넘긴다(board.ts, 약 2초)
```

`gsap.context(() => { ... })` 안, `[data-flip-on-enter]` forEach 블록 뒤에:

```ts
    doc.querySelectorAll<HTMLElement>('[data-board]').forEach((el) => {
      prepareBoard(el);
      ScrollTrigger.create({ trigger: el, start: ENTER, once: true, onEnter: () => cancels.push(animateBoard(el)) });
    });
```

- [ ] **Step 4: 스타일** — `src/styles/globals.css` 끝에:

```css
/* ② DATA(설계 2026-09-25 §3.2): 수집 라인 + 공항 출발 안내판 */
.collect-line { margin-block: 32px; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); }
.collect-line strong { color: var(--amb); letter-spacing: 0.14em; font-size: 0.8rem; }
.data-tools { font-size: 0.8rem; }
.board-housing { --flap-w: 44px; --flap-h: 66px; --flap-f: 42px; --green: #6FE3A5;
  position: relative; margin-block: 32px; border-radius: 16px; padding: 10px; max-width: none;
  background: linear-gradient(180deg, #2a3346, #141a27 40%, #0d1220);
  box-shadow: 0 30px 60px -20px rgba(0, 0, 0, 0.8), 0 0 0 1px #000 inset, 0 1px 0 rgba(255, 255, 255, 0.13) inset; }
/* 네 모서리 나사: 요소를 늘리지 않고 배경 그림 네 개로 그린다 */
.board-housing::before { content: ''; position: absolute; inset: 10px; pointer-events: none;
  background: radial-gradient(circle, #7a8499 2px, #262d3b 3px, transparent 4px) 0 0 / 8px 8px no-repeat,
    radial-gradient(circle, #7a8499 2px, #262d3b 3px, transparent 4px) 100% 0 / 8px 8px no-repeat,
    radial-gradient(circle, #7a8499 2px, #262d3b 3px, transparent 4px) 0 100% / 8px 8px no-repeat,
    radial-gradient(circle, #7a8499 2px, #262d3b 3px, transparent 4px) 100% 100% / 8px 8px no-repeat; }
.board { background: #05080f; border-radius: 10px; padding: 22px 30px 26px; box-shadow: 0 6px 20px #000 inset; overflow-x: auto; }
.board-head { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: baseline; gap: 8px;
  padding-bottom: 14px; margin-bottom: 6px; border-bottom: 2px solid #1b2436; }
.board-title { color: var(--amb); font-size: 1.6rem; font-weight: 700; letter-spacing: 0.12em; }
.board-sub { color: var(--mute); margin-left: 10px; }
.board-range { color: var(--dot); letter-spacing: 0.06em; }
.board-table { width: 100%; border-collapse: separate; border-spacing: 0 12px; }
.board-table th, .board-table td { text-align: left; padding: 0 8px; white-space: nowrap; vertical-align: middle; }
.board-table thead th { font: 500 0.75rem var(--font-mono); letter-spacing: 0.18em; color: #8a96b3; }
.board-table thead small { display: block; font: 0.7rem var(--font-text); letter-spacing: 0; color: var(--mute); }
.board-table tfoot th, .board-table tfoot td { padding-top: 10px; border-top: 2px solid #1b2436; }
.flaps { display: inline-flex; gap: 3px; vertical-align: middle; }
.flap { position: relative; width: var(--flap-w); height: var(--flap-h); perspective: 260px;
  font: 600 var(--flap-f) var(--font-mono); color: var(--tx); border-radius: 5px; box-shadow: 0 2px 3px #000, 0 0 0 1px #000; }
.board-table td:nth-child(3) .flap { color: var(--amb); }
.board-status .flap { color: var(--green); }
.flap-half { position: absolute; left: 0; right: 0; height: 50%; overflow: hidden; backface-visibility: hidden; }
.flap-half > span { position: absolute; left: 0; right: 0; height: 200%; line-height: var(--flap-h); text-align: center; }
.flap-top { top: 0; border-radius: 5px 5px 0 0; transform-origin: 50% 100%; background: linear-gradient(180deg, #1d2638, #161e2e); }
.flap-bot { bottom: 0; border-radius: 0 0 5px 5px; transform-origin: 50% 0; background: linear-gradient(180deg, #10172a, #0c1220); }
.flap-top > span { top: 0; }
.flap-bot > span { bottom: 0; }
.flap-top::after { content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 1px; background: #000; } /* 경첩 선(핀은 넣지 않음) */
.flap-bot::before { content: ''; position: absolute; left: 0; right: 0; top: 0; height: 6px; background: linear-gradient(rgba(0, 0, 0, 0.5), transparent); z-index: 1; }
.flap-fold { z-index: 3; }
.flap-unfold { z-index: 2; transform: rotateX(90deg); }
.board-lamp { display: inline-block; width: 12px; height: 12px; margin-right: 10px; vertical-align: middle; border-radius: 50%;
  background: var(--green); box-shadow: 0 0 10px var(--green); animation: board-blink 2.4s infinite; }
@keyframes board-blink { 0%, 70%, 100% { opacity: 1; } 80% { opacity: 0.35; } }
@media (prefers-reduced-motion: reduce) { .board-lamp { animation: none; } }
/* 휴대폰: 칸을 줄이고 목적지 열과 상태 글자를 숨겨 390px 폭에 들어가게 한다(시안에서 확인) */
@media (max-width: 767px) {
  .board-housing { --flap-w: 19px; --flap-h: 30px; --flap-f: 18px; margin-inline: -8px; }
  .board { padding: 16px 8px; }
  .board-table th, .board-table td { padding: 0 4px; }
  .board-table thead th { letter-spacing: 0.06em; font-size: 0.65rem; }
  .flaps { gap: 2px; }
  .board-dest, .board-status .flaps, .board-table thead .board-status { display: none; }
  .board-lamp { margin: 0; }
}
```

(`.board-table thead .board-status`를 숨겨도 `display: none`은 그 열 머리글만 숨기고 표 구조는 그대로라 낭독에는 영향이 없다. 상태 값은 `sr-only`로 여전히 읽힌다 — `.board-status .flaps`만 숨기고 `.sr-only`는 남기기 때문.)

- [ ] **Step 5: 타입 확인**

Run: `npm run typecheck && npx vitest run tests/unit/client-imports.test.ts`
Expected: PASS (`DepartureBoard`·`DataSection`은 서버 부품이라 초기 JS 경계와 무관)

- [ ] **Step 6: 커밋**

```bash
git add src/components/sections/DepartureBoard.tsx src/components/sections/DataSection.tsx src/motion/run.ts src/styles/globals.css
git commit -m "feat: data section with collection line and departure board

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: ③ FEATURES 섹션 (글 목록)

**Files:**
- Create: `src/components/sections/Features.tsx`
- Modify: `src/styles/globals.css` (끝에 추가)

- [ ] **Step 1: 부품** — `src/components/sections/Features.tsx`

```tsx
// ③ 피처(설계 2026-09-25 §3.3). 이 계획(5-1)에서는 그룹 목록을 글로 보여 준다. 계획 5-2에서 배경 점이 그룹별
// 덩어리로 모이면 이 목록은 화면 낭독기·대체 화면용으로 남는다. 옛 기술 스택의 모델·서비스 도구는 아래 두 줄로 옮겼다.
import { getT } from '@/lib/content';
import { codeUrl, facts } from '@/lib/facts';
import { formatValue, type Locale } from '@/lib/i18n';
import { eyebrow } from '@/lib/sections';

export function Features({ locale }: { locale: Locale }) {
  const t = getT(locale);
  const unit = t('features.unit');
  return (
    <section id="features" data-scene="validation" className="wrap features" aria-labelledby="features-h">
      <p className="eyebrow" data-flip-on-enter>{eyebrow('features')}</p>
      <h2 id="features-h" className="display" data-reveal>{t('features.heading')}</h2>
      <p>{t('features.lead')}</p>
      <ul className="feature-groups">
        {facts.model.featureGroups.map((g) => (
          <li key={g.id} className={g.id === 'holiday' ? 'is-holiday' : undefined}>
            <span className="mono feature-gain">{formatValue(g.gain, 'fixed1', locale)}%</span>
            {/* 영어만 숫자와 단위 사이를 띄운다(13 features / 13개 / 13個) */}
            <strong>{t(`features.groups.${g.id}`)} · {g.features.length}{locale === 'en' ? ' ' : ''}{unit}</strong>
            <span className="mono feature-names">{g.features.join(' · ')}</span>
          </li>
        ))}
      </ul>
      <p className="muted">{t('features.lookupNote')}</p>
      <p className="muted mono data-tools">{t('features.model')}</p>
      <p className="muted mono data-tools">{t('features.serve')}</p>
      <a className="code-link mono" href={codeUrl('features')} target="_blank" rel="noopener noreferrer">
        {t('common.codeLink')} ↗
      </a>
    </section>
  );
}
```

- [ ] **Step 2: 스타일** — `src/styles/globals.css` 끝에:

```css
/* ③ FEATURES(설계 2026-09-25 §3.3): 이번 계획에서는 그룹 목록. 공휴일만 호박색(④ 공휴일 봉우리와 같은 색) */
.feature-groups { list-style: none; display: grid; gap: 14px; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); margin-block: 28px; }
.feature-groups li { display: grid; gap: 4px; border-top: 2px solid var(--line); padding-top: 12px; }
.feature-groups li.is-holiday { border-color: var(--amb); }
.feature-gain { font-size: 1.75rem; font-weight: 700; }
.feature-groups li.is-holiday .feature-gain { color: var(--amb); }
.feature-names { font-size: 0.75rem; color: var(--mute); word-break: break-word; }
```

- [ ] **Step 3: 확인**

Run: `npm run typecheck`
Expected: 오류 없음

- [ ] **Step 4: 커밋**

```bash
git add src/components/sections/Features.tsx src/styles/globals.css
git commit -m "feat: features section listing the six feature groups

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: ④ CHARTS 섹션

**Files:**
- Create: `src/components/sections/Charts.tsx`
- Modify: `src/components/sections/ValidationTable.tsx` (문구 키 경로)

- [ ] **Step 1: 부품** — `src/components/sections/Charts.tsx`

```tsx
// ④ 차트(설계 2026-09-25 §3.4). 블록 하나가 화면 한 장이고 블록마다 data-scene으로 3D 장면을 고른다.
// 이 계획(5-1)은 기존 장면(U자 곡선·떨어지는 점·예측 구간 띠)을 그대로 연결한다. 계획 5-2에서 배경 점이
// 차트 모양으로 모이게 바꾸고, 출발일별 가격(depart)에 자기 장면과 대체 이미지가 생긴다.
import { ChapterFigure, type FigureKey } from './ChapterFigure';
import { ValidationTable } from './ValidationTable';
import { getT } from '@/lib/content';
import { codeUrl, type CodeChapter } from '@/lib/facts';
import type { Locale } from '@/lib/i18n';
import { eyebrow } from '@/lib/sections';
import type { SceneKey } from '@/three/scenes';

type Block = { id: string; tag: string; scene: SceneKey; code: CodeChapter; paras: number; figure?: FigureKey; table?: true };

// paras = content의 charts.<id>.body1..N 개수. tag는 플립 글자판 머리표(세 언어 공통)
const BLOCKS: Block[] = [
  { id: 'depart', tag: 'CHART 01', scene: 'limits', code: 'features', paras: 1 },
  { id: 'curve', tag: 'CHART 02', scene: 'insight', code: 'insight', paras: 1, figure: 'insight' },
  { id: 'bubble', tag: 'CHART 03', scene: 'bubble', code: 'bubble', paras: 3, figure: 'bubble' },
  { id: 'validation', tag: 'VALIDATION', scene: 'validation', code: 'validation', paras: 2, table: true },
  { id: 'band', tag: 'CHART 04', scene: 'interval', code: 'interval', paras: 3, figure: 'interval' },
  { id: 'limits', tag: 'LIMITS', scene: 'limits', code: 'limits', paras: 3 },
];

export function Charts({ locale }: { locale: Locale }) {
  const t = getT(locale);
  return (
    <section id="charts" className="wrap" aria-labelledby="charts-h">
      <div className="charts-head text-scrim">
        <p className="eyebrow" data-flip-on-enter>{eyebrow('charts')}</p>
        <h2 id="charts-h" className="display" data-reveal>{t('charts.heading')}</h2>
      </div>
      {BLOCKS.map((b) => (
        <article key={b.id} data-scene={b.scene} className="chapter" aria-labelledby={`chart-${b.id}`}>
          <p className="eyebrow" data-flip-on-enter>{b.tag}</p>
          <h3 id={`chart-${b.id}`}>{t(`charts.${b.id}.heading`)}</h3>
          {b.figure && <ChapterFigure locale={locale} sceneKey={b.figure} />}
          {Array.from({ length: b.paras }, (_, i) => <p key={i}>{t(`charts.${b.id}.body${i + 1}`)}</p>)}
          {b.table && <ValidationTable locale={locale} />}
          <a className="code-link mono" href={codeUrl(b.code)} target="_blank" rel="noopener noreferrer">
            {t('common.codeLink')} ↗
          </a>
        </article>
      ))}
    </section>
  );
}
```

- [ ] **Step 2: 표 문구 키** — `src/components/sections/ValidationTable.tsx`에서 `case.validation.table.`을 모두 `charts.validation.table.`로 바꾸고(4곳), 머리 주석 "3-4 검증 설계 챕터에 들어가는"을 "④ 차트 섹션의 검증 블록에 들어가는"으로.

Run: `grep -n "case\." src/components/sections/ValidationTable.tsx`
Expected: 출력 없음

- [ ] **Step 3: 확인**

Run: `npm run typecheck`
Expected: 오류 없음

- [ ] **Step 4: 커밋**

```bash
git add src/components/sections/Charts.tsx src/components/sections/ValidationTable.tsx
git commit -m "feat: charts section replacing the case study chapters

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: 연락처로 개인 소개 옮기기

**Files:**
- Modify: `src/components/sections/Contact.tsx`
- Modify: `src/styles/globals.css` (끝에 추가)

- [ ] **Step 1: 부품** — `src/components/sections/Contact.tsx`

머리 주석 첫 줄을 바꾼다:

```tsx
// 연락처 섹션: "탑승권" 카드(이메일·GitHub·LinkedIn·이력서)와 개인 소개(학력·핵심 역량).
// 개인 소개는 옛 소개 섹션에서 옮겨 왔다(설계 2026-09-25 §2 — 첫 화면 다음은 프로젝트 소개).
```

`SKILLS` 상수를 `export function Contact` 위에 더한다:

```tsx
// content/*.json의 contact.about.skills.* 키와 순서를 맞춘 목록
const SKILLS = ['collection', 'modeling', 'validation', 'interval'] as const;
```

`</div>`(`.pass` 닫힘)와 `</section>` 사이에:

```tsx
      <div className="contact-about">
        <h3>{t('contact.about.heading')}</h3>
        <p className="muted">{t('contact.about.education')}</p>
        <p>{t('contact.about.body1')}</p>
        <p>{t('contact.about.body2')}</p>
        <p>{t('contact.about.body3')}</p>
        <h4>{t('contact.about.skillsHeading')}</h4>
        <ul className="skills">{SKILLS.map((s) => <li key={s}>{t(`contact.about.skills.${s}`)}</li>)}</ul>
      </div>
```

- [ ] **Step 2: 스타일** — `src/styles/globals.css` 끝에:

```css
/* 연락처 아래 개인 소개(옛 소개 섹션) */
.contact-about { margin-top: 48px; max-width: 640px; }
.contact-about h4 { font-size: 1rem; margin: 24px 0 10px; }
```

- [ ] **Step 3: 확인 후 커밋**

Run: `npm run typecheck`
Expected: 오류 없음

```bash
git add src/components/sections/Contact.tsx src/styles/globals.css
git commit -m "feat: move personal intro under contact

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: 옆 목차, 섹션 목록으로 조립, 옛 섹션·문구 삭제

**Files:**
- Create: `src/components/SideNav.tsx`
- Modify: `src/components/HomePage.tsx`
- Delete: `src/components/sections/About.tsx`, `src/components/sections/CaseStudy.tsx`, `src/components/sections/Stack.tsx`
- Modify: `content/{ko,en,ja}.json` (옛 키 삭제)
- Modify: `src/styles/globals.css`
- Modify: `src/motion/run.ts:42` (주석의 `.chapter` 설명은 그대로 유효 — 손대지 않음)

- [ ] **Step 1: 옆 목차** — `src/components/SideNav.tsx`

```tsx
'use client';
// 옆 목차(설계 2026-09-25 §2.1): 데스크톱 왼쪽 가장자리에 섹션 번호를 세로로 두고, 화면 가운데를 지나는 섹션을 호박색으로
// 표시한다. 번호와 이름은 섹션 목록(sections.ts)에서 만든다 — 섹션을 더하면 목차도 저절로 늘어난다.
// 휴대폰에서는 CSS로 숨긴다(메뉴 버튼 없음 결정 유지). 이동은 브라우저 기본 앵커 점프(Lenis anchors: false와 같은 길).
import { useEffect, useState } from 'react';
import { SECTIONS, sectionNumber, type SectionId } from '@/lib/sections';

export function SideNav({ label }: { label: string }) {
  const [active, setActive] = useState<SectionId | null>(null);
  useEffect(() => {
    // 화면 세로 가운데 한 줄에 걸친 섹션만 "보는 중"으로 친다(rootMargin으로 위아래 절반씩 깎음)
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const id = e.target.id as SectionId;
        setActive((cur) => (e.isIntersecting ? id : cur === id ? null : cur));
      }
    }, { rootMargin: '-50% 0px -50% 0px' });
    for (const s of SECTIONS) {
      const el = document.getElementById(s.id);
      if (el) io.observe(el);
    }
    return () => io.disconnect();
  }, []);
  return (
    <nav className="side-nav" aria-label={label}>
      <ol>
        {SECTIONS.map((s) => (
          <li key={s.id}>
            <a href={`#${s.id}`} aria-current={active === s.id ? 'true' : undefined} aria-label={`${sectionNumber(s.id)} ${s.label}`}>
              {sectionNumber(s.id)}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
```

- [ ] **Step 2: 홈 화면 조립** — `src/components/HomePage.tsx` 전체를:

```tsx
// 한 페이지 스크롤 홈 화면. 첫 화면 → 번호 섹션(섹션 목록 순서) → 데모 → 연락처를 로케일 하나로 조립한다.
// 번호 섹션을 더하려면 src/lib/sections.ts에 한 줄 + 아래 SECTION_VIEWS에 부품 한 줄(빠뜨리면 타입 오류).
import type { ReactElement } from 'react';
import { Backdrop } from './Backdrop';
import { Header } from './Header';
import { Loader } from './Loader';
import { Motion } from './Motion';
import { SideNav } from './SideNav';
import { Charts } from './sections/Charts';
import { Contact } from './sections/Contact';
import { DataSection } from './sections/DataSection';
import { Demo } from './sections/Demo';
import { Features } from './sections/Features';
import { Hero } from './sections/Hero';
import { Project } from './sections/Project';
import { getT } from '@/lib/content';
import { facts } from '@/lib/facts';
import type { Locale } from '@/lib/i18n';
import { SECTIONS, type SectionId } from '@/lib/sections';

const SECTION_VIEWS: Record<SectionId, (props: { locale: Locale }) => ReactElement> = {
  project: Project,
  data: DataSection,
  features: Features,
  charts: Charts,
};

export function HomePage({ locale }: { locale: Locale }) {
  return (
    <>
      <Loader rows={new Intl.NumberFormat('en-US').format(facts.data.filteredRows)} />
      <Backdrop dataVersion={facts.dataVersion} />
      <Header locale={locale} />
      <SideNav label={getT(locale)('nav.sections')} />
      <main id="main" data-locale={locale}>
        <Hero locale={locale} />
        {SECTIONS.map(({ id }) => {
          const View = SECTION_VIEWS[id];
          return <View key={id} locale={locale} />;
        })}
        <Demo locale={locale} />
        <Contact locale={locale} />
      </main>
      <Motion />
    </>
  );
}
```

- [ ] **Step 3: 옛 섹션 삭제**

```bash
git rm src/components/sections/About.tsx src/components/sections/CaseStudy.tsx src/components/sections/Stack.tsx
```

- [ ] **Step 4: 옛 문구 키 삭제** — 세 파일에서 최상위 `about`, `case`, `stack`을 지운다:

```bash
python3 - <<'EOF'
import json, pathlib
for lang in ["ko", "en", "ja"]:
    p = pathlib.Path(f"content/{lang}.json")
    raw = p.read_text(encoding="utf-8")
    d = json.loads(raw)
    for k in ["about", "case", "stack"]:
        del d[k]
    indent = len(raw.split("\n")[1]) - len(raw.split("\n")[1].lstrip())
    p.write_text(json.dumps(d, ensure_ascii=False, indent=indent) + "\n", encoding="utf-8")
    print(lang, list(d))
EOF
```

Expected: 세 줄 모두 `['meta', 'nav', 'langHint', 'hero', 'demo', 'contact', 'notFound', 'figure', 'project', 'data', 'features', 'common', 'charts']` 같은 목록(순서 무관)에 `about`·`case`·`stack`이 없다.

Run: `grep -rn "'about\.\|'case\.\|'stack\.\|\`case\.\|\`about\.\|\`stack\." src`
Expected: 출력 없음

- [ ] **Step 5: 스타일 정리** — `src/styles/globals.css`

1) 아래 두 규칙의 선택자 `:is(.chapter, #about, #demo, #stack, #contact)`를 모두 `:is(.chapter, #project, #data, #features, #demo, #contact)`로 바꾼다(데스크톱 2곳, `@media (max-width: 767px)` 안 1곳 — 총 3곳).

2) 560px 제한 규칙에서 보드와 수집 라인을 뺀다. 기존 줄:

```css
html[data-3d="on"] :is(.chapter, #about, #demo, #stack, #contact) > :is(p, h2, h3, ul, ol, table, a, div, dl):not(.pass) { max-width: 560px; }
```

을:

```css
/* 보드·수집 라인·목록은 넓게 쓰고 자기 배경(보드)이 있으므로 560px 제한에서 뺀다. ①의 글 판(.text-scrim)은
   큰 질문(최대 76px)이 560px 안에서 여러 줄로 부서지므로 뺀다 — 판은 글 크기만큼만 커진다 */
html[data-3d="on"] :is(.chapter, #project, #data, #features, #demo, #contact) > :is(p, h2, h3, ul, ol, table, a, div, dl):not(.pass, .board-housing, .collect-line, .feature-groups, .contact-about, .text-scrim) { max-width: 560px; }
```

3) `html[data-3d="on"] .case-head > h2 { margin-bottom: 0; }`를 `html[data-3d="on"] .charts-head > h2 { margin-bottom: 0; }`로.

4) 파일 끝에 옆 목차:

```css
/* 옆 목차(설계 2026-09-25 §2.1): 본문(.wrap 최대 1080px) 왼쪽 여백이 충분한 넓은 화면에서만 보인다 */
.side-nav { position: fixed; left: 20px; top: 50%; transform: translateY(-50%); z-index: 30; display: none; }
.side-nav ol { list-style: none; display: grid; gap: 10px; }
.side-nav a { font: 600 0.75rem var(--font-mono); letter-spacing: 0.1em; color: var(--mute); text-decoration: none; padding: 4px 6px; border-left: 2px solid transparent; }
.side-nav a[aria-current] { color: var(--amb); border-left-color: var(--amb); }
.side-nav a:hover { color: var(--tx); }
@media (min-width: 1280px) { .side-nav { display: block; } }
```

- [ ] **Step 6: 단위 테스트·타입·빌드**

Run: `npm run typecheck && npm test && npm run build && npm run size`
Expected: 모두 통과. `npm run size`의 초기 JS가 150KB 이하(옆 목차 추가분은 1KB 안팎).

- [ ] **Step 7: 눈으로 확인** — `npx serve out -l 4173`을 띄우고 브라우저로 `/`, `/en/`, `/ja/`를 연다. 순서(이름 → 01 PROJECT → 02 DATA COLLECTION → 03 FEATURES → 04 CHARTS → 데모 → 연락처+소개), 보드 글자가 약 2초 동안 넘어가는지, 옆 목차 번호가 스크롤에 따라 호박색으로 바뀌는지, 390px 폭에서 가로 스크롤이 없는지 본다.

- [ ] **Step 8: 커밋**

```bash
git add -A src content
git commit -m "feat: assemble home from section registry; side nav; drop old about/case/stack

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: e2e 고치기와 새 e2e

**Files:**
- Modify: `tests/e2e/site.spec.ts`, `tests/e2e/motion.spec.ts`, `tests/e2e/terrain.spec.ts`
- Create: `tests/e2e/board.spec.ts`

- [ ] **Step 1: site.spec.ts**

`content` 타입 선언의 `{ case: { heading: string }; ...}`을 `{ project: { heading: string }; contact: ...; demo: ... }`로 바꾼다(`case` → `project`).

첫 테스트 안 두 줄을:

```ts
    for (const id of ['project', 'data', 'features', 'charts', 'demo', 'contact']) await expect(page.locator(`#${id}`)).toBeAttached();
    await expect(page.locator('#charts [data-scene]')).toHaveCount(6);
```

JS 없이 테스트의 두 줄을:

```ts
      await expect(page.getByRole('heading', { name: content[lang].project.heading })).toBeVisible();
      await expect(page.locator('#charts table')).toBeVisible();
```

마지막 테스트('모바일 폭에서 가로 스크롤이 없다')를 세 언어로 넓힌다 — 테스트 전체를:

```ts
for (const path of ['/', '/en/', '/ja/']) {
  test(`${path} 모바일 폭에서 가로 스크롤이 없다(플립 보드 포함)`, async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}
```

- [ ] **Step 2: motion.spec.ts**

- 움직임 줄이기 테스트: `page.locator('#stack')` → `page.locator('#features')`, 마지막 줄을
  `await expect(page.locator('#data > .eyebrow')).toHaveText('02 — DATA COLLECTION');`
- 리빌 테스트: `'#stack-h'` → `'#features-h'`
- 긴 페이지 플립 테스트: 선택자 `'[data-chapter="insight"] [data-flip-on-enter]'` → `'[data-scene="insight"] [data-flip-on-enter]'`, 마지막 기대값 `'GATE 02 — INSIGHT'` → `'CHART 02'`. 주석의 "GATE 02 제목"은 "CHART 02 머리표"로, "#stack-h"는 "#features-h"로.
- 완성값 테스트: `'[data-chapter="bubble"] .eyebrow'` → `'[data-scene="bubble"] .eyebrow'`, 기대값 두 곳 `'GATE 03 — R² BUBBLE'` → `'CHART 03'`. 테스트 이름의 "GATE 제목"은 "머리표"로.

- [ ] **Step 3: terrain.spec.ts**

- `'#case-h'` 두 곳 → `'#charts-h'`
- `['[data-chapter="insight"] > p:not(.eyebrow)', 1]` → `['[data-scene="insight"] > p:not(.eyebrow)', 1]`

- [ ] **Step 4: 새 e2e** — `tests/e2e/board.spec.ts`

```ts
// ② 플립 보드와 옆 목차 e2e: 완성값 낭독, 넘김이 끝나면 칸 글자가 완성값, 움직임 줄이기에서는 바로 완성값,
// 옆 목차 번호가 섹션 목록 순서이고 누르면 이동하며, 휴대폰에서는 숨는다.
import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// site.spec.ts와 같은 이유로 JSON은 fs로 읽는다
const facts = JSON.parse(readFileSync(fileURLToPath(new URL('../../data/facts.json', import.meta.url)), 'utf-8')) as {
  data: { filteredRows: number; byRoute: { pair: string; rows: number }[] };
};
const fmt = (n: number) => new Intl.NumberFormat('en-US').format(n);

// 칸마다 지금 보이는 글자(정지한 아래 반쪽)가 서버가 적어 둔 완성 글자(data-c)와 같은지
const settled = (el: Element) =>
  [...el.querySelectorAll<HTMLElement>('.flap')].every((f) => f.querySelector('.flap-bot:not(.flap-unfold) > span')?.textContent === f.dataset.c);

test('보드: 노선별·합계 행 수를 완성값으로 읽는다', async ({ page }) => {
  await page.goto('/');
  const board = page.locator('[data-board]');
  for (const r of facts.data.byRoute) await expect(board.locator('.sr-only', { hasText: fmt(r.rows) })).toHaveCount(1);
  await expect(board.locator('tfoot .sr-only', { hasText: fmt(facts.data.filteredRows) })).toHaveCount(1);
});

test('보드: 화면에 들어오면 넘어가고, 끝나면 칸 글자가 완성값이다', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-3d', /^(on|off)$/, { timeout: 20_000 });
  const board = page.locator('[data-board]');
  await board.scrollIntoViewIfNeeded();
  await expect.poll(() => board.evaluate(settled), { timeout: 8_000 }).toBe(true);
});

test.describe('움직임 줄이기', () => {
  test.use({ reducedMotion: 'reduce' });
  test('보드가 넘어가지 않고 처음부터 완성값', async ({ page }) => {
    await page.goto('/');
    const board = page.locator('[data-board]');
    await board.scrollIntoViewIfNeeded();
    expect(await board.evaluate(settled)).toBe(true);
    expect(await board.evaluate((el) => el.getAnimations({ subtree: true }).length)).toBe(0);
  });
});

test('옆 목차: 섹션 번호 순서, 누르면 이동하고 현재 섹션 표시', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: '섹션 목차' });
  await expect(nav.getByRole('link')).toHaveText(['01', '02', '03', '04']);
  await nav.getByRole('link', { name: '03 FEATURES' }).click();
  await expect(page).toHaveURL(/#features$/);
  await expect(nav.getByRole('link', { name: '03 FEATURES' })).toHaveAttribute('aria-current', 'true');
});

test('옆 목차: 휴대폰에서는 숨는다', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto('/');
  await expect(page.locator('.side-nav')).toBeHidden();
});
```

(움직임 줄이기 테스트의 두 번째 단언: 보드 안에서 돌고 있는 애니메이션이 0개인지. `board-lamp` 깜빡임도 CSS 미디어 쿼리로 꺼져 있어 0이어야 한다.)

- [ ] **Step 5: e2e 실행**

Run: `npm run build && npm run e2e`
Expected: 모두 통과(desktop·mobile 프로젝트). 옆 목차 테스트는 폭을 직접 정하므로 두 프로젝트에서 같게 동작한다.

실패하면: 보드 넘김 테스트가 시간 초과면 swiftshader 병렬 부하일 수 있다 — `npx playwright test tests/e2e/board.spec.ts --workers=1`로 다시 돌려 확인하고, 그래도 실패하면 `board.ts`를 고친다(시간만 늘리지 않는다).

- [ ] **Step 6: 커밋**

```bash
git add tests/e2e
git commit -m "test: e2e for new section order, departure board, side nav

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: 마무리 검사와 문서

**Files:**
- Modify: `CLAUDE.md`
- Modify: `docs/superpowers/specs/2026-09-25-page-restructure-design.md` (구현 결과 한 단락)

- [ ] **Step 1: 전체 검사**

```bash
npm run typecheck && npm test && npm run build && npm run size && npm run e2e && npm run pytest
```

Expected: 모두 통과. `npm run size`의 초기 JS·3D 청크 수치를 적어 둔다.

- [ ] **Step 2: CLAUDE.md** — 두 곳을 고친다.

1) "## 현재 상태" 표에 한 줄 추가:

```markdown
| 5-1 구조 개편 | 섹션 목록, ①~④ 새 섹션, 플립 보드, 옆 목차, 개인 소개 이동 | `2026-09-25-plan-5-1-structure.md` | ✅ (PR 대기) |
```

그리고 표 아래에 "계획 5-2(점 → 차트·피처 덩어리)와 5-3(인터랙션)이 남았다. 설계: `docs/superpowers/specs/2026-09-25-page-restructure-design.md`" 한 줄.

2) "### 페이지 구성 (한 페이지 스크롤, 승인됨)" 목록 전체를 새 순서로 바꾼다:

```markdown
### 페이지 구성 (한 페이지 스크롤, 2026-09-25 개편 승인)

0. 로딩 화면: `LOADING 242,874 ROWS` 플립 카운터
- 첫 화면: 점들이 모여 가격 지형이 되고 마우스에 반응. 이름, `ML ENGINEER`, 키워드
1. `01 — PROJECT`: 큰 질문 + 설명 + 숫자 4개(노선·수집 개월·피처·예측 구간)
2. `02 — DATA COLLECTION`: 수집 라인 4단계 + 공항 플립 보드(왕복 3줄 + TOTAL, 약 2초·튕김 — 모션 규칙 예외). 배경 한·일 지도
3. `03 — FEATURES`: 피처 33개, 6개 그룹(5-2에서 점 덩어리, 5-3에서 눌러 펼치기)
4. `04 — CHARTS`: 출발일별 가격 · U자 예약 곡선 · R² 거품 · 검증 표 · 예측 구간 · 한계(5-2에서 배경 점이 차트로 모임)
- 데모, 연락처(탑승권 카드 + 개인 소개)
- 섹션 목록 `src/lib/sections.ts` 한 곳에서 순서·번호·옆 목차를 만든다(섹션 추가 예정, 무엇일지는 미정)
```

"### 비주얼 시스템"의 모션 규칙 플립 줄 끝에 ` (예외: ② 플립 보드는 약 2초, 펴질 때 튕김 — 2026-09-25 사용자 승인)`을 붙인다.

- [ ] **Step 3: 설계 문서에 구현 결과** — `docs/superpowers/specs/2026-09-25-page-restructure-design.md`의 "## 9. 범위 밖" 바로 앞에:

```markdown
## 구현 결과 (계획 5-1)

- 섹션 목록은 `id`·`label`만 가진다. 장면은 각 섹션 부품이 `data-scene`으로 적는다(차트 섹션은 블록마다 장면이 달라 목록 한 칸에 담기 어려웠다).
- 3D 장면은 기존 것을 임시로 연결했다(계획서 표 참고). ③·④ 차트 1의 전용 장면과 대체 이미지는 계획 5-2.
- 옛 기술 스택의 도구 목록은 ②(수집·외부 데이터)와 ③(모델·서비스) 아래 한 줄씩으로 옮겼다.
- 수집 끝 날짜: 원본 CSV의 09-23 행은 기준일(09-22) 자르기로 빠지므로 `collectEnd = 2026-09-22`가 맞다.
```

- [ ] **Step 4: 커밋·푸시·PR**

```bash
git add CLAUDE.md docs/superpowers/specs/2026-09-25-page-restructure-design.md
git commit -m "docs: record plan 5-1 structure

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push -u origin feat/page-restructure
gh pr create --title "Plan 5-1: page restructure, data board, side nav" --body "$(cat <<'EOF'
## 무엇
- 홈 순서: 첫 화면 → 01 PROJECT → 02 DATA COLLECTION → 03 FEATURES → 04 CHARTS → 데모 → 연락처(+개인 소개)
- ② 공항 플립 보드(왕복 3줄 + TOTAL, 약 2초), 수집 라인 4단계
- 섹션 목록(`src/lib/sections.ts`)으로 번호·옆 목차 자동
- facts: 노선별 행 수, 수집 일수·개월 수, 피처 그룹 33개

## 다음
- 계획 5-2: 배경 점 → 피처 덩어리·차트 4개
- 계획 5-3: 점 마우스 반응, 덩어리 펼치기, 차트 만지기

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

(push·PR은 사용자 확인 후. main 병합은 CI 통과 + 사용자 확인 뒤 fast-forward — CLAUDE.md "병합" 규칙.)
