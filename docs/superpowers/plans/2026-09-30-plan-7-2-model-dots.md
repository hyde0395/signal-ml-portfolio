# 계획 7-2: ③ 모델 구조 점 연출 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ③ 모델 카드("모델 구조")를 그림 판 블록으로 바꿔, 자막 세 칸에 맞춰 인천→나리타 LCC 관측 점이 모은 가격 → NeuralProphet 기준 가격 선 → 기준에서 벗어난 몫(잔차)으로 옮겨 가게 한다.

**Architecture:** 파이썬 추출(`export_charts.py`)이 관측 표본(출발일마다 12개, %×10)과 서비스 모델의 NeuralProphet 기준 가격(%×10)을 `charts.json`의 `model`에 넣는다. 사이트는 새 순수 배치 함수 `modelLayout`(`src/charts/model.ts`)으로 단계별 배치를 만들고, `ChartStage`가 블록의 `data-para`(자막 스크립트가 적는 지금 문단)를 지켜보다 단계가 바뀌면 다시 배치한다. 배치의 `variant`(`stage:<n>`)가 바뀌므로 3D는 반대 슬롯에 써서 점이 옮겨 간다(5-3c `pickSlot`, TerrainScene 수정 없음).

**Tech Stack:** Python(pandas·NeuralProphet, 항공권 저장소 모델) · Next.js 정적 export · Vitest · Playwright(+axe)

**설계:** `docs/superpowers/specs/2026-09-30-model-dots-design.md`

## 공통 규칙

- **작업 폴더**: git worktree `~/dev/untitled folder/signal-ml-portfolio-7-2`, 브랜치 `plan-7-2-model-dots`. main에 직접 커밋하지 않는다. 다른 worktree(`-takeoff`, `-polish`)는 건드리지 않는다.
- **코드 주석은 한국어**: 새 파일 맨 위 한두 줄, 이유가 드러나지 않는 로직에 "왜". 코드를 한 줄씩 옮겨 적는 주석은 달지 않는다.
- 커밋 메시지 끝에 빈 줄 + `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. 커밋 이메일은 저장소 설정(noreply) 그대로.
- **문구 규칙**: 숫자 직접 기입 금지(3개 언어 테스트), 세 언어 키 동일, 담백한 톤. **데이터 공개 원칙**: `charts.json`에는 %만(원 단위 값 없음).
- **항공권 저장소**: 모델을 돌리기 전 iCloud 워밍(그쪽 CLAUDE.md), 그 저장소 `.venv`는 절대 건드리지 않는다(`scripts/py.sh`가 `~/.venvs/airfare-py311`을 고른다).
- **포트**: e2e는 `out/`을 4173으로 띄운다. 다른 worktree가 쓰는 중이면 끄지 않고 `E2E_PORT`로 다른 포트를 쓴다(Task 7에서 설정에 더함). 눈 확인용 개발 서버는 `npx next dev -p 3074`.

## 파일 지도

| 파일 | 할 일 | 태스크 |
|---|---|---|
| `scripts/export_charts.py` · `scripts/tests/test_export_charts.py` | 관측 표본·기준 % 순수 함수, 서비스 모델 기준 가격 | 1, 2 |
| `public/data/charts.2026-09-22.json` | `model` 추가(다른 키 그대로) | 2 |
| `src/charts/data.ts` · `tests/unit/charts-data.test.ts` | 스키마 `model` | 3 |
| `src/charts/types.ts` · `src/charts/layouts.ts` · `src/charts/model.ts`(새) · `tests/unit/charts-model.test.ts`(새) | `chartModel` 키, 월 이름표 도우미, `modelLayout` | 4 |
| `src/charts/build.ts` · `tests/unit/charts-draw.test.ts` | `chartModel` 배치, `step` 인자 | 5 |
| `src/three/scenes.ts` · `tests/unit/three-scenes.test.ts` | `model` → `chartModel`(차트 장면) | 6 |
| `src/motion/caption.ts` · `src/components/charts/ChartStage.tsx` · `src/components/sections/Features.tsx` · `content/{ko,en,ja}.json` · `playwright.config.ts` · `tests/e2e/*.ts` | 단계 전환, 블록 모양, 문구, e2e | 7 |
| 설계 문서 · `CLAUDE.md` | 구현 결과, 상태 표 | 8 |

---

### Task 1: 관측 표본·기준 % — 순수 함수(파이썬)

**Files:** Modify `scripts/export_charts.py`, Test `scripts/tests/test_export_charts.py`

- [ ] **Step 1: 실패하는 테스트**

```python
def model_rows():
    # 출발일 셋: 첫날 행 20개, 둘째 날 5개, 셋째 날(다른 노선) 3개. pct·base는 add_route_class_pct가 붙이는 열
    rows = []
    for i in range(20):
        rows.append({"origin": "ICN", "destination": "NRT", "airline_class": "LCC", "departure_date": "2026-10-01", "pct": float(i), "base": 100_000.0})
    for i in range(5):
        rows.append({"origin": "ICN", "destination": "NRT", "airline_class": "LCC", "departure_date": "2026-10-03", "pct": -float(i), "base": 100_000.0})
    for i in range(3):
        rows.append({"origin": "ICN", "destination": "KIX", "airline_class": "LCC", "departure_date": "2026-10-02", "pct": 0.0, "base": 90_000.0})
    return pd.DataFrame(rows)


def test_route_rows_picks_one_route_and_cabin():
    assert len(ec.route_rows(model_rows(), "ICN_NRT", "LCC")) == 25


def test_model_obs_caps_per_date_sorted_by_date_index_and_is_seeded():
    dates = ["2026-10-01", "2026-10-02", "2026-10-03"]
    o = ec.model_obs(ec.route_rows(model_rows(), "ICN_NRT", "LCC"), dates, per_date=12, seed=3)
    assert o["date"] == [0] * 12 + [2] * 5
    assert set(o["pct"][:12]) <= {i * 10 for i in range(20)}
    assert ec.model_obs(ec.route_rows(model_rows(), "ICN_NRT", "LCC"), dates, per_date=12, seed=3) == o


def test_baseline_pct10_is_pct_of_mean_and_none_when_missing():
    got = ec.baseline_pct10({"a": 110_000.0, "b": float("nan"), "c": 0.0}, 100_000.0, ["a", "b", "c", "d"])
    assert got == [100, None, None, None]


def test_model_block_has_percent_only():
    sub = ec.route_rows(model_rows(), "ICN_NRT", "LCC")
    dates = ["2026-10-01", "2026-10-02", "2026-10-03"]
    b = ec.model_block(sub, dates, {"2026-10-01": 95_000.0, "2026-10-03": 120_000.0}, "ICN_NRT", "LCC")
    assert set(b) == {"route", "cabin", "base", "obs"} and set(b["obs"]) == {"date", "pct"}
    assert b["base"] == [-50, None, 200]
    assert all(isinstance(v, int) for v in b["obs"]["pct"])
```

- [ ] **Step 2: `npm run pytest` → 새 테스트 실패(속성 없음) 확인**
- [ ] **Step 3: 구현** — `export_charts.py`에 상수 `MODEL_ROUTE = "ICN_NRT"`, `MODEL_CABIN = "LCC"`, `MODEL_PER_DATE = 12`와 함수를 더한다:

```python
def route_rows(kept, route, cabin):
    origin, dest = route.split("_")
    return kept[(kept["origin"] == origin) & (kept["destination"] == dest) & (kept["airline_class"] == cabin)]


def model_obs(sub, dates, per_date=MODEL_PER_DATE, seed=SEED):
    """출발일마다 최대 per_date개 관측(날짜 번호, %×10). 섞은 뒤 head — groupby().sample(n)은 행이 n보다 적은 날에 실패한다."""
    index = {d: i for i, d in enumerate(dates)}
    take = sub.sample(frac=1, random_state=seed).groupby("departure_date", sort=False).head(per_date)
    take = take.assign(di=take["departure_date"].map(index)).sort_values("di", kind="stable")
    return {"date": take["di"].astype(int).tolist(), "pct": (take["pct"] * 10).round().astype(int).tolist()}


def baseline_pct10(base_price, mean_price, dates):
    out = []
    for d in dates:
        b = base_price.get(d)
        ok = b is not None and np.isfinite(b) and b > 0
        out.append(int(round((b / mean_price - 1) * 1000)) if ok else None)
    return out


def model_block(sub, dates, base_price, route, cabin):
    mean = float(sub["base"].iloc[0])  # add_route_class_pct가 붙인 노선·등급 평균 — 관측 %와 같은 기준
    return {"route": route, "cabin": cabin, "base": baseline_pct10(base_price, mean, dates), "obs": model_obs(sub, dates)}
```

- [ ] **Step 4: `npm run pytest` 통과 → 커밋** `feat(charts): model dots sample and baseline pct helpers`

### Task 2: 서비스 모델 기준 가격 + `charts.json` 다시 만들기

**Files:** Modify `scripts/export_charts.py`, `public/data/charts.2026-09-22.json`

- [ ] **Step 1**: 모델을 한 번만 불러오도록 `service_model()`(`functools.lru_cache`, `quiet()` 안에서 `load_pkl_model()`)을 두고 `compute_shap`도 그것을 쓴다.
- [ ] **Step 2**: `compute_model_baseline(route, cabin, dates)` — `np_baseline_for_route(p.np_models, p.np_dailies, route, 날짜)` × `p.class_level_ratio[(route, cabin)]`, 값이 없거나 0 이하면 유효 값 중앙값(`V2Predictor.predict_optimal_timing` 3단계와 같다). `compute_model(kept, removed, dates)` — `add_route_class_pct` → `route_rows` → 기준 가격 → `model_block`. `main()`에서 `charts["model"]`에 넣고 큰 잔차(|r| ≥ 50%) 비율을 출력한다.
- [ ] **Step 3**: iCloud 워밍 → 백업 `cp public/data/charts.2026-09-22.json $SCRATCH/charts.before.json` → `npm run charts`.
- [ ] **Step 4**: node로 `model`을 뺀 나머지 키가 백업과 같은지(`JSON.stringify` 비교), gzip 용량 확인.
- [ ] **Step 5**: 커밋 `feat(charts): export model baseline and observation sample`

### Task 3: 스키마 `model`

**Files:** `src/charts/data.ts`, `tests/unit/charts-data.test.ts`

- [ ] 실패하는 테스트: 생성 파일의 `model.base.length === dates.length`, `obs.date` 모두 `0 ≤ i < dates.length`; `base` 길이가 다르거나 `obs.date`가 범위 밖이면 reject.
- [ ] 구현: `model: z.object({ route, cabin, base: z.array(z.number().int().nullable()), obs: { date: ints, pct: ints } }).optional()` + refine 두 개(길이, 번호 범위, obs 길이).
- [ ] `npx vitest run tests/unit/charts-data.test.ts` → 커밋 `feat(charts): schema for model block`

### Task 4: `modelLayout`

**Files:** `src/charts/types.ts`(`ChartKey`에 `'chartModel'`), `src/charts/layouts.ts`(`monthLabels` 도우미로 차트 1 월 이름표 뽑아내기, `mulberry32` 내보내기), `src/charts/model.ts`(새), `tests/unit/charts-model.test.ts`(새)

- [ ] 실패하는 테스트(합성 데이터: 출발일 5개, 둘째 날 공휴일, 관측 7개, 기준 5개):
  - 세 단계의 `n`·`group` 배열이 같다, 모든 점 0..1 안, `variant`가 `stage:0/1/2`, 범위 밖 단계는 잘린다(`stage:2`)
  - 1단계: 공휴일 날 관측만 호박색, 선 점(뒤 `MODEL.linePts`개)은 알파 0
  - 2단계: 관측 알파 0.2, 선 점 알파 > 0.9
  - 3단계: 선 점 y가 모두 같고(0 높이), 알파 0인 끊긴 자리가 있다; |잔차| ≥ `MODEL.residHot`인 관측만 호박색; 잔차 = `residualPct(obs, base)`
  - 축 이름표가 3단계에서 `axisResid`로 바뀐다, 선 이름표는 2·3단계에만
  - `model`이 없으면 던진다
- [ ] 구현 `src/charts/model.ts`: 점 순서 = 0% 흐린 기준선(3단계는 알파 0) → 관측 점(`group` = 출발일 번호, 좌우 ±1.6px 흔들림, 시드 고정) → 선 점 240개(시간을 고르게 나눈 자리, 기준 %는 앞뒤 출발일 사이 직선 보간, `group` = 가장 가까운 출발일). 세로 −60~+110%. 눈금 +100·+50·0·−50.
- [ ] `npx vitest run tests/unit/charts-model.test.ts tests/unit/charts-layouts.test.ts` → 커밋 `feat(charts): model structure dot layout`

### Task 5: `buildLayout`에 `chartModel`

**Files:** `src/charts/build.ts`, `tests/unit/charts-draw.test.ts`

- [ ] 실패하는 테스트: 실제 `charts.json`으로 `buildLayout('chartModel', { charts }, size, strings, -1, 2)`가 `variant: 'stage:2'`, 축 이름표 = `axisResid`.
- [ ] 구현: `ChartStrings`에 `axisResid?`·`line?`, `buildLayout(…, open = -1, step = 0)`, `case 'chartModel'`(월 이름 `Intl`, `signed`).
- [ ] 커밋 `feat(charts): build model layout by stage`

### Task 6: 장면 `model` → `chartModel`

**Files:** `src/three/scenes.ts`, `tests/unit/three-scenes.test.ts`

- [ ] 테스트: `KEYS`에서 `model` → `chartModel`, `CHARTS`에 `chartModel`, `model` 지형 장면 테스트 삭제, `TEXT_SIDE`에서 `model` 빼기 → 실패 확인.
- [ ] 구현: `SceneKey`·`SCENES`에 `chartModel: { ...base, ...CHART }`, `model`·`PORTRAIT_OVERRIDE.model` 삭제.
- [ ] 커밋 `feat(three): model card becomes chart scene chartModel`

### Task 7: 단계 전환·블록·문구·e2e

**Files:** `src/motion/caption.ts`, `src/components/charts/ChartStage.tsx`, `src/components/sections/Features.tsx`, `content/{ko,en,ja}.json`, `playwright.config.ts`, `tests/e2e/charts.spec.ts`, `tests/e2e/terrain.spec.ts`

- [ ] e2e 먼저(실패 확인): `STAGES`에 `chartModel`; "③ 모델 구조: 스크롤로 문단이 바뀌면 단계 0→1→2, 2D로 그린다, 축 이름표가 바뀐다"; 휴대폰 가로 스크롤 없음; axe(`[data-scene="chartModel"]`). `terrain.spec` 대비 목록에서 옛 `[data-scene="model"]`·`.model-flow` 줄 삭제(자막 띠에는 점이 오지 않는다).
- [ ] `caption.ts`: 블록에 `data-para` = 지금 문단 번호(바뀔 때만 쓰기), 떼어 낼 때 지움.
- [ ] `ChartStage`: `stages?: number` — 블록 `data-para`를 MutationObserver로 지켜보고 `step = min(para, stages − 1)`, 바뀌면 다시 배치(`relayout`), 판에 `data-stage`.
- [ ] `Features.tsx`: `.charts-head`(머리표 + `h2#features-h` `data-reveal`) → `article.chart-block[data-scene="chartModel"]`(`--paras: 4`, `ChartStage stages={3}`, `.chart-copy` = sr-only `alt` + 칸 넷(step1, step2, step3 + flow, body2) + 코드 보기).
- [ ] 문구: `features.structure.body1` 삭제, `step1`·`step2`·`step3`·`axis`·`axisResid`·`line`·`alt` 추가(세 언어).
- [ ] `playwright.config.ts`: `E2E_PORT`(기본 4173).
- [ ] `npx tsc --noEmit` · `npx vitest run` · `npm run build` · 해당 e2e → 커밋(나눠서).

### Task 8: 검증·눈 확인·문서

- [ ] `npx tsc --noEmit`, `npx vitest run`, `npm run pytest`, `npm run build`, `npm run size`, `npm run e2e`.
- [ ] 헤드 있는 크로미움(화면 밖)으로 1440×900·390×844, 3D 켜짐·꺼짐 × 세 단계 스크린샷 → 스크래치 `model-dots/`. 글·이름표가 점과 겹치거나 판 밖으로 나가면 고친다.
- [ ] 설계 문서 "구현 결과", `CLAUDE.md`(표 7-2 줄, 페이지 구성 ③, 파이프라인 `export_charts.py`) → 커밋 → push → PR.
