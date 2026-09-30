# 계획 8-1: ⑤ 검증 설계·② 걸러내기 점 연출 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ⑤ `EVALUATION` 글 카드를 세 평가 방식이 데이터를 나누는 모습을 보여 주는 점 그림 판(`chartSplit`)으로, ② 지도와 보드 사이에 규칙별로 오류 행이 떨어져 나가는 산점도 판(`chartFilter`)을 더한다.

**Architecture:** 파이썬 추출(`export_charts.py`)이 `charts.json`에 `filter`·`split` 표본을, `export_facts.py`가 `facts.json`에 규칙별 행 수를 더한다. 사이트는 7-2의 단계(`stages`) 구조 위에 단계 안에서 저절로 넘어가는 작은 단계(`subs`)를 더하고, 배치 함수 `filterLayout`·`splitLayout`이 `(stage, sub)`마다 점 배치를 만든다. 3D·2D가 같은 배치를 쓰고, 수치 이름표는 플립으로 바뀐다.

**Tech Stack:** Python 3.11(pandas, scikit-learn) · Next.js 16 정적 export · TypeScript · zod · vitest · Playwright

**Spec:** `docs/superpowers/specs/2026-09-30-validation-filter-dots-design.md` (시안 `docs/superpowers/mockups/2026-09-30/`)

## Global Constraints

- 작업 폴더: worktree `../signal-ml-portfolio-dots`, 브랜치 `feat/validation-filter-dots`. 커밋 이메일 `55799748+hyde0395@users.noreply.github.com`
- 코드에 한국어 주석: 파일 맨 위 한두 줄(무엇을 하는 파일인지), 이유가 드러나지 않는 로직에 "왜". 코드를 그대로 옮겨 적는 주석 금지
- 문구(`content/{ko,en,ja}.json`)에 숫자 직접 기입 금지 — 수치는 `{data.…}`·`{model.…}` 자리표시만(테스트가 강제). 세 언어 키 일치
- 데이터 공개 원칙: `charts.json`에 원 단위 가격 금지, %×10 정수·분·번호만
- 초기 JS gzip ≤ 150KB(`npm run size`), 3D 청크 ≤ 280KB, `charts.json` gzip ≤ 150KB. zod·three는 `import()`로만(`tests/unit/client-imports.test.ts`)
- 이징은 expo.out 하나, bounce 금지. 플립 글자당 약 40ms·0.8초 이내(`motion/flip.ts` 그대로)
- 파이썬은 `sh scripts/py.sh`(AIRFARE_PYTHON → `~/.venvs/airfare-py311` → 항공권 저장소 `.venv`). 항공권 저장소 `.venv`를 지우거나 다시 만들지 않는다. 모델을 불러오는 `npm run charts` 전에 iCloud 워밍(항공권 저장소 CLAUDE.md)
- 같은 폴더에서 여러 에이전트가 돌면 `git add <경로>`만(`git add -A` 금지). e2e는 한 번에 하나, `E2E_PORT=<빈 포트>`
- 문구 톤: 꾸밈 없이 사실만

## Review Focus

1. **단계 바뀜 직후 sub 타이머와 3D 슬롯 경쟁** — 단계가 바뀌며 sub가 0으로 돌아갈 때 배치가 두 번(옛 sub, 새 sub) 올라가면 3D 점이 한 번 튄다. 단계 effect가 sub를 먼저 정한 뒤 한 번만 다시 배치해야 한다 → Task 6 Step 8 구현(subRef를 먼저 정하고 relayout 한 번) + Task 9 눈 확인(단계 전환 때 점 튐). ChartStage는 DOM·IntersectionObserver에 묶여 단위 테스트가 없다
2. **판이 화면 밖일 때 타이머** — 스크롤로 판을 지나쳐도 타이머가 돌면 다시 왔을 때 이미 5/5다. 밖이면 멈추고 들어오면 처음부터 → Task 6 `startSubs` stop/restart 테스트
3. **움직임 줄이기** — sub 애니메이션 없이 곧바로 마지막 sub(TSS 5/5, 걸러내기 떨어진 뒤) → Task 6 테스트, e2e(3D 꺼짐 = reducedMotion)
4. **범위 밖 값** — 소요 시간 960분 초과는 "960+" 칸, 세로 −90~+300% 밖·60분 미만은 알파 0(가장자리 줄 금지) → Task 4 테스트
5. **거꾸로 스크롤** — 단계 2 → 1 → 0으로 올라가면 떨어진 점이 되돌아온다(배치가 단계만의 함수) → Task 4 테스트

---

## File Structure

| 파일 | 할 일 | Task |
|---|---|---|
| `scripts/export_facts.py` · `scripts/tests/test_export_facts.py` | 규칙별 행 수 `data.filter` | 1 |
| `data/facts.json` · `src/lib/facts.ts` | `data.filter` 스키마, `codeLinks.paths.filter` | 1 |
| `scripts/export_charts.py` · `scripts/tests/test_export_charts.py` · `public/data/charts.2026-09-22.json` | `filter`·`split` 블록 | 2 |
| `src/charts/types.ts` · `src/charts/data.ts` · `src/three/scenes.ts` · `tests/unit/three-scenes.test.ts` · `tests/unit/charts-data.test.ts` | 키·스키마·장면 | 3 |
| `src/charts/filter.ts`(새) · `tests/unit/charts-filter.test.ts`(새) | 걸러내기 배치 | 4 |
| `src/charts/split.ts`(새) · `tests/unit/charts-split.test.ts`(새) | 검증 설계 배치 | 5 |
| `src/charts/build.ts` · `src/components/charts/ChartStage.tsx` · `src/components/charts/subTimer.ts`(새) · `src/styles/globals.css` · `tests/unit/charts-subtimer.test.ts`(새) · `tests/unit/charts-draw.test.ts` | sub 타이머·플립 이름표·연결 | 6 |
| `content/{ko,en,ja}.json` · `tests/unit/charts-content.test.ts` | 문구 | 7 |
| `src/components/sections/DataSection.tsx` · `src/components/sections/Charts.tsx` · `tests/e2e/charts.spec.ts` | 블록 배치·e2e | 8 |
| 설계 "구현 결과" · `CLAUDE.md` | 마무리 | 9 |

병렬: Task 1·2(파이썬) / Task 3 → 4·5·6(배치·그림 판) / Task 7(문구)는 파일이 겹치지 않아 동시에 돌 수 있다. Task 4·5는 가짜 데이터로 테스트하므로 Task 2를 기다리지 않는다. Task 8은 모두 끝난 뒤.

---

### Task 1: facts — 규칙별 행 수와 코드 링크

**Files:**
- Modify: `scripts/export_facts.py:31-38`(apply_filters), `:56-72`(compute_data_stats 반환)
- Modify: `data/facts.json`(`data.filter`, `codeLinks.paths.filter`), `src/lib/facts.ts:8`(chapters), `:28-35`(data 스키마)
- Test: `scripts/tests/test_export_facts.py`

**Interfaces:**
- Produces: `facts.data.filter = { unit: number; mismatch: number; direct: number; durationMax: number }`, `CodeChapter`에 `'filter'`, `export_facts.filter_steps(df) -> tuple[pd.DataFrame, dict[str, int]]`

- [ ] **Step 1: 실패하는 테스트**

`scripts/tests/test_export_facts.py`의 `test_counts_filters_and_cutoff` 아래에 더한다:

```python
def test_filter_counts_by_rule_in_pipeline_order():
    raw = frame([
        row("2026-09-22 10:00:00"),                                # 통과
        row("2026-09-22 10:01:00", dur=500, arr="16:20"),          # ① 400분 초과
        row("2026-09-22 10:02:00", price=150),                     # ① 가격 단위 누락
        row("2026-09-22 10:03:00", arr="14:00"),                   # ② 시각차 360분 ≠ 소요 150분
        row("2026-09-22 10:04:00", dur=360, arr="14:00"),          # ③ 직항인데 6시간(시각과는 맞는다)
    ])
    stats = ef.compute_data_stats(raw, "2026-09-22")
    assert stats["filter"] == {"unit": 2, "mismatch": 1, "direct": 1, "durationMax": 400}
    f = stats["filter"]
    assert stats["rawRows"] - f["unit"] - f["mismatch"] - f["direct"] == stats["filteredRows"]
    assert stats["removedImplausible"] == f["direct"]
```

- [ ] **Step 2: 실패 확인**

Run: `sh scripts/py.sh -m pytest scripts/tests/test_export_facts.py -q`
Expected: FAIL — `KeyError: 'filter'`

- [ ] **Step 3: 구현**

`scripts/export_facts.py`의 `apply_filters`를 단계별로 세는 함수로 바꾼다:

```python
def filter_steps(df: pd.DataFrame) -> tuple[pd.DataFrame, dict[str, int]]:
    """tscv_eval_v2.load_data()와 같은 순서의 필터. (필터 후 df, 규칙별 제거 행 수).
    ② 걸러내기 판(계획 8-1)이 규칙마다 떨어지는 행 수를 문구에 쓴다 — 순서가 바뀌면 규칙별 수도 바뀌므로 한 함수에서 센다."""
    n0 = len(df)
    df = df[df["duration_minutes"].notna() & (df["duration_minutes"] <= DURATION_MAX)]
    df = df[df["price"] >= PRICE_FLOOR]
    n1 = len(df)
    df = drop_inconsistent_flight_times(df)
    n2 = len(df)
    df = drop_implausible_direct_flights(df)
    return df, {"unit": n0 - n1, "mismatch": n1 - n2, "direct": n2 - len(df)}


def apply_filters(df: pd.DataFrame) -> tuple[pd.DataFrame, int]:
    """(필터 후 df, 직항 타당성 필터로 제거된 행 수) — 옛 호출부를 위해 남긴다."""
    df, counts = filter_steps(df)
    return df, counts["direct"]
```

`compute_data_stats`에서 `df, removed = apply_filters(raw)`를 `df, counts = filter_steps(raw)`로, 반환 dict의 `"removedImplausible": int(removed)`를 `"removedImplausible": int(counts["direct"])`로 바꾸고 `"collectMonths"` 줄 뒤에 더한다:

```python
        # ② 걸러내기 판(계획 8-1): 규칙별 제거 행 수와 소요 시간 상한(문구 "…분을 넘거나")
        "filter": {**{k: int(v) for k, v in counts.items()}, "durationMax": int(DURATION_MAX)},
```

- [ ] **Step 4: 통과 확인**

Run: `sh scripts/py.sh -m pytest scripts/tests/test_export_facts.py -q`
Expected: PASS

- [ ] **Step 5: facts.json 갱신과 사이트 스키마**

Run: `npm run facts` (항공권 저장소 CSV를 읽는다. 워밍: `cat ~/Documents/airfare-forecasting-ml/data/raw/flight_prices.csv > /dev/null`)
Expected: `facts.json 갱신: 2026-09-22, 242,874행`, `git diff data/facts.json`에 `"filter": {"unit": 5742, "mismatch": 826, "direct": 9387, "durationMax": 400}`만 더해짐

`data/facts.json`의 `codeLinks.paths`에 손으로 한 줄 더한다(export_facts는 codeLinks를 건드리지 않는다):

```json
      "filter": "blob/main/src/processing/features.py",
```

`src/lib/facts.ts`:

```ts
const chapters = ['problem', 'insight', 'bubble', 'validation', 'interval', 'limits', 'features', 'model', 'filter'] as const;
```

`data: z.object({ … })` 안 `collectDays` 줄 뒤에:

```ts
    // ② 걸러내기 판(계획 8-1): 규칙별 제거 행 수(① 단위·소요, ② 시각 불일치, ③ 직항 확인)와 소요 시간 상한(분)
    filter: z.object({ unit: z.number().int(), mismatch: z.number().int(), direct: z.number().int(), durationMax: z.number().int() }),
```

- [ ] **Step 6: 검사와 커밋**

Run: `npx tsc --noEmit && npx vitest run tests/unit/facts.test.ts`
Expected: PASS

```bash
git add scripts/export_facts.py scripts/tests/test_export_facts.py data/facts.json src/lib/facts.ts
git commit -m "feat(facts): per-rule filter counts and filter code link (plan 8-1)"
```

---

### Task 2: charts.json — `filter`·`split` 표본

**Files:**
- Modify: `scripts/export_charts.py`(상수·새 함수·`main`), `public/data/charts.2026-09-22.json`(재생성)
- Test: `scripts/tests/test_export_charts.py`

**Interfaces:**
- Produces (charts.json):
  - `filter: { dur: int[]; pct: int[]; rule: int[] }` — rule 0 통과 · 1 단위·소요 · 2 시각 불일치 · 3 직항 확인, pct = 정상 행의 노선·등급 평균 대비 %×10
  - `split: { fetch: int[]; date: int[]; kf: int[]; gkf: int[]; tss: int[]; fetchDays: int; show: { kf: int; gkf: int } }` — fetch = 수집 시작일부터 날짜 수, date = `charts.dates` 번호, tss −1 = 첫 학습 구간

- [ ] **Step 1: 실패하는 테스트**

`scripts/tests/test_export_charts.py` 끝에 더한다:

```python
# ② 걸러내기(계획 8-1): 원본 행마다 걸린 규칙 번호와 표본
def filter_raw():
    def r(ts, price=150_000, dur=150, arr="10:30", day="2026-10-10", cls="LCC"):
        return {"fetch_timestamp": ts, "origin": "ICN", "destination": "NRT", "airline": "JL", "airline_class": cls,
                "departure_date": day, "price": price, "stops": 0, "duration_minutes": dur,
                "departure_time_raw": f"{day} 08:00", "arrival_time_raw": f"{day} {arr}", "days_to_departure": 20}
    return pd.DataFrame([
        r("2026-09-20 10:00:00", price=100_000), r("2026-09-20 10:00:00", price=120_000),  # 통과 두 행(평균 110,000)
        r("2026-09-20 11:00:00", dur=500, arr="16:20"),     # ① 400분 초과
        r("2026-09-20 11:00:00", price=150),                # ① 가격 단위 누락
        r("2026-09-20 12:00:00", arr="14:00"),              # ② 시각차 ≠ 소요
        r("2026-09-20 13:00:00", dur=360, arr="14:00", price=330_000),  # ③ 직항인데 6시간
        r("2026-09-20 14:00:00", dur=None),                 # ① 소요 없음 — 그릴 수 없어 표본에서 빠진다
        r("2026-09-23 09:00:00"),                           # 기준일 뒤 — 아예 빠진다
    ])


def test_rule_codes_follow_pipeline_order():
    raw = filter_raw()
    cut = raw[pd.to_datetime(raw["fetch_timestamp"]) < pd.Timestamp("2026-09-23")]
    assert ec.rule_codes(cut).tolist() == [0, 0, 1, 1, 2, 3, 1]


def test_filter_block_percent_of_kept_mean_drops_missing_duration_and_is_seeded():
    b = ec.filter_block(filter_raw(), "2026-09-22", size=100, seed=1)
    assert set(b) == {"dur", "pct", "rule"}
    assert sorted(b["rule"]) == [0, 0, 1, 1, 2, 3]            # 소요 없는 행·기준일 뒤 행은 없다
    by_rule = dict(zip(b["pct"], b["rule"]))
    assert by_rule[-91] == 0 and by_rule[91] == 0              # 100,000·120,000 → 평균 110,000 대비 −9.1%·+9.1%
    assert by_rule[2000] == 3                                  # 330,000 → +200%
    assert 500 in b["dur"] and 360 in b["dur"]
    assert ec.filter_block(filter_raw(), "2026-09-22", size=100, seed=1) == b
    assert not {100_000, 120_000, 330_000, 150} & set(b["pct"])  # 원 단위 값이 없다
    assert len(ec.filter_block(filter_raw(), "2026-09-22", size=3, seed=1)["rule"]) == 3


# ⑤ 검증 설계(계획 8-1): 수집 시각 순으로 정렬한 뒤 폴드 배정
def split_kept():
    rows = []
    for i in range(60):
        day = ["2026-10-01", "2026-10-02", "2026-10-03"][i % 3]
        dest = "NRT" if i % 2 else "KIX"
        rows.append({"fetch_timestamp": f"2026-09-{1 + i // 4:02d} 10:{i % 60:02d}:00", "origin": "ICN",
                     "destination": dest, "departure_date": day})
    return pd.DataFrame(rows).sample(frac=1, random_state=0)  # 수집 순서를 섞어 둔다 — 함수가 정렬해야 한다


def test_split_block_matches_sklearn_folds_on_fetch_order():
    from sklearn.model_selection import GroupKFold, KFold, TimeSeriesSplit
    kept = split_kept()
    b = ec.split_block(kept, ["2026-10-01", "2026-10-02", "2026-10-03"], size=1000, seed=1)
    n = 60
    assert len(b["fetch"]) == len(b["date"]) == len(b["kf"]) == len(b["gkf"]) == len(b["tss"]) == n
    assert b["fetch"] == sorted(b["fetch"]) and b["fetch"][0] == 0 and b["fetchDays"] == b["fetch"][-1] + 1
    # K-Fold(shuffle=False)는 연속 구간 — 정렬된 순서에서 폴드 번호가 줄지 않는다
    assert b["kf"] == sorted(b["kf"]) and set(b["kf"]) == {0, 1, 2, 3, 4}
    want = [-1] * n
    for i, (_, te) in enumerate(TimeSeriesSplit(5).split(np.zeros(n))):
        for j in te:
            want[j] = i
    assert b["tss"] == want and b["tss"].count(-1) == n - 5 * (n // 6)
    # GroupKFold: 같은 노선·출발일 행은 같은 폴드
    df = kept.assign(_ts=pd.to_datetime(kept["fetch_timestamp"])).sort_values("_ts", kind="stable")
    g = (df["destination"] + df["departure_date"]).tolist()
    seen = {}
    for key, f in zip(g, b["gkf"]):
        assert seen.setdefault(key, f) == f
    assert b["show"] == {"kf": 2, "gkf": 0}
    assert set(b["date"]) == {0, 1, 2}


def test_split_block_samples_in_fetch_order_and_is_seeded():
    kept = split_kept()
    a = ec.split_block(kept, ["2026-10-01", "2026-10-02", "2026-10-03"], size=10, seed=3)
    assert len(a["tss"]) == 10 and a["fetch"] == sorted(a["fetch"])
    assert ec.split_block(kept, ["2026-10-01", "2026-10-02", "2026-10-03"], size=10, seed=3) == a
```

- [ ] **Step 2: 실패 확인**

Run: `sh scripts/py.sh -m pytest scripts/tests/test_export_charts.py -q`
Expected: FAIL — `AttributeError: module 'export_charts' has no attribute 'rule_codes'`

- [ ] **Step 3: 구현**

`scripts/export_charts.py` 모듈 설명 목록 끝(`- 개별 행의 가격은…` 앞)에 더한다:

```
- filter: ② 걸러내기(계획 8-1) — 기준일까지의 원본 행 표본 4,000개(실제 비율 그대로)의 소요 분, 정상 행의 노선·등급
  평균 대비 %×10, 걸린 규칙 번호(0 통과, 1 단위·소요, 2 시각 불일치, 3 직항 확인).
- split: ⑤ 검증 설계(계획 8-1) — 정상 행을 수집 시각 순으로 정렬해 K-Fold·GroupKFold·TimeSeriesSplit(각 5겹) 폴드를 전체에서
  배정한 뒤 표본 4,000개의 수집일 번호·출발일 번호·폴드 번호. 모델 재학습은 없다.
```

import에 더한다(`from export_facts import AIRFARE_ROOT, METRICS_PATH` 줄을 바꾼다):

```python
from export_facts import (  # noqa: E402
    AIRFARE_ROOT, DURATION_MAX, METRICS_PATH, PRICE_FLOOR, drop_implausible_direct_flights, drop_inconsistent_flight_times,
)
```

상수 끝(`MODEL_RESID_HOT` 뒤)에:

```python
FILTER_SAMPLE = 4000          # ② 걸러내기 점 개수(계획 8-1) — 실제 비율 그대로라 규칙 ②는 10여 개뿐이다(부풀리지 않는다)
SPLIT_SAMPLE = 4000           # ⑤ 검증 설계 점 개수
N_FOLDS = 5                   # 항공권 저장소 tscv_eval_v2.py와 같은 5겹
```

`compute_model` 뒤, `main` 앞에 더한다:

```python
def rule_codes(cut: pd.DataFrame) -> pd.Series:
    """기준일까지 자른 원본 행마다 걸린 규칙 번호(0 통과, 1 단위·소요, 2 시각 불일치, 3 직항 확인).
    export_facts.filter_steps·export_terrain.split_rows와 같은 순서 — 앞 규칙에 걸린 행은 뒤 규칙으로 세지 않는다."""
    code = pd.Series(0, index=cut.index)
    r1 = ~(cut["duration_minutes"].notna() & (cut["duration_minutes"] <= DURATION_MAX)) | (cut["price"] < PRICE_FLOOR)
    code[r1] = 1
    d1 = cut[~r1]
    d2 = drop_inconsistent_flight_times(d1)
    code[d1.index.difference(d2.index)] = 2
    d3 = drop_implausible_direct_flights(d2)
    code[d2.index.difference(d3.index)] = 3
    return code


def filter_block(raw: pd.DataFrame, as_of: str, size: int = FILTER_SAMPLE, seed: int = SEED) -> dict:
    """② 걸러내기 표본. 가격은 정상 행의 노선·등급 평균 대비 %(지형과 같은 기준)로만 — 걸린 행도 같은 평균으로 잰다.
    소요 시간이 없는 행은 가로 자리가 없어 뺀다(규칙별 행 수는 facts.data.filter가 따로 센다)."""
    cutoff = pd.Timestamp(as_of) + pd.Timedelta(days=1)
    cut = raw[pd.to_datetime(raw["fetch_timestamp"]) < cutoff].reset_index(drop=True)
    code = rule_codes(cut)
    base = cut[code == 0].groupby(et.ROUTE_CLASS)["price"].mean().rename("base")
    x = cut.assign(rule=code).join(base, on=et.ROUTE_CLASS)
    x = x[x["duration_minutes"].notna() & x["base"].notna()]
    take = x.sample(n=min(size, len(x)), random_state=seed).sort_index()
    pct = (take["price"] / take["base"] - 1) * 1000
    return {
        "dur": take["duration_minutes"].round().astype(int).tolist(),
        "pct": pct.round().astype(int).tolist(),
        "rule": take["rule"].astype(int).tolist(),
    }


def fold_ids(n: int, splitter, groups=None) -> np.ndarray:
    """행마다 평가로 쓰인 폴드 번호. 한 번도 평가로 안 쓰인 행(TimeSeriesSplit의 첫 학습 구간)은 −1."""
    out = np.full(n, -1)
    for i, (_, te) in enumerate(splitter.split(np.zeros(n), groups=groups)):
        out[te] = i
    return out


def split_block(kept: pd.DataFrame, dates: list[str], size: int = SPLIT_SAMPLE, seed: int = SEED, n_folds: int = N_FOLDS) -> dict:
    """⑤ 검증 설계 표본. 항공권 저장소 tscv_eval_v2.py처럼 수집 시각으로 정렬한 뒤 폴드를 전체 행에서 배정하고 표본을 뽑는다.
    그쪽은 sort_values 기본(안정 정렬 아님)이라 같은 시각 행 몇 개가 경계에서 다를 수 있다 — 그림에는 드러나지 않는다.
    show: 판에 보여 줄 폴드 — K-Fold는 가운데(평가 구간 앞뒤가 모두 학습인 것이 보이게), GroupKFold는 첫 폴드."""
    from sklearn.model_selection import GroupKFold, KFold, TimeSeriesSplit
    df = kept.assign(_ts=pd.to_datetime(kept["fetch_timestamp"])).sort_values("_ts", kind="stable").reset_index(drop=True)
    n = len(df)
    groups = (df["origin"].astype(str) + "_" + df["destination"].astype(str) + "_"
              + pd.to_datetime(df["departure_date"]).dt.strftime("%Y%m%d"))
    kf = fold_ids(n, KFold(n_folds, shuffle=False))
    gkf = fold_ids(n, GroupKFold(n_folds), groups)
    tss = fold_ids(n, TimeSeriesSplit(n_folds))
    fetch = (df["_ts"].dt.normalize() - df["_ts"].min().normalize()).dt.days.to_numpy()
    idx = np.sort(np.random.default_rng(seed).choice(n, size=min(size, n), replace=False))
    index = {d: i for i, d in enumerate(dates)}
    return {
        "fetch": fetch[idx].astype(int).tolist(),
        "date": df["departure_date"].iloc[idx].map(index).astype(int).tolist(),
        "kf": kf[idx].astype(int).tolist(),
        "gkf": gkf[idx].astype(int).tolist(),
        "tss": tss[idx].astype(int).tolist(),
        "fetchDays": int(fetch.max()) + 1,
        "show": {"kf": n_folds // 2, "gkf": 0},
    }
```

`main`의 `charts["model"] = …` 줄 뒤에:

```python
    charts["filter"] = filter_block(raw, as_of)
    charts["split"] = split_block(kept, charts["dates"])
```

`main` 끝(마지막 print 뒤)에:

```python
    f, sp = charts["filter"], charts["split"]
    print(f"filter: 표본 {len(f['rule'])}개, 규칙별 {[f['rule'].count(r) for r in range(4)]}, "
          f"960분 초과 {sum(d > 960 for d in f['dur'])}개 / split: 표본 {len(sp['tss'])}개, 수집 {sp['fetchDays']}일, "
          f"TSS 첫 학습 구간 {sp['tss'].count(-1)}개")
```

- [ ] **Step 4: 통과 확인**

Run: `sh scripts/py.sh -m pytest scripts/tests -q`
Expected: PASS(기존 테스트 포함)

- [ ] **Step 5: 재생성과 다른 키 불변 확인**

```bash
cp public/data/charts.2026-09-22.json /tmp/charts-before.json
# 워밍(항공권 저장소 CLAUDE.md): find … | xargs cat > /dev/null
npm run charts
node -e 'const a=require("/tmp/charts-before.json"),b=require("./public/data/charts.2026-09-22.json");for(const k of Object.keys(a)){if(JSON.stringify(a[k])!==JSON.stringify(b[k]))throw new Error(k+" 바뀜")};console.log("다른 키 그대로", Object.keys(b))'
```
Expected: 출력 끝 `filter: 표본 4000개, 규칙별 [≈3911, ≈89, ≈13, ≈145]` 근처, `split: 표본 4000개, 수집 153일`, gzip 150KB 이하, "다른 키 그대로"

- [ ] **Step 6: 커밋**

```bash
git add scripts/export_charts.py scripts/tests/test_export_charts.py public/data/charts.2026-09-22.json
git commit -m "feat(charts): filter and split samples for plan 8-1"
```

---

### Task 3: 키·스키마·장면

**Files:**
- Modify: `src/charts/types.ts:5`(ChartKey), `:25-26`(ChartLabel text cls)
- Modify: `src/charts/data.ts`(chartsSchema)
- Modify: `src/three/scenes.ts:5-6`(SceneKey), SCENES
- Test: `tests/unit/three-scenes.test.ts:7-9`, `tests/unit/charts-data.test.ts`

**Interfaces:**
- Produces: `ChartKey` += `'chartFilter' | 'chartSplit'`; `SceneKey` 같은 두 이름(차트 장면); `ChartLabel` text `cls` += `'stat' | 'statSm' | 'rule' | 'ruleOn' | 'keyDot' | 'keyAmber' | 'keyDim'`; `ChartsData['filter']`, `ChartsData['split']`(Task 2 형식, 둘 다 optional)

- [ ] **Step 1: 실패하는 테스트**

`tests/unit/three-scenes.test.ts` 7~9줄을 바꾼다:

```ts
const KEYS: SceneKey[] = ['hero', 'about', 'problem', 'dataBoard', 'chartFilter', 'model', 'chartModel', 'features', 'chartDepart', 'chartCurve', 'bubble',
  'chartSplit', 'validation', 'chartCloud', 'limits', 'demo', 'contact'];
const CHARTS: SceneKey[] = ['chartFilter', 'chartModel', 'features', 'chartDepart', 'chartCurve', 'chartSplit', 'chartCloud'];
```

그리고 19줄 테스트 이름의 "차트 장면 다섯 개(③ 모델 구조 chartModel 포함, 계획 7-2)"를 "차트 장면 일곱 개(② 걸러내기·⑤ 검증 설계 포함, 계획 8-1)"로 바꾼다.

`tests/unit/charts-data.test.ts`에 더한다(파일 위쪽의 유효한 charts 객체 만드는 도우미 이름을 확인해 `valid()` 자리에 쓴다 — 없으면 실제 `public/data/charts.2026-09-22.json`을 `readFileSync`로 읽어 쓴다):

```ts
describe('charts.json filter·split(계획 8-1)', () => {
  const ok = () => JSON.parse(readFileSync(`public/data/charts.${facts.dataVersion}.json`, 'utf8'));
  const withBlocks = () => ({
    ...ok(),
    filter: { dur: [150, 500], pct: [10, -20], rule: [0, 1] },
    split: { fetch: [0, 3], date: [0, 1], kf: [0, 4], gkf: [2, 0], tss: [-1, 4], fetchDays: 4, show: { kf: 2, gkf: 0 } },
  });
  it('형식이 맞으면 받는다, 없어도 받는다', () => {
    expect(() => chartsSchema.parse(withBlocks())).not.toThrow();
    const { filter: _f, split: _s, ...rest } = withBlocks();
    expect(() => chartsSchema.parse(rest)).not.toThrow();
  });
  it('filter 길이가 다르거나 규칙 번호가 0~3 밖이면 막는다', () => {
    expect(() => chartsSchema.parse({ ...withBlocks(), filter: { dur: [1], pct: [1, 2], rule: [0] } })).toThrow();
    expect(() => chartsSchema.parse({ ...withBlocks(), filter: { dur: [1], pct: [1], rule: [4] } })).toThrow();
  });
  it('split 출발일 번호가 dates 밖이거나 폴드가 범위 밖이면 막는다', () => {
    const b = withBlocks();
    expect(() => chartsSchema.parse({ ...b, split: { ...b.split, date: [0, 9999] } })).toThrow();
    expect(() => chartsSchema.parse({ ...b, split: { ...b.split, tss: [-2, 0] } })).toThrow();
    expect(() => chartsSchema.parse({ ...b, split: { ...b.split, fetch: [0, 4] } })).toThrow(); // fetchDays 4면 0..3
  });
});
```

(필요한 import: `import { readFileSync } from 'node:fs'`, `import { chartsSchema } from '@/charts/data'`, `import { facts } from '@/lib/facts'` — 이미 있으면 그대로)

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/unit/three-scenes.test.ts tests/unit/charts-data.test.ts`
Expected: FAIL — 장면 키 목록 불일치, filter 범위 검사가 통과해 버림

- [ ] **Step 3: 구현**

`src/charts/types.ts`:

```ts
// chartModel: ③ 모델 구조 점(계획 7-2), chartFilter: ② 걸러내기·chartSplit: ⑤ 검증 설계(계획 8-1)
export type ChartKey = 'features' | 'chartModel' | 'chartDepart' | 'chartCurve' | 'chartCloud' | 'chartFilter' | 'chartSplit';
```

`ChartLabel`의 text 줄:

```ts
  // stat·statSm: 판 위 수치(글자가 바뀌면 플립, 계획 8-1). rule·ruleOn: 걸러내기 규칙 목록(아직/적용됨).
  // keyDot·keyAmber·keyDim: 범례(앞에 그 색 점)
  | { type: 'text'; x: number; y: number; text: string; align: 'start' | 'center' | 'end';
      cls: 'tick' | 'axis' | 'month' | 'holiday' | 'feature' | 'head' | 'stat' | 'statSm' | 'rule' | 'ruleOn' | 'keyDot' | 'keyAmber' | 'keyDim' }
```

`src/charts/data.ts` — `model: …optional(),` 뒤에:

```ts
  // ② 걸러내기(계획 8-1): 원본 행 표본의 소요 분, 정상 행 노선·등급 평균 대비 %×10, 걸린 규칙(0 통과·1 단위·소요·2 시각 불일치·3 직항 확인)
  filter: z.object({ dur: ints, pct: ints, rule: ints }).optional(),
  // ⑤ 검증 설계(계획 8-1): 수집일 번호, 출발일 번호(dates), 평가로 쓰인 폴드(K-Fold·GroupKFold 0..4, TSS −1..4), 판에 보여 줄 폴드
  split: z.object({
    fetch: ints, date: ints, kf: ints, gkf: ints, tss: ints,
    fetchDays: z.number().int().positive(),
    show: z.object({ kf: z.number().int().min(0).max(4), gkf: z.number().int().min(0).max(4) }),
  }).optional(),
```

마지막 `.refine(… '모델 구조 기준 가격이 하나도 없다');`의 `;`를 지우고 이어 붙인다:

```ts
  .refine((c) => !c.filter || (c.filter.dur.length === c.filter.pct.length && c.filter.rule.length === c.filter.dur.length
    && c.filter.rule.every((r) => r >= 0 && r <= 3)), '걸러내기 배열 모양이 다르다')
  .refine((c) => {
    const s = c.split;
    if (!s) return true;
    const n = s.fetch.length;
    return [s.date, s.kf, s.gkf, s.tss].every((a) => a.length === n)
      && s.date.every((i) => i >= 0 && i < c.dates.length)
      && s.fetch.every((f) => f >= 0 && f < s.fetchDays)
      && [...s.kf, ...s.gkf].every((f) => f >= 0 && f <= 4) && s.tss.every((f) => f >= -1 && f <= 4);
  }, '검증 설계 배열 모양이 다르다');
```

`src/three/scenes.ts` SceneKey:

```ts
export type SceneKey = 'hero' | 'about' | 'problem' | 'dataBoard' | 'chartFilter' | 'model' | 'chartModel' | 'features' | 'chartDepart' | 'chartCurve'
  | 'bubble' | 'chartSplit' | 'validation' | 'chartCloud' | 'limits' | 'demo' | 'contact';
```

SCENES의 `dataBoard` 줄 뒤에:

```ts
  // ② 걸러내기(계획 8-1): 점이 소요 시간 × 가격 산점도로 모이고 규칙마다 걸린 점이 떨어진다
  chartFilter: { ...base, ...CHART },
```

`bubble` 줄 뒤에:

```ts
  // ⑤ 검증 설계(계획 8-1): 점이 수집일 × 출발일로 모이고 평가 방식마다 학습·평가 색이 바뀐다
  chartSplit: { ...base, ...CHART },
```

- [ ] **Step 4: 통과 확인**

Run: `npx tsc --noEmit && npx vitest run`
Expected: 타입 오류는 `src/charts/build.ts`의 `switch`가 새 키를 다루지 않는 것 하나일 수 있다 — 그러면 `build.ts` switch 끝에 임시로 두지 말고, Task 6 전까지 `default: throw new Error(\`배치가 없다: ${key}\`)`를 더해 통과시킨다(Task 6이 실제 case로 바꾼다). 테스트 PASS

- [ ] **Step 5: 커밋**

```bash
git add src/charts/types.ts src/charts/data.ts src/three/scenes.ts src/charts/build.ts tests/unit/three-scenes.test.ts tests/unit/charts-data.test.ts
git commit -m "feat(charts): chartFilter/chartSplit keys, schema and scenes (plan 8-1)"
```

---

### Task 4: 걸러내기 배치 `filterLayout`

**Files:**
- Create: `src/charts/filter.ts`
- Test: `tests/unit/charts-filter.test.ts`

**Interfaces:**
- Consumes: `ChartsData['filter']`(Task 3), `Pts`·`mulberry32`·`PlotSize`(`src/charts/layouts.ts`), `TONE`·`CHART_FOCUS_DIM`·`ChartLayout`·`ChartLabel`(`types.ts`)
- Produces:
  - `export const FILTER = { stages: 3, subs: [1, 2, 2], subMs: 700, … } as const`
  - `export type FilterTexts = { axisX: string; axisY: string; box: string; rowsRaw: string; rowsKept: string; minutes(v: number): string; pct(v: number): string }`
  - `export function filterState(rule: number, stage: number, sub: number): 'plain' | 'lit' | 'fallen'`
  - `export function filterLayout(d: ChartsData, size: PlotSize, stage: number, sub: number, s: FilterTexts): ChartLayout` — `variant = 'stage:<st>:<sb>'`, 첫 이름표 = 행 수(`cls: 'stat'`)

- [ ] **Step 1: 실패하는 테스트**

`tests/unit/charts-filter.test.ts`:

```ts
// ② 걸러내기 배치(계획 8-1): 규칙마다 호박색 → 떨어짐, 거꾸로 가면 되돌아옴, 범위 밖 처리, 점 개수 불변
import { describe, expect, it } from 'vitest';
import type { ChartsData } from '@/charts/data';
import { FILTER, filterLayout, filterState } from '@/charts/filter';
import { TONE } from '@/charts/types';

// dur·pct·rule 한 쌍씩: 통과 2개, ① 1개(400분 초과), ② 1개, ③ 1개, 960분 초과 통과 1개(칸), 범위 밖 %(+500%) 1개
const data = {
  dates: ['2026-05-15', '2026-05-16'],
  filter: {
    dur: [150, 140, 665, 150, 320, 1200, 150],
    pct: [100, -200, 50, 0, 2350, 0, 5000],
    rule: [0, 0, 1, 2, 3, 1, 0],
  },
} as unknown as ChartsData;
const S = { axisX: '소요', axisY: '평균 대비', box: '직항인데 오래', rowsRaw: '258,829 ROWS', rowsKept: '242,874 ROWS', minutes: (v: number) => `${v}`, pct: (v: number) => `${v}%` };
const size = { w: 1080, h: 414 };
const pointOf = (L: ReturnType<typeof filterLayout>, k: number) => {
  // 표본 점은 규칙 선·상자 점 뒤에 온다 — 표본 k번째 = 뒤에서 (n - k)번째
  const i = L.n - data.filter!.dur.length + k;
  return { x: L.x[i], y: L.y[i], a: L.alpha[i], tone: L.tone[i] };
};

describe('filterState', () => {
  it('규칙 ①·②는 단계 1에서 켜지고 sub 1부터 떨어진다, ③은 단계 2', () => {
    expect(filterState(1, 0, 0)).toBe('plain');
    expect(filterState(1, 1, 0)).toBe('lit');
    expect(filterState(2, 1, 1)).toBe('fallen');
    expect(filterState(1, 2, 0)).toBe('fallen'); // 앞 단계에서 떨어진 점은 그대로
    expect(filterState(3, 1, 1)).toBe('plain');
    expect(filterState(3, 2, 0)).toBe('lit');
    expect(filterState(3, 2, 1)).toBe('fallen');
    expect(filterState(0, 2, 1)).toBe('plain');
  });
});

describe('filterLayout', () => {
  it('단계·sub마다 점 개수가 같고 variant가 다르다, 좌표는 판 안(떨어진 점만 아래 밖)', () => {
    const all = [[0, 0], [1, 0], [1, 1], [2, 0], [2, 1]].map(([st, sb]) => filterLayout(data, size, st, sb, S));
    expect(new Set(all.map((l) => l.n)).size).toBe(1);
    expect(new Set(all.map((l) => l.variant))).toEqual(new Set(['stage:0:0', 'stage:1:0', 'stage:1:1', 'stage:2:0', 'stage:2:1']));
    for (const L of all) for (let i = 0; i < L.n; i++) {
      expect(L.x[i]).toBeGreaterThanOrEqual(0); expect(L.x[i]).toBeLessThanOrEqual(1);
      if (L.alpha[i] > 0) { expect(L.y[i]).toBeGreaterThanOrEqual(0); expect(L.y[i]).toBeLessThanOrEqual(1); }
    }
  });
  it('걸린 점은 켜질 때 호박색, 떨어지면 알파 0에 판 아래, 거꾸로 가면 제자리', () => {
    const lit = filterLayout(data, size, 1, 0, S), fell = filterLayout(data, size, 1, 1, S), back = filterLayout(data, size, 0, 0, S);
    expect(pointOf(lit, 2).tone).toBe(TONE.amber);
    expect(pointOf(fell, 2).a).toBe(0);
    expect(pointOf(fell, 2).y).toBeGreaterThan(1);
    expect(pointOf(back, 2).tone).toBe(TONE.dot);
    expect(pointOf(back, 2).y).toBeCloseTo(pointOf(lit, 2).y);
    expect(pointOf(fell, 4).a).toBeGreaterThan(0); // ③은 아직
  });
  it('960분 넘는 행은 오른쪽 "960+" 칸, 세로 범위 밖(+500%)은 알파 0', () => {
    const L = filterLayout(data, size, 0, 0, S);
    const main = pointOf(L, 0).x, over = pointOf(L, 5).x;
    expect(over).toBeGreaterThan(main);
    expect(L.labels.some((l) => l.type === 'text' && l.text === '960+')).toBe(true);
    expect(pointOf(L, 6).a).toBe(0);
  });
  it('첫 이름표는 행 수 — 마지막(단계 2, sub 1)에만 걸러낸 뒤 값', () => {
    const first = (st: number, sb: number) => filterLayout(data, size, st, sb, S).labels[0];
    expect(first(0, 0)).toMatchObject({ cls: 'stat', text: '258,829 ROWS' });
    expect(first(2, 0)).toMatchObject({ text: '258,829 ROWS' });
    expect(first(2, 1)).toMatchObject({ text: '242,874 ROWS' });
  });
  it('규칙 이름표: 적용된 규칙은 ruleOn', () => {
    const cls = (st: number) => filterLayout(data, size, st, 0, S).labels.filter((l) => l.type === 'text' && /^RULE/.test(l.text)).map((l) => (l as { cls: string }).cls);
    expect(cls(0)).toEqual(['rule', 'rule', 'rule']);
    expect(cls(1)).toEqual(['ruleOn', 'ruleOn', 'rule']);
    expect(cls(2)).toEqual(['ruleOn', 'ruleOn', 'ruleOn']);
  });
  it('좁은 판(390px)도 이름표가 판 안', () => {
    const L = filterLayout(data, { w: 358, h: 354 }, 2, 1, S);
    for (const l of L.labels) { expect(l.x).toBeGreaterThanOrEqual(0); expect(l.x).toBeLessThanOrEqual(1); expect(l.y).toBeGreaterThanOrEqual(0); expect(l.y).toBeLessThanOrEqual(1); }
  });
  it('filter가 없으면 던진다', () => {
    expect(() => filterLayout({ dates: [] } as unknown as ChartsData, size, 0, 0, S)).toThrow();
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/unit/charts-filter.test.ts`
Expected: FAIL — `Cannot find module '@/charts/filter'`

- [ ] **Step 3: 구현**

`src/charts/filter.ts`:

```ts
// ② 걸러내기 점(계획 8-1, 설계 2026-09-30-validation-filter-dots-design §4.1): 원본 행 표본을 소요 시간(가로) × 노선·등급 평균
// 대비 %(세로)에 뿌리고, 자막 칸마다 규칙을 하나씩 적용한다 — 걸린 점이 호박색으로 켜졌다가(sub 0) 판 아래로 떨어진다(sub 1).
// 배치는 (단계, sub)만의 함수라 거꾸로 스크롤하면 떨어진 점이 되돌아온다. 점 순서·개수는 모든 단계에서 같다(3D 슬롯 전환).
import type { ChartsData } from './data';
import { mulberry32, Pts, type PlotSize } from './layouts';
import { CHART_FOCUS_DIM, TONE, type ChartLabel, type ChartLayout } from './types';

// x0·x1: 가로 소요 분 범위, over: 판 오른쪽 끝 "960+" 칸 폭(판 폭 비율) — 400분 초과 행 중앙값이 665분, 90%가 1,085분
// 아래라 960에서 자르고 넘는 행은 칸 안에 흩어 둔다(가장자리에 세로 줄로 붙지 않게). lo·hi: 세로 %, 밖은 알파 0(7-2 규칙).
// ruleMin: 규칙 ① 소요 상한(facts data.filter.durationMax와 같은 400분). boxFrom: 규칙 ③ 상자 왼쪽 — 노선별 직항 p05 최댓값
// 150분 + 여유 65분(항공권 저장소 constants.py). subs: 단계마다 작은 단계 수(켜짐 → 떨어짐), subMs: 그 간격
export const FILTER = {
  stages: 3, subs: [1, 2, 2], subMs: 700, wideMinPx: 560,
  x0: 60, x1: 960, over: 0.05, lo: -90, hi: 300, ruleMin: 400, boxFrom: 215, seed: 11,
} as const;
const RULES = ['RULE 1 · DURATION · UNIT', 'RULE 2 · TIME MISMATCH', 'RULE 3 · DIRECT CHECK'];

export type FilterTexts = {
  axisX: string; axisY: string; box: string;
  rowsRaw: string; rowsKept: string; // "258,829 ROWS"처럼 이미 형식을 갖춘 글자(서버가 facts로 만든다)
  minutes(v: number): string; pct(v: number): string;
};

// 규칙 번호(0 통과)가 이 단계·sub에서 어떤 모습인지. ①·②는 단계 1, ③은 단계 2에서 켜지고, 그 단계 sub 1부터 떨어진다
export function filterState(rule: number, stage: number, sub: number): 'plain' | 'lit' | 'fallen' {
  if (rule === 0) return 'plain';
  const at = rule === 3 ? 2 : 1;
  if (stage < at) return 'plain';
  return stage > at || sub >= 1 ? 'fallen' : 'lit';
}

export function filterLayout(d: ChartsData, size: PlotSize, stage: number, sub: number, s: FilterTexts): ChartLayout {
  const f = d.filter;
  if (!f) throw new Error('charts.json에 filter가 없다');
  const st = Math.max(0, Math.min(FILTER.stages - 1, Math.floor(stage)));
  const sb = Math.max(0, Math.min(FILTER.subs[st] - 1, Math.floor(sub)));
  const W = size.w, H = size.h, wide = W >= FILTER.wideMinPx;
  // 넓은 판은 오른쪽 26%에 규칙 목록·행 수, 좁은 판은 위쪽 줄에 둔다
  const gx0 = W * (wide ? 0.08 : 0.14), gx1 = wide ? W * 0.72 : W - 8;
  const top = H * (wide ? 0.1 : 0.3), bottom = H * 0.86;
  const gxMain = gx0 + (gx1 - gx0) * (1 - FILTER.over);
  const X = (m: number) => gx0 + (gxMain - gx0 - 6) * ((m - FILTER.x0) / (FILTER.x1 - FILTER.x0));
  const Y = (v: number) => top + (bottom - top) * (1 - (v - FILTER.lo) / (FILTER.hi - FILTER.lo));
  const p = new Pts();
  const dot = wide ? 2.2 : 1.7;
  const lineA = 0.55;

  // 규칙 ① 세로 점선(400분)과 규칙 ③ 점선 상자 — 점 개수는 단계와 무관하게 같고 보일 때만 알파를 준다
  for (let y = top; y <= bottom; y += 7) p.add(X(FILTER.ruleMin) / W, y / H, 1.5, st >= 1 ? lineA : 0, TONE.amber);
  const bx0 = X(FILTER.boxFrom), bx1 = X(FILTER.ruleMin);
  for (let x = bx0; x <= bx1; x += 7) for (const y of [top, bottom]) p.add(x / W, y / H, 1.5, st === 2 ? lineA : 0, TONE.amber);
  for (let y = top; y <= bottom; y += 7) p.add(bx0 / W, y / H, 1.5, st === 2 ? lineA : 0, TONE.amber);

  // 표본 점: 960+ 칸의 좌우 흩어짐·떨어질 때 옆으로 비껴 가는 폭은 고정 시드 — 단계가 바뀌어도 칸 안 자리는 그대로
  const rand = mulberry32(FILTER.seed);
  for (let k = 0; k < f.dur.length; k++) {
    const m = f.dur[k], v = f.pct[k] / 10, rule = f.rule[k];
    const jitter = rand(), drift = (rand() - 0.5) * 0.04;
    const x = m > FILTER.x1 ? gxMain + (gx1 - gxMain) * (0.2 + 0.6 * jitter) : X(Math.max(FILTER.x0, m));
    const visible = m >= FILTER.x0 && v >= FILTER.lo && v <= FILTER.hi;
    const state = filterState(rule, st, sb);
    if (state === 'fallen') p.add(Math.min(1, Math.max(0, x / W + drift)), 1.12, dot, 0, TONE.amber);
    else p.add(x / W, (visible ? Y(v) : Y(0)) / H, dot, visible ? 0.7 : 0, state === 'lit' ? TONE.amber : TONE.dot);
  }

  // 이름표: 행 수를 맨 앞에 둔다 — 그림 판이 이름표를 순서(번호)로 그려, 같은 자리의 플립이 단계 사이에 이어진다
  const labels: ChartLabel[] = [];
  const kept = st === 2 && sb >= 1;
  const sideX = wide ? W * 0.76 : gx0;
  labels.push({ type: 'text', x: sideX / W, y: (wide ? H * 0.62 : H * 0.07) / H, text: kept ? s.rowsKept : s.rowsRaw, align: 'start', cls: 'stat' });
  RULES.forEach((text, i) => {
    const on = i < 2 ? st >= 1 : st >= 2;
    const x = wide ? sideX : gx0 + ((W - 8 - gx0) / 3) * i;
    const y = wide ? H * 0.12 + i * 24 : H * 0.18;
    labels.push({ type: 'text', x: x / W, y: y / H, text: wide ? text : text.slice(0, 6), align: 'start', cls: on ? 'ruleOn' : 'rule' });
  });
  for (const m of [120, 240, 360, 480, 720]) labels.push({ type: 'text', x: X(m) / W, y: (bottom + (H - bottom) * 0.45) / H, text: s.minutes(m), align: 'center', cls: 'tick' });
  labels.push({ type: 'text', x: ((gxMain + gx1) / 2) / W, y: (bottom + (H - bottom) * 0.45) / H, text: `${FILTER.x1}+`, align: 'center', cls: 'tick' });
  for (const v of [200, 100, 0, -50]) labels.push({ type: 'text', x: (gx0 - 6) / W, y: Y(v) / H, text: s.pct(v), align: 'end', cls: 'tick' });
  labels.push({ type: 'text', x: gx0 / W, y: (top * 0.45) / H, text: s.axisY, align: 'start', cls: 'axis' });
  labels.push({ type: 'text', x: gxMain / W, y: (bottom + (H - bottom) * 0.85) / H, text: s.axisX, align: 'end', cls: 'axis' });
  if (st === 2) labels.push({ type: 'text', x: bx0 / W, y: Math.max(8, top - 10) / H, text: s.box, align: 'start', cls: 'ruleOn' });
  return { ...p.done(labels, TONE.text, CHART_FOCUS_DIM), variant: `stage:${st}:${sb}` };
}
```

주의: 좁은 판에서 `top * 0.45`(축 이름)가 행 수(`H*0.07`)·규칙 줄(`H*0.18`)과 겹치면 축 이름을 `top - 12`로 옮긴다 — Step 4 "좁은 판" 테스트와 Task 9 눈 확인으로 본다.

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run tests/unit/charts-filter.test.ts`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/charts/filter.ts tests/unit/charts-filter.test.ts
git commit -m "feat(charts): filter scatter layout with per-rule drop (plan 8-1)"
```

---

### Task 5: 검증 설계 배치 `splitLayout`

**Files:**
- Create: `src/charts/split.ts`
- Test: `tests/unit/charts-split.test.ts`

**Interfaces:**
- Consumes: `ChartsData['split']`, `ChartsData['dates']`, `ChartsData['asOf']`(Task 3), `Pts`·`mulberry32`·`utc`·`DAY`(`layouts.ts`)
- Produces:
  - `export const SPLIT = { stages: 3, subs: [1, 1, 5], subMs: 1200, … } as const`
  - `export type SplitMethod = { name: string; r2: string; mae: string; tag: string }`
  - `export type SplitTexts = { month(iso: string): string; axisX: string; axisY: string; legend: [string, string, string]; methods: [SplitMethod, SplitMethod, SplitMethod] }`
  - `export function splitRole(sp: NonNullable<ChartsData['split']>, i: number, stage: number, sub: number): 0 | 1 | 2` — 0 학습, 1 평가, 2 아직 안 씀
  - `export function splitLayout(d: ChartsData, size: PlotSize, stage: number, sub: number, s: SplitTexts): ChartLayout` — 이름표 앞 5개 = 방식 이름·R²·MAE·설명·폴드(`cls: 'stat' | 'statSm'`), `variant = 'stage:<st>:<sb>'`

- [ ] **Step 1: 실패하는 테스트**

`tests/unit/charts-split.test.ts`:

```ts
// ⑤ 검증 설계 배치(계획 8-1): 방식마다 평가 점, TSS sub마다 평가 구간이 밀려 감, 첫 이름표 5개는 수치, 점 개수 불변
import { describe, expect, it } from 'vitest';
import type { ChartsData } from '@/charts/data';
import { SPLIT, splitLayout, splitRole } from '@/charts/split';
import { TONE } from '@/charts/types';

// 수집 0~5일 × 출발일 3개. kf: 가운데 폴드 2, gkf: 폴드 0, tss: −1, 0..4
const split = {
  fetch: [0, 1, 2, 3, 4, 5], date: [0, 1, 2, 0, 1, 2],
  kf: [0, 1, 2, 2, 3, 4], gkf: [0, 1, 0, 2, 3, 0], tss: [-1, 0, 1, 2, 3, 4],
  fetchDays: 6, show: { kf: 2, gkf: 0 },
};
const data = { asOf: '2026-09-22', dates: ['2026-10-01', '2026-11-01', '2027-01-15'], split } as unknown as ChartsData;
const m = (name: string) => ({ name, r2: 'R² 0.6', mae: 'MAE 1원', tag: name.toLowerCase() });
const S = { month: (iso: string) => iso.slice(5, 7), axisX: '수집일', axisY: '출발일', legend: ['학습', '평가', '아직 안 씀'] as [string, string, string], methods: [m('K-FOLD'), m('GROUPKFOLD'), m('TIMESERIESSPLIT')] as const };
const size = { w: 1080, h: 414 };

describe('splitRole', () => {
  it('K-Fold는 show.kf 폴드가 평가, GroupKFold는 show.gkf', () => {
    expect([0, 1, 2, 3, 4, 5].map((i) => splitRole(split, i, 0, 0))).toEqual([0, 0, 1, 1, 0, 0]);
    expect([0, 1, 2, 3, 4, 5].map((i) => splitRole(split, i, 1, 0))).toEqual([1, 0, 1, 0, 0, 1]);
  });
  it('TSS sub k: 폴드 k 평가, 앞(−1 포함)은 학습, 뒤는 아직 안 씀', () => {
    expect([0, 1, 2, 3, 4, 5].map((i) => splitRole(split, i, 2, 0))).toEqual([0, 1, 2, 2, 2, 2]);
    expect([0, 1, 2, 3, 4, 5].map((i) => splitRole(split, i, 2, 4))).toEqual([0, 0, 0, 0, 0, 1]);
  });
});

describe('splitLayout', () => {
  const all = [[0, 0], [1, 0], [2, 0], [2, 2], [2, 4]].map(([st, sb]) => splitLayout(data, size, st, sb, S));
  it('점 개수가 같고 좌표는 판 안, variant는 단계·sub', () => {
    expect(new Set(all.map((l) => l.n)).size).toBe(1);
    expect(all.map((l) => l.variant)).toEqual(['stage:0:0', 'stage:1:0', 'stage:2:0', 'stage:2:2', 'stage:2:4']);
    for (const L of all) for (let i = 0; i < L.n; i++) {
      expect(L.x[i]).toBeGreaterThanOrEqual(0); expect(L.x[i]).toBeLessThanOrEqual(1);
      expect(L.y[i]).toBeGreaterThanOrEqual(0); expect(L.y[i]).toBeLessThanOrEqual(1);
    }
  });
  it('평가 점은 호박색, 아직 안 씀은 흐림, 점 자리는 단계와 무관', () => {
    const [kf, , tss0] = all;
    expect(Array.from(kf.tone)).toEqual([TONE.dot, TONE.dot, TONE.amber, TONE.amber, TONE.dot, TONE.dot]);
    expect(tss0.alpha[5]).toBeLessThan(kf.alpha[5]);
    expect(Array.from(tss0.x)).toEqual(Array.from(kf.x));
    expect(Array.from(tss0.y)).toEqual(Array.from(kf.y));
  });
  it('가로 = 수집일(늦을수록 오른쪽), 세로 = 출발일(늦을수록 위), group = 출발일 번호', () => {
    const L = all[0];
    expect(L.x[5]).toBeGreaterThan(L.x[0]);
    expect(L.y[2]).toBeLessThan(L.y[0]);
    expect(Array.from(L.group)).toEqual(split.date);
  });
  it('앞 이름표 5개는 방식 이름·R²·MAE·설명·폴드 — TSS에서만 폴드 글자', () => {
    const head = (L: ReturnType<typeof splitLayout>) => L.labels.slice(0, 5).map((l) => (l.type === 'text' ? l.text : ''));
    expect(head(all[0])).toEqual(['K-FOLD', 'R² 0.6', 'MAE 1원', 'k-fold', '']);
    expect(head(all[4])[4]).toBe('FOLD 5 / 5');
    expect(head(all[3])[4]).toBe('FOLD 3 / 5');
    expect(all[0].labels[1]).toMatchObject({ cls: 'stat' });
  });
  it('범례 셋째(아직 안 씀)는 TSS에서만 글자가 있다', () => {
    const dim = (L: ReturnType<typeof splitLayout>) => L.labels.find((l) => l.type === 'text' && l.cls === 'keyDim');
    expect(dim(all[0])).toMatchObject({ text: '' });
    expect(dim(all[2])).toMatchObject({ text: '아직 안 씀' });
  });
  it('좁은 판도 이름표가 판 안, split이 없으면 던진다', () => {
    const L = splitLayout(data, { w: 358, h: 354 }, 2, 4, S);
    for (const l of L.labels) { expect(l.x).toBeGreaterThanOrEqual(0); expect(l.x).toBeLessThanOrEqual(1); expect(l.y).toBeGreaterThanOrEqual(0); expect(l.y).toBeLessThanOrEqual(1); }
    expect(() => splitLayout({ dates: [] } as unknown as ChartsData, size, 0, 0, S)).toThrow();
  });
  it('SPLIT 상수: TSS 단계만 sub 5개', () => expect(SPLIT.subs).toEqual([1, 1, 5]));
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/unit/charts-split.test.ts`
Expected: FAIL — `Cannot find module '@/charts/split'`

- [ ] **Step 3: 구현**

`src/charts/split.ts`:

```ts
// ⑤ 검증 설계 점(계획 8-1, 설계 2026-09-30-validation-filter-dots-design §4.2): 실제 수집 행 표본을 수집일(가로) × 출발일(세로)에
// 뿌리고, 자막 칸마다 평가 방식이 데이터를 나누는 모습을 색으로 보인다 — K-Fold(가운데 시간 구간이 평가, 앞뒤가 학습),
// GroupKFold(노선·출발일째 평가), TimeSeriesSplit(과거만 학습, 다음 구간 평가, sub마다 경계가 밀려 간다).
// 점 자리는 단계와 무관하고 색·알파만 바뀐다 — 3D에서는 같은 지형 점이 제자리에서 색만 바뀐다.
import type { ChartsData } from './data';
import { DAY, mulberry32, Pts, utc, type PlotSize } from './layouts';
import { CHART_FOCUS_DIM, TONE, type ChartLabel, type ChartLayout } from './types';

// subs: TSS 단계만 폴드 5개를 저절로 넘긴다(사용자 결정 2026-09-30, 약 1.2초). jitterPx: 같은 날 수집·같은 출발일 점이
// 한 점에 겹치지 않게 조금 흔든다(시드 고정 — 단계가 바뀌어도 자리 그대로). unusedA: 아직 안 쓴(미래) 점의 알파
export const SPLIT = { stages: 3, subs: [1, 1, 5], subMs: 1200, wideMinPx: 560, jitterPx: 1.6, seed: 5, unusedA: 0.2 } as const;

export type SplitMethod = { name: string; r2: string; mae: string; tag: string };
export type SplitTexts = {
  month(iso: string): string;
  axisX: string; axisY: string;
  legend: [string, string, string];            // 학습, 평가, 아직 안 씀
  methods: readonly [SplitMethod, SplitMethod, SplitMethod]; // K-Fold, GroupKFold, TimeSeriesSplit 순
};

// 0 학습, 1 평가, 2 아직 안 씀(TSS에서 평가 구간 뒤 — 그 폴드를 잴 때는 아직 없던 미래 행)
export function splitRole(sp: NonNullable<ChartsData['split']>, i: number, stage: number, sub: number): 0 | 1 | 2 {
  if (stage === 0) return sp.kf[i] === sp.show.kf ? 1 : 0;
  if (stage === 1) return sp.gkf[i] === sp.show.gkf ? 1 : 0;
  const t = sp.tss[i];
  return t === sub ? 1 : t < sub ? 0 : 2;
}

const isoOf = (t: number) => new Date(t).toISOString().slice(0, 10);

export function splitLayout(d: ChartsData, size: PlotSize, stage: number, sub: number, s: SplitTexts): ChartLayout {
  const sp = d.split;
  if (!sp) throw new Error('charts.json에 split이 없다');
  const st = Math.max(0, Math.min(SPLIT.stages - 1, Math.floor(stage)));
  const sb = Math.max(0, Math.min(SPLIT.subs[st] - 1, Math.floor(sub)));
  const W = size.w, H = size.h, wide = W >= SPLIT.wideMinPx;
  // 넓은 판: 오른쪽 24%에 수치·범례. 좁은 판: 위쪽 28%에 수치
  const gx0 = W * (wide ? 0.08 : 0.14), gx1 = wide ? W * 0.74 : W - 8;
  const top = H * (wide ? 0.08 : 0.34), bottom = H * 0.86;
  // 수집 시작일 = 기준일(마지막 수집일) − (fetchDays − 1)일
  const start = utc(d.asOf) - (sp.fetchDays - 1) * DAY;
  const XF = (f: number) => gx0 + (gx1 - gx0) * (f / Math.max(1, sp.fetchDays - 1));
  const t0 = utc(d.dates[0]), t1 = utc(d.dates[d.dates.length - 1]);
  const YT = (t: number) => bottom - (bottom - top) * ((t - t0) / Math.max(1, t1 - t0));
  const p = new Pts();
  const dot = wide ? 2.2 : 1.6;
  const rand = mulberry32(SPLIT.seed);
  for (let i = 0; i < sp.fetch.length; i++) {
    const jx = (rand() - 0.5) * 2 * SPLIT.jitterPx, jy = (rand() - 0.5) * 2 * SPLIT.jitterPx;
    const role = splitRole(sp, i, st, sb);
    const x = Math.min(1, Math.max(0, (XF(sp.fetch[i]) + jx) / W));
    const y = Math.min(1, Math.max(0, (YT(utc(d.dates[sp.date[i]])) + jy) / H));
    p.add(x, y, dot, role === 1 ? 0.95 : role === 0 ? 0.7 : SPLIT.unusedA, role === 1 ? TONE.amber : TONE.dot, sp.date[i]);
  }

  // 이름표: 수치 5개를 맨 앞에(방식 이름·R²·MAE·설명·폴드) — 그림 판이 순서로 그려 같은 자리의 플립이 단계 사이에 이어진다
  const labels: ChartLabel[] = [];
  const m = s.methods[st];
  const sx = wide ? W * 0.78 : gx0, sy = wide ? H * 0.1 : H * 0.04, lh = wide ? 30 : 18;
  labels.push({ type: 'text', x: sx / W, y: sy / H, text: m.name, align: 'start', cls: 'statSm' });
  labels.push({ type: 'text', x: sx / W, y: (sy + lh) / H, text: m.r2, align: 'start', cls: 'stat' });
  labels.push({ type: 'text', x: (wide ? sx : sx + W * 0.42) / W, y: (wide ? sy + lh * 2 : sy + lh) / H, text: m.mae, align: 'start', cls: 'statSm' });
  labels.push({ type: 'text', x: sx / W, y: (wide ? sy + lh * 3 : sy + lh * 2) / H, text: m.tag, align: 'start', cls: 'ruleOn' });
  labels.push({ type: 'text', x: (wide ? sx : sx + W * 0.42) / W, y: (wide ? sy + lh * 4 : sy + lh * 2) / H, text: st === 2 ? `FOLD ${sb + 1} / ${SPLIT.subs[2]}` : '', align: 'start', cls: 'statSm' });
  // 범례: 셋째(아직 안 씀)는 TSS에서만 글자 — 개수는 늘 같게 둔다(이름표 순서가 단계 사이에 흔들리지 않게)
  const ky = wide ? H * 0.72 : top - 14;
  const keys: ['keyDot', 'keyAmber', 'keyDim'] = ['keyDot', 'keyAmber', 'keyDim'];
  keys.forEach((cls, i) => labels.push({
    type: 'text', x: (wide ? sx : gx0 + ((W - 8 - gx0) / 3) * i) / W, y: (wide ? ky + i * 20 : ky) / H,
    text: i === 2 && st !== 2 ? '' : s.legend[i], align: 'start', cls,
  }));
  // 가로 눈금: 매달 1일
  for (let t = start; t <= start + (sp.fetchDays - 1) * DAY; t += DAY) {
    const iso = isoOf(t);
    if (iso.endsWith('-01')) labels.push({ type: 'text', x: XF((t - start) / DAY) / W, y: (bottom + (H - bottom) * 0.45) / H, text: s.month(iso), align: 'center', cls: 'month' });
  }
  // 세로 눈금: 홀수 달(1·3·5…월) 1일, 1월에는 해도
  const d0 = new Date(t0);
  for (let y = d0.getUTCFullYear(), mo = d0.getUTCMonth() + 1; ; mo++) {
    if (mo > 11) { mo = 0; y++; }
    const t = Date.UTC(y, mo, 1);
    if (t > t1) break;
    if (mo % 2 === 0) {
      const iso = isoOf(t);
      labels.push({ type: 'text', x: (gx0 - 6) / W, y: YT(t) / H, text: mo === 0 ? `${s.month(iso)} ’${String(y).slice(2)}` : s.month(iso), align: 'end', cls: 'tick' });
    }
  }
  labels.push({ type: 'text', x: gx0 / W, y: Math.max(8, top * 0.5) / H, text: s.axisY, align: 'start', cls: 'axis' });
  labels.push({ type: 'text', x: gx1 / W, y: (bottom + (H - bottom) * 0.85) / H, text: s.axisX, align: 'end', cls: 'axis' });
  return { ...p.done(labels, TONE.text, CHART_FOCUS_DIM), variant: `stage:${st}:${sb}` };
}
```

주의: 좁은 판에서 범례 줄(`top − 14`)·축 이름(`top*0.5`)·수치 줄이 겹치면 범례를 `H*0.04 + 18*3`으로 내려 판 위 네 줄로 둔다 — 테스트("좁은 판")와 Task 9 눈 확인.

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run tests/unit/charts-split.test.ts`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/charts/split.ts tests/unit/charts-split.test.ts
git commit -m "feat(charts): validation split layout with auto-advancing TSS folds (plan 8-1)"
```

---

### Task 6: 작은 단계(sub) 타이머·플립 이름표·배치 연결

**Files:**
- Create: `src/components/charts/subTimer.ts`, `tests/unit/charts-subtimer.test.ts`
- Modify: `src/components/charts/ChartStage.tsx`(Props·단계 effect·이름표 그리기·data-sub)
- Modify: `src/charts/build.ts`(ChartStrings·buildLayout switch)
- Modify: `src/styles/globals.css`(이름표 cls)
- Test: `tests/unit/charts-draw.test.ts`(실제 데이터로 두 배치)

**Interfaces:**
- Consumes: `filterLayout`·`FILTER`(Task 4), `splitLayout`·`SPLIT`·`SplitMethod`(Task 5), `flip`(`src/motion/flip.ts`)
- Produces:
  - `ChartStage` props `subs?: readonly number[]; subMs?: number` — 판에 `data-sub`
  - `buildLayout(key, loaded, size, s, open = -1, step = 0, sub = 0)`
  - `ChartStrings` += `axisX?: string; box?: string; rowsRaw?: string; rowsKept?: string; legend?: [string, string, string]; methods?: readonly [SplitMethod, SplitMethod, SplitMethod]`
  - `subTimer.ts`: `export function startSubs(o: { count: number; ms: number; reduced: boolean; set(n: number): void; setTimeout: typeof setTimeout; clearTimeout: typeof clearTimeout }): { restart(): void; stop(): void }`

- [ ] **Step 1: 실패하는 테스트 (타이머)**

`tests/unit/charts-subtimer.test.ts`:

```ts
// 작은 단계 타이머(계획 8-1): 간격마다 +1, 마지막에서 멈춤, 움직임 줄이기면 바로 마지막, 다시 시작하면 0부터
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startSubs } from '@/components/charts/subTimer';

describe('startSubs', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());
  const make = (count: number, reduced = false) => {
    const seen: number[] = [];
    const t = startSubs({ count, ms: 1000, reduced, set: (n) => seen.push(n), setTimeout, clearTimeout });
    return { t, seen };
  };
  it('0에서 시작해 1초마다 +1, 마지막(4)에서 멈춘다', () => {
    const { seen } = make(5);
    expect(seen).toEqual([0]);
    vi.advanceTimersByTime(10_000);
    expect(seen).toEqual([0, 1, 2, 3, 4]);
  });
  it('움직임 줄이기면 곧바로 마지막, 타이머 없음', () => {
    const { seen } = make(5, true);
    vi.advanceTimersByTime(10_000);
    expect(seen).toEqual([4]);
  });
  it('작은 단계가 하나면 0만', () => {
    const { seen } = make(1);
    vi.advanceTimersByTime(5000);
    expect(seen).toEqual([0]);
  });
  it('stop하면 멈추고 restart하면 0부터 다시', () => {
    const { t, seen } = make(5);
    vi.advanceTimersByTime(2000);
    t.stop();
    vi.advanceTimersByTime(5000);
    expect(seen).toEqual([0, 1, 2]);
    t.restart();
    vi.advanceTimersByTime(1000);
    expect(seen).toEqual([0, 1, 2, 0, 1]);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/unit/charts-subtimer.test.ts`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 타이머 구현**

`src/components/charts/subTimer.ts`:

```ts
// 그림 판의 작은 단계(sub) 타이머(계획 8-1): 한 단계 안에서 sub를 0 → count−1로 일정 간격마다 올리고 마지막에서 멈춘다.
// React와 떼어 둔 순수 모듈이라 가짜 시계로 시험한다. 판이 화면 밖으로 나가면 stop, 다시 들어오면 restart(0부터).
export function startSubs(o: {
  count: number; ms: number; reduced: boolean; set(n: number): void;
  setTimeout: typeof setTimeout; clearTimeout: typeof clearTimeout;
}): { restart(): void; stop(): void } {
  const last = Math.max(0, o.count - 1);
  let n = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const stop = () => { if (timer !== undefined) o.clearTimeout(timer); timer = undefined; };
  const tick = () => {
    n += 1;
    o.set(n);
    timer = n < last ? o.setTimeout(tick, o.ms) : undefined;
  };
  const restart = () => {
    stop();
    // 움직임 줄이기: 넘어가는 모습 없이 마지막 모습만(TSS 5/5, 걸러내기는 떨어진 뒤)
    if (o.reduced || last === 0) { n = last; o.set(n); return; }
    n = 0;
    o.set(0);
    timer = o.setTimeout(tick, o.ms);
  };
  restart();
  return { restart, stop };
}
```

- [ ] **Step 4: 타이머 테스트 통과 확인**

Run: `npx vitest run tests/unit/charts-subtimer.test.ts`
Expected: PASS

- [ ] **Step 5: 실패하는 테스트 (실제 데이터 배치)**

`tests/unit/charts-draw.test.ts`의 chartModel 테스트(117~136줄) 뒤에 더한다(같은 파일의 `charts`·`s` 도우미를 그대로 쓴다 — 없으면 chartModel 테스트가 쓰는 방식대로 실제 `charts.json`을 읽고 `ChartStrings`를 만든다):

```ts
  it('chartFilter: 실제 데이터에서 (단계, sub)마다 점 개수 같음, 이름표 판 안, 마지막에 걸러낸 행 수', () => {
    const fs = { ...s, axisX: '소요', box: '상자', rowsRaw: 'RAW', rowsKept: 'KEPT' };
    const size = { w: 1080, h: 414 };
    const Ls = [[0, 0], [1, 0], [1, 1], [2, 0], [2, 1]].map(([st, sb]) => buildLayout('chartFilter', { charts }, size, fs, -1, st, sb));
    expect(new Set(Ls.map((l) => l.n)).size).toBe(1);
    expect(Ls[4].labels[0]).toMatchObject({ text: 'KEPT' });
    for (const L of Ls) for (const l of L.labels) { expect(l.x).toBeGreaterThanOrEqual(0); expect(l.x).toBeLessThanOrEqual(1); }
    // 규칙 ③(직항 확인) 점은 대부분 상자 안(215~400분)이다 — 실제 데이터 모양 확인
    const f = charts.filter!;
    const r3 = f.dur.filter((_, i) => f.rule[i] === 3);
    expect(r3.filter((m) => m >= 215 && m <= 400).length / r3.length).toBeGreaterThan(0.95);
  });
  it('chartSplit: 실제 데이터에서 TSS sub마다 평가 점 수가 비슷하다(각 폴드 약 1/6)', () => {
    const m = { name: 'X', r2: 'R', mae: 'M', tag: 'T' };
    const ss = { ...s, axisX: '수집일', legend: ['a', 'b', 'c'] as [string, string, string], methods: [m, m, m] as const };
    const size = { w: 1080, h: 414 };
    for (let sb = 0; sb < 5; sb++) {
      const L = buildLayout('chartSplit', { charts }, size, ss, -1, 2, sb);
      const test = Array.from(L.tone).filter((t) => t === 2).length;
      expect(test / L.n).toBeGreaterThan(0.12);
      expect(test / L.n).toBeLessThan(0.22);
    }
  });
```

- [ ] **Step 6: 실패 확인**

Run: `npx vitest run tests/unit/charts-draw.test.ts`
Expected: FAIL — `배치가 없다: chartFilter`(Task 3의 임시 default) 또는 buildLayout 인자 개수 타입 오류

- [ ] **Step 7: build.ts 연결**

`src/charts/build.ts` import 줄에:

```ts
import { filterLayout } from './filter';
import { splitLayout, type SplitMethod } from './split';
```

`ChartStrings`의 `tipHoliday` 뒤에:

```ts
  axisX?: string;                   // 가로축 이름(걸러내기·검증 설계, 계획 8-1)
  box?: string;                     // 걸러내기 규칙 ③ 상자 이름표
  rowsRaw?: string; rowsKept?: string; // 걸러내기 행 수 글자("258,829 ROWS") — 서버가 facts로 만든다(문구에 숫자 금지)
  legend?: [string, string, string]; // 검증 설계 범례: 학습·평가·아직 안 씀
  methods?: readonly [SplitMethod, SplitMethod, SplitMethod]; // 검증 설계 판 위 수치(K-Fold·GroupKFold·TSS)
```

`buildLayout` 시그니처와 설명:

```ts
// open: ③ 펼친 와플 그룹 번호(−1 = 닫힘). step: 단계가 있는 판(③ 모델 구조·② 걸러내기·⑤ 검증 설계)의 지금 단계 = 자막 문단 번호.
// sub: 단계 안 작은 단계(계획 8-1 — ChartStage 타이머가 올린다)
export function buildLayout(key: ChartKey, loaded: Loaded, size: PlotSize, s: ChartStrings, open = -1, step = 0, sub = 0): ChartLayout {
```

switch에 두 case를 더하고, Task 3에서 넣은 임시 `default`는 지운다(모든 키를 다루면 타입 검사가 빠진 키를 잡는다):

```ts
    case 'chartFilter': {
      const num = new Intl.NumberFormat(s.locale);
      return filterLayout(loaded.charts!, size, step, sub, {
        axisX: s.axisX ?? '', axisY: s.axis ?? '', box: s.box ?? '', rowsRaw: s.rowsRaw ?? '', rowsKept: s.rowsKept ?? '',
        minutes: (v) => num.format(v), pct: signed,
      });
    }
    case 'chartSplit': {
      const mo = new Intl.DateTimeFormat(s.locale, { month: 'short', timeZone: 'UTC' });
      const empty = { name: '', r2: '', mae: '', tag: '' };
      return splitLayout(loaded.charts!, size, step, sub, {
        month: (iso) => mo.format(new Date(`${iso}T00:00:00Z`)),
        axisX: s.axisX ?? '', axisY: s.axis ?? '', legend: s.legend ?? ['', '', ''], methods: s.methods ?? [empty, empty, empty],
      });
    }
```

- [ ] **Step 8: ChartStage — sub와 플립 이름표**

`src/components/charts/ChartStage.tsx` 맨 위 설명 주석 끝에 한 줄:

```ts
// 작은 단계(sub): subs를 주면(② 걸러내기·⑤ 검증 설계, 계획 8-1) 한 단계 안에서 sub가 subMs마다 저절로 올라가 마지막에서 멈춘다.
// 판이 화면 밖이면 멈추고 다시 들어오면 처음부터, 움직임 줄이기면 바로 마지막. 수치 이름표(stat·statSm)는 글자가 바뀌면 플립
```

import:

```ts
import { flip } from '@/motion/flip';
import { startSubs } from './subTimer';
```

Props:

```ts
type Props = {
  chartKey: ChartKey; dataVersion: string; strings: ChartStrings; errorText: string; label?: string; hint?: string; stages?: number;
  subs?: readonly number[]; subMs?: number;
};
```

함수 시그니처에 `subs, subMs`를 더하고, `const stepRef = useRef(0);` 뒤에:

```ts
  // 지금 작은 단계. 배치 함수가 ref로 읽는다. 단계 effect가 먼저 정한 뒤 한 번만 다시 배치한다 — 옛 sub로 한 번, 새 sub로
  // 또 한 번 배치하면 3D 슬롯이 두 번 바뀌어 점이 튄다
  const [sub, setSub] = useState(0);
  const subRef = useRef(0);
  const subsKey = subs?.join(',') ?? '';
```

`redraw` 안 `mod.buildLayout(...)` 호출 끝 인자에 `subRef.current`를 더한다:

```ts
          const layout = mod.buildLayout(chartKey, loaded, { w: r.width, h: r.height }, strings, openRef.current, stepRef.current, subRef.current);
```

기존 `useEffect(() => { if (stepRef.current === step) return; stepRef.current = step; relayout.current(); }, [step]);`를 바꾼다:

```ts
  // 단계가 바뀌면: sub를 처음(움직임 줄이기면 마지막)으로 먼저 정하고 한 번만 다시 배치한 뒤, 그 단계에 sub가 여럿이면 타이머를 건다.
  // 판이 화면 밖이면 타이머를 멈추고, 다시 들어오면 그 단계 처음부터
  useEffect(() => {
    const count = subs?.[step] ?? 1;
    let reduced = true;
    try { reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { /* 없으면 줄인 쪽 */ }
    const first = reduced ? count - 1 : 0;
    const changed = stepRef.current !== step || subRef.current !== first;
    stepRef.current = step;
    subRef.current = first;
    setSub(first);
    if (changed) relayout.current();
    const el = stage.current;
    if (count <= 1 || reduced || !subMs || !el) return;
    let timer: ReturnType<typeof startSubs> | null = null;
    const set = (n: number) => { if (subRef.current === n) return; subRef.current = n; setSub(n); relayout.current(); };
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) { timer?.stop(); return; }
      if (timer) timer.restart();
      else timer = startSubs({ count, ms: subMs, reduced: false, set, setTimeout: window.setTimeout.bind(window) as typeof setTimeout, clearTimeout: window.clearTimeout.bind(window) });
    });
    io.observe(el);
    return () => { io.disconnect(); timer?.stop(); };
    // subs는 서버에서 온 배열이라 렌더마다 새 배열일 수 있어 글자로 비교한다(subsKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, subsKey, subMs]);
```

플립 이름표 부품을 파일 아래(ChartStage 함수 밖)에 더한다:

```tsx
// 판 위 수치(stat·statSm): 글자가 바뀌면 플립으로 넘긴다(motion/flip — 움직임 줄이기면 바로 바뀐다). 이름표 층이 aria-hidden이라
// 낭독은 자막 띠의 요약 문단이 맡는다
function FlipLabel({ text, className, style }: { text: string; className: string; style: React.CSSProperties }) {
  const el = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!el.current) return;
    return flip(el.current, text);
  }, [text]);
  return <span ref={el} className={className} style={style} />;
}
```

이름표 그리기(`return <span key={i} className={\`chart-label …\`} …>{l.text}</span>;`)를 바꾼다:

```tsx
            const cls = `chart-label ${l.cls} align-${l.align}`;
            if (l.cls === 'stat' || l.cls === 'statSm') return <FlipLabel key={i} text={l.text} className={cls} style={style} />;
            return <span key={i} className={cls} style={style}>{l.text}</span>;
```

판 속성:

```tsx
    <div ref={stage} className="chart-stage" data-stage={stages ? step : undefined} data-sub={subs ? sub : undefined}>
```

- [ ] **Step 9: CSS**

`src/styles/globals.css`의 `.chart-label.head { … }` 줄 뒤에:

```css
/* 판 위 수치(계획 8-1): 큰 수치(R², 행 수)와 작은 줄. 규칙 목록은 적용 전 흐리게, 적용되면 호박색. 범례는 앞에 그 색 점 */
.chart-label.stat { font: 600 26px var(--font-mono); color: var(--tx); letter-spacing: -0.01em; }
.chart-label.statSm { font: 500 13px var(--font-mono); color: var(--tx); letter-spacing: 0.04em; }
.chart-label.rule { color: var(--mute); letter-spacing: 0.04em; }
.chart-label.ruleOn { color: var(--amb); letter-spacing: 0.04em; }
.chart-label:is(.keyDot, .keyAmber, .keyDim):not(:empty)::before { content: '●'; margin-right: 6px; }
.chart-label.keyDot::before { color: #8FB8FF; }
.chart-label.keyAmber::before { color: var(--amb); }
.chart-label.keyDim::before { color: #8FB8FF; opacity: 0.35; }
```

`@media (max-width: 767px) { … }` 블록 안 `.chart-label { font-size: 9px; }` 뒤에:

```css
  .chart-label.stat { font-size: 17px; }
  .chart-label.statSm { font-size: 10px; }
```

(`.keyDot` 등의 점 색: `.keyDot::before` 색 `#8FB8FF`는 3D 점 색 `TONE_COLOR[TONE.dot]`과 같은 값)

- [ ] **Step 10: 전체 확인**

Run: `npx tsc --noEmit && npx vitest run`
Expected: PASS(Task 3의 임시 default를 지웠으므로 switch가 모든 키를 다룬다)

- [ ] **Step 11: 커밋**

```bash
git add src/components/charts/subTimer.ts src/components/charts/ChartStage.tsx src/charts/build.ts src/styles/globals.css tests/unit/charts-subtimer.test.ts tests/unit/charts-draw.test.ts
git commit -m "feat(chart-stage): auto-advancing sub-steps and flipping stat labels (plan 8-1)"
```

---

### Task 7: 문구 (ko 확정 초안, en·ja 초안)

**Files:**
- Modify: `content/ko.json`, `content/en.json`, `content/ja.json`
- Test: `tests/unit/charts-content.test.ts`

**Interfaces:**
- Produces 키(세 언어 같음):
  - `data.filter.{heading, body1, body2, body3, axisX, axisY, boxLabel, alt}`
  - `charts.validation.{body1, body2, body3, tagKf, tagGkf, tagTss, axisX, axisY, legendTrain, legendTest, legendUnused, alt}` (`heading`·`table.*` 그대로)
  - 설계 §6의 `step1..3`은 다른 그림 판 블록(`charts.<id>.body1..N`, Charts.tsx `paraCells`)과 같은 이름 규칙에 맞춰 `body1..3`으로 쓴다

- [ ] **Step 1: 실패하는 테스트**

`tests/unit/charts-content.test.ts`의 마지막 `it(…요약 문단…)` 뒤에 더한다:

```ts
    it(`${locale}: 걸러내기·검증 설계 판 문구(계획 8-1)가 모두 있다`, () => {
      const f = (dictionaries[locale].data as unknown as Record<string, Record<string, string>>).filter;
      for (const k of ['heading', 'body1', 'body2', 'body3', 'axisX', 'axisY', 'boxLabel', 'alt']) expect(f[k], `data.filter.${k}`).toBeTruthy();
      for (const k of ['heading', 'body1', 'body2', 'body3', 'tagKf', 'tagGkf', 'tagTss', 'axisX', 'axisY', 'legendTrain', 'legendTest', 'legendUnused', 'alt']) {
        expect(c.validation[k], `charts.validation.${k}`).toBeTruthy();
      }
    });
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/unit/charts-content.test.ts`
Expected: FAIL — `data.filter.heading` 없음

- [ ] **Step 3: 문구 작성**

`content/ko.json` — `data` 객체 안(`tools` 뒤)에:

```json
    "filter": {
      "heading": "오류 걸러내기",
      "body1": "모은 {data.rawRows}행을 소요 시간과 가격으로 놓았습니다. 모두 직항이라 대부분 한곳에 좁게 모여 있습니다.",
      "body2": "소요 시간이 {data.filter.durationMax}분을 넘거나 가격 단위가 빠진 행 {data.filter.unit}개, 출발·도착 시각과 소요 시간이 맞지 않는 행 {data.filter.mismatch}개를 뺐습니다.",
      "body3": "직항으로 표시됐지만 경유 여정만큼 오래 걸리는 행 {data.filter.direct}개도 뺐습니다. 대부분 하네다 노선이었습니다. 남은 행은 {data.filteredRows}개입니다.",
      "axisX": "소요 시간(분)",
      "axisY": "노선·등급 평균 대비",
      "boxLabel": "직항인데 경유만큼 걸림",
      "alt": "원본 {data.rawRows}행을 소요 시간과 가격으로 놓은 점 그림입니다. 정상 직항은 좁게 모여 있고, 소요 시간이 너무 길거나 가격 단위가 빠진 행 {data.filter.unit}개, 시각이 맞지 않는 행 {data.filter.mismatch}개, 직항인데 경유만큼 걸리는 행 {data.filter.direct}개가 차례로 빠져 {data.filteredRows}행이 남습니다."
    }
```

`content/ko.json` — `charts.validation`의 `body1`·`body2`를 바꾸고 키를 더한다(`heading`·`table` 그대로):

```json
      "body1": "K-Fold는 가운데 시간 구간을 평가로 떼고 앞뒤를 모두 학습에 씁니다. 미래에 모은 가격으로 과거를 맞히는 셈이라 점수가 가장 높게 나옵니다. 참고용 상한으로만 봅니다.",
      "body2": "GroupKFold는 노선·출발일을 통째로 평가로 뗍니다. 처음 보는 출발일에서는 lookup 통계가 기본값으로 떨어지는 학습·서비스 불일치가 여기서 드러났습니다. lookup을 넣은 서비스 구성은 R² {model.gkfWithLookup.r2}, MAE {model.gkfWithLookup.mae}원으로 lookup이 없을 때보다 나빴고, lookup 구성 {model.lookupVariants}가지를 각각 다시 튜닝해 비교했습니다.",
      "body3": "TimeSeriesSplit은 과거로만 배우고 바로 다음 구간을 평가합니다. 경계를 다섯 번 옮겨 가며 잽니다. 운영과 같은 조건이라 대표값으로 씁니다.",
      "tagKf": "참고 상한",
      "tagGkf": "처음 보는 출발일 · lookup 없이",
      "tagTss": "운영 기준",
      "axisX": "수집일",
      "axisY": "출발일",
      "legendTrain": "학습",
      "legendTest": "평가",
      "legendUnused": "아직 안 씀",
      "alt": "수집한 행을 수집일과 출발일로 놓은 점 그림입니다. K-Fold는 가운데 시간 구간을 평가로 떼어 앞뒤가 모두 학습이고(R² {model.kfold.r2}), GroupKFold는 노선·출발일 단위로 평가 행이 흩어지며(R² {model.gkfNoLookup.r2}, lookup 없이), TimeSeriesSplit은 과거만 학습하고 바로 다음 구간을 평가하는 경계를 다섯 번 옮깁니다(R² {model.tss.r2})."
```

주의: body3의 "다섯 번"은 숫자가 아니라 글자라 숫자 금지 테스트에 걸리지 않는다. 폴드 수가 바뀌면 문구도 고친다.

`content/en.json` — `data.filter`:

```json
    "filter": {
      "heading": "Filtering out errors",
      "body1": "Here are the {data.rawRows} collected rows, placed by flight time and price. They are all nonstop flights, so most sit in one narrow cluster.",
      "body2": "I removed {data.filter.unit} rows that took longer than {data.filter.durationMax} minutes or had a missing price unit, and {data.filter.mismatch} rows whose departure and arrival times did not match the flight time.",
      "body3": "I also removed {data.filter.direct} rows marked as nonstop that took as long as a connecting itinerary. Most were on Haneda routes. {data.filteredRows} rows remain.",
      "axisX": "Flight time (min)",
      "axisY": "vs. route/cabin mean",
      "boxLabel": "Nonstop, but as long as a connection",
      "alt": "A dot chart of the {data.rawRows} raw rows by flight time and price. Normal nonstop flights form a narrow cluster. {data.filter.unit} rows with overly long flight times or missing price units, {data.filter.mismatch} rows with mismatched times, and {data.filter.direct} nonstop rows as long as a connection drop out in turn, leaving {data.filteredRows} rows."
    }
```

`content/en.json` — `charts.validation`:

```json
      "body1": "K-Fold holds out a block of time in the middle and trains on everything before and after it. It predicts the past using prices collected in the future, so it scores highest. I treat it only as an upper reference.",
      "body2": "GroupKFold holds out whole route and departure-date groups. This exposed a train/serve mismatch: for unseen departure dates, the lookup statistics fall back to defaults. With lookups, the service setup scored R² {model.gkfWithLookup.r2} and MAE ₩{model.gkfWithLookup.mae}, worse than without them, so I retuned {model.lookupVariants} lookup setups and compared them.",
      "body3": "TimeSeriesSplit trains only on the past and tests on the next block. The boundary moves forward five times. It matches production, so it is the headline number.",
      "tagKf": "upper reference",
      "tagGkf": "unseen departure dates · no lookup",
      "tagTss": "production baseline",
      "axisX": "Collection date",
      "axisY": "Departure date",
      "legendTrain": "Train",
      "legendTest": "Test",
      "legendUnused": "Not used yet",
      "alt": "A dot chart of collected rows by collection date and departure date. K-Fold holds out a middle block of time and trains on both sides (R² {model.kfold.r2}); GroupKFold scatters test rows by route and departure date (R² {model.gkfNoLookup.r2}, no lookup); TimeSeriesSplit trains only on the past and moves the test boundary forward five times (R² {model.tss.r2})."
```

(en 기존 `charts.validation.body2`가 금액 단위를 어떻게 쓰는지 먼저 본다 — `₩{…}`가 아니라 `{…} KRW` 형식이면 그 형식을 따른다)

`content/ja.json` — `data.filter`:

```json
    "filter": {
      "heading": "エラーの除去",
      "body1": "集めた{data.rawRows}行を所要時間と価格で並べました。すべて直行便なので、ほとんどが一か所に狭くまとまっています。",
      "body2": "所要時間が{data.filter.durationMax}分を超える行や価格の単位が抜けた行{data.filter.unit}件と、出発・到着時刻と所要時間が合わない行{data.filter.mismatch}件を除きました。",
      "body3": "直行便と表示されていても乗り継ぎ並みに時間がかかる行{data.filter.direct}件も除きました。ほとんどが羽田路線でした。残りは{data.filteredRows}行です。",
      "axisX": "所要時間(分)",
      "axisY": "路線・クラス平均比",
      "boxLabel": "直行便なのに乗り継ぎ並み",
      "alt": "元の{data.rawRows}行を所要時間と価格で並べた点グラフです。通常の直行便は狭くまとまり、所要時間が長すぎる行や価格単位が抜けた行{data.filter.unit}件、時刻が合わない行{data.filter.mismatch}件、乗り継ぎ並みに長い直行便{data.filter.direct}件が順に抜けて{data.filteredRows}行が残ります。"
    }
```

`content/ja.json` — `charts.validation`:

```json
      "body1": "K-Foldは中ほどの期間を評価に取り分け、その前後をすべて学習に使います。未来に集めた価格で過去を当てることになるため、スコアが最も高く出ます。参考の上限としてだけ見ます。",
      "body2": "GroupKFoldは路線・出発日ごとまとめて評価に取り分けます。初めて見る出発日ではlookup統計が既定値に落ちる、学習とサービスの不一致がここで見つかりました。lookupを入れたサービス構成はR² {model.gkfWithLookup.r2}、MAE {model.gkfWithLookup.mae}ウォンでlookupなしより悪く、lookup構成{model.lookupVariants}通りをそれぞれ再チューニングして比べました。",
      "body3": "TimeSeriesSplitは過去だけで学習し、すぐ次の期間を評価します。境界を五回動かしながら測ります。運用と同じ条件なので代表値として使います。",
      "tagKf": "参考の上限",
      "tagGkf": "初めて見る出発日・lookupなし",
      "tagTss": "運用基準",
      "axisX": "収集日",
      "axisY": "出発日",
      "legendTrain": "学習",
      "legendTest": "評価",
      "legendUnused": "未使用",
      "alt": "収集した行を収集日と出発日で並べた点グラフです。K-Foldは中ほどの期間を評価に取り分けて前後がすべて学習(R² {model.kfold.r2})、GroupKFoldは路線・出発日単位で評価行が散らばり(R² {model.gkfNoLookup.r2}、lookupなし)、TimeSeriesSplitは過去だけを学習してすぐ次の期間を評価する境界を五回動かします(R² {model.tss.r2})。"
```

(ja 기존 `charts.validation.body2`의 금액 단위 표기를 먼저 보고 맞춘다)

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run tests/unit/charts-content.test.ts tests/unit/content.test.ts`
Expected: PASS(세 언어 키 일치, 자리표시 해석, 숫자 직접 기입 없음)

- [ ] **Step 5: 커밋**

```bash
git add content/ko.json content/en.json content/ja.json tests/unit/charts-content.test.ts
git commit -m "feat(content): filter and validation split copy (ko draft, en/ja draft) (plan 8-1)"
```

---

### Task 8: 블록 배치와 e2e

**Files:**
- Modify: `src/components/sections/DataSection.tsx`(걸러내기 블록)
- Modify: `src/components/sections/Charts.tsx`(검증 설계 블록·표 카드)
- Test: `tests/e2e/charts.spec.ts`

**Interfaces:**
- Consumes: `ChartStage`의 `stages`·`subs`·`subMs`(Task 6), `FILTER`(Task 4), `SPLIT`(Task 5), 문구 키(Task 7), `facts.data.filter`·`codeUrl('filter')`(Task 1), `charts.json`(Task 2)

- [ ] **Step 1: 실패하는 e2e**

`tests/e2e/charts.spec.ts` 15줄 `STAGES`에 두 키를 더한다(2D 그리기·이름표 검사가 자동으로 두 블록을 본다):

```ts
const STAGES = ['chartFilter', 'chartModel', 'features', 'chartDepart', 'chartCurve', 'chartSplit', 'chartCloud'] as const;
```

`test.describe('③ 모델 구조', …)` 블록 뒤(같은 `3D 꺼짐` describe 안)에 더한다:

```ts
  // 계획 8-1: 자막 칸이 바뀌면 단계, 단계 안에서는 sub가 저절로(움직임 줄이기 = 이 describe는 바로 마지막 sub)
  test.describe('② 걸러내기·⑤ 검증 설계', () => {
    const scrollInto = (page: Page, key: string, f: number) => page.locator(`.chart-block[data-scene="${key}"]`).evaluate((el, f) => {
      const r = el.getBoundingClientRect();
      window.scrollTo(0, window.scrollY + r.top + (r.height - window.innerHeight) * f);
    }, f);
    for (const [label, w, h] of [['1440', 1440, 900], ['390', 390, 844]] as const) {
      test(`${label}: 걸러내기 단계 0 → 1 → 2, 마지막에 걸러낸 행 수, 가로 스크롤 없음`, async ({ page }) => {
        await page.setViewportSize({ width: w, height: h });
        await page.goto('/');
        const stage = page.locator('.chart-block[data-scene="chartFilter"] .chart-stage');
        for (const [f, n] of [[0.12, '0'], [0.45, '1'], [0.8, '2']] as const) {
          await scrollInto(page, 'chartFilter', f);
          await expect(stage).toHaveAttribute('data-stage', n, { timeout: 10_000 });
        }
        await expect(stage).toHaveAttribute('data-sub', '1');
        const kept = new Intl.NumberFormat('ko').format(facts.data.filteredRows);
        await expect(stage.locator('.chart-label.stat').first()).toContainText(kept);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      });
      test(`${label}: 검증 설계 단계 0 → 1 → 2, TSS는 바로 FOLD 5 / 5`, async ({ page }) => {
        await page.setViewportSize({ width: w, height: h });
        await page.goto('/');
        const stage = page.locator('.chart-block[data-scene="chartSplit"] .chart-stage');
        for (const [f, n] of [[0.12, '0'], [0.45, '1'], [0.8, '2']] as const) {
          await scrollInto(page, 'chartSplit', f);
          await expect(stage).toHaveAttribute('data-stage', n, { timeout: 10_000 });
        }
        await expect(stage).toHaveAttribute('data-sub', '4');
        await expect(stage.locator('.chart-label.statSm', { hasText: 'FOLD 5 / 5' })).toBeAttached();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      });
    }
    test('axe 위반 없음(두 블록·표 카드)', async ({ page }) => {
      await page.goto('/');
      await scrollInto(page, 'chartSplit', 0.8);
      await expect(page.locator('.chart-block[data-scene="chartSplit"] .chart-stage')).toHaveAttribute('data-stage', '2', { timeout: 10_000 });
      const r = await new AxeBuilder({ page }).include('#data').include('#validation').analyze();
      expect(r.violations).toEqual([]);
    });
  });
```

`test.describe('3D 켜짐', …)`의 `'순서를 섞어 건너뛰어도…'` 목록에 두 키를 더한다:

```ts
    for (const key of ['chartCloud', 'chartFilter', 'features', 'chartSplit', 'chartModel', 'chartCurve', 'chartDepart']) {
```

`'[data-scene="validation"] a.code-link'`(246줄 근처)는 표 카드로 옮긴 코드 링크를 가리키므로 그대로 둔다(표 카드가 `data-scene="validation"`을 단다).

- [ ] **Step 2: 실패 확인**

Run: `npm run build && E2E_PORT=4191 npx playwright test tests/e2e/charts.spec.ts --project=desktop -g "걸러내기|검증 설계|chartFilter|chartSplit" --reporter=line`
Expected: FAIL — `.chart-block[data-scene="chartFilter"]` 없음

- [ ] **Step 3: DataSection에 걸러내기 블록**

`src/components/sections/DataSection.tsx` 맨 위 설명 주석에 한 줄 더한다:

```ts
// 두 화면 사이에는 걸러내기 그림 판(계획 8-1): 모음(지도) → 거름(산점도, 규칙마다 걸린 점이 떨어진다) → 결과(보드 합계).
```

import:

```ts
import type React from 'react';
import { ChartStage } from '../charts/ChartStage';
import { FILTER } from '@/charts/filter';
import { codeUrl, facts } from '@/lib/facts';
```

(기존 `import { codeUrl } from '@/lib/facts';` 줄은 지운다)

`.data-intro` div와 `.data-board` div 사이에:

```tsx
      <article className="chart-block" data-scene="chartFilter" aria-labelledby="filter-h" style={{ '--paras': 3 } as React.CSSProperties}>
        <ChartStage
          chartKey="chartFilter"
          dataVersion={facts.dataVersion}
          stages={FILTER.stages}
          subs={FILTER.subs}
          subMs={FILTER.subMs}
          strings={{
            locale, holidays: {},
            axis: t('data.filter.axisY'), axisX: t('data.filter.axisX'), box: t('data.filter.boxLabel'),
            // 행 수 글자는 문구가 아니라 형식(숫자 + 공통 영어)이라 여기서 만든다 — 문구 파일에는 숫자를 쓰지 않는다
            rowsRaw: `${rows(facts.data.rawRows)} ROWS`, rowsKept: `${rows(facts.data.filteredRows)} ROWS`,
          }}
          errorText={t('charts.error')}
        />
        <div className="chart-copy">
          <p className="eyebrow" data-flip-on-enter>FILTER</p>
          <h3 id="filter-h">{t('data.filter.heading')}</h3>
          <p className="sr-only">{t('data.filter.alt')}</p>
          <div className="chart-paras">
            {[1, 2, 3].map((i) => <div key={i} className="chart-para"><p>{t(`data.filter.body${i}`)}</p></div>)}
          </div>
          <a className="code-link mono" href={codeUrl('filter')} target="_blank" rel="noopener noreferrer">
            {t('common.codeLink')} ↗
          </a>
        </div>
      </article>
```

함수 안 `const t = getT(locale);` 뒤에:

```ts
  const rows = (n: number) => new Intl.NumberFormat(locale).format(n);
```

- [ ] **Step 4: Charts.tsx — 검증 설계 블록과 표 카드**

`src/components/sections/Charts.tsx` import에:

```ts
import { SPLIT } from '@/charts/split';
```

`Block` 타입을 바꾼다(stage 블록에 단계 설정, 표 카드 종류):

```ts
type Block =
  | (Common & { kind: 'stage'; chart: ChartKey; axis?: true; stages?: number; subs?: readonly number[]; subMs?: number })
  | (Common & { kind: 'card'; scene: SceneKey; figure?: FigureKey; table?: true })
  // 표만 있는 카드(계획 8-1): ⑤ 검증 설계 판 뒤 평가 방식 비교표. 제목 없이 표 caption이 이름이다
  | { kind: 'table'; id: string; scene: SceneKey; code: CodeChapter };
```

`VALIDATION_BLOCKS`의 `validation` 카드 줄을 두 줄로 바꾼다:

```ts
  // 머리표는 EVALUATION — 섹션 머리표 "05 — VALIDATION"과 같은 말이 겹치지 않게(사용자 확인 2026-09-30).
  // 세 평가 방식이 데이터를 나누는 점 그림(계획 8-1) — TSS 칸은 폴드가 저절로 넘어간다
  { kind: 'stage', id: 'validation', tag: 'EVALUATION', chart: 'chartSplit', code: 'validation', paras: 3, axis: true,
    stages: SPLIT.stages, subs: SPLIT.subs, subMs: SPLIT.subMs },
  // 세 방식을 나란히 보는 표는 판 바로 뒤 작은 카드로(사용자 결정 2026-09-30). 장면은 옛 카드의 validation(지형을 위에서) 그대로
  { kind: 'table', id: 'validationTable', scene: 'validation', code: 'validation' },
```

`ChartSection` 안 `tipOf` 뒤에 검증 설계 판 수치를 만든다:

```ts
  // ⑤ 검증 설계 판 위 수치(계획 8-1): 방식 이름(공통 영어)·R²·MAE·짧은 설명. 표와 같은 facts 값
  const num = (v: number) => formatValue(v, undefined, locale);
  const unit = t('charts.validation.table.maeUnit');
  const method = (name: string, sc: { r2: number; mae: number }, tag: string) => ({ name, r2: `R² ${num(sc.r2)}`, mae: `MAE ${num(sc.mae)}${unit}`, tag });
  const splitStrings = {
    axisX: t('charts.validation.axisX'),
    legend: [t('charts.validation.legendTrain'), t('charts.validation.legendTest'), t('charts.validation.legendUnused')] as [string, string, string],
    methods: [
      method('K-FOLD', facts.model.kfold, t('charts.validation.tagKf')),
      method('GROUPKFOLD', facts.model.gkfNoLookup, t('charts.validation.tagGkf')),
      method('TIMESERIESSPLIT', facts.model.tss, t('charts.validation.tagTss')),
    ] as const,
  };
```

import에 `formatValue`를 더한다: `import { formatValue, prefill, type Locale } from '@/lib/i18n';`

stage 블록 렌더의 `<ChartStage … />`를 바꾼다(단계 설정·검증 설계 문구, 표시 상자 틀은 있는 블록만):

```tsx
          <ChartStage
            chartKey={b.chart}
            dataVersion={facts.dataVersion}
            stages={b.stages}
            subs={b.subs}
            subMs={b.subMs}
            strings={{
              locale, holidays, axis: b.axis ? t(`charts.${b.id}.axis${b.chart === 'chartSplit' ? 'Y' : ''}`) : undefined,
              weekdayTitle: b.id === 'depart' ? t('charts.depart.weekdays') : undefined,
              // 표시 상자는 조작 층이 있는 차트(1·2·4)만 — 검증 설계 판에는 틀(tip)이 없다
              tip: b.chart === 'chartSplit' ? undefined : tipOf(b.id),
              tipHoliday: b.id === 'depart' ? tipOf('depart', 'tipHoliday') : undefined,
              ...(b.chart === 'chartSplit' ? splitStrings : {}),
            }}
            errorText={t('charts.error')}
            label={`${t(`charts.${b.id}.heading`)} · ${t('charts.touch')}`}
            hint={t('charts.touchHint')}
          />
```

`blocks.map((b) => b.kind === 'stage' ? (…) : (…))`를 세 갈래로 바꾼다 — 기존 card 렌더 앞에 표 카드를 둔다:

```tsx
      {blocks.map((b) => b.kind === 'stage' ? (
        /* 기존 stage 블록 그대로 */
      ) : b.kind === 'table' ? (
        <article key={b.id} data-scene={b.scene} className="chapter" aria-label={t('charts.validation.table.caption')}>
          <ValidationTable locale={locale} />
          {link(b)}
        </article>
      ) : (
        /* 기존 card 블록 그대로 */
      ))}
```

`link`·`body`의 매개변수 타입은 `Block`이다 — `table`에는 `paras`·`tag`가 없으므로 `link`는 `(b: { code: CodeChapter })`로, `body`는 `(b: Extract<Block, { kind: 'card' }>)`로 좁힌다. 파일 맨 위 설명 주석의 "차트 3(R² 거품)과 평가 방식 표·한계는 지금 장면을 쓰는 글 카드(.chapter)"를 "차트 3(R² 거품)·한계는 글 카드, 평가 방식 표는 검증 설계 판(계획 8-1) 뒤 표 카드"로 고친다.

- [ ] **Step 5: 통과 확인**

Run: `npx tsc --noEmit && npx vitest run && npm run build && npm run size`
Expected: PASS, 초기 JS 150KB 이하(ChartStage가 `flip`·`subTimer`를 더 불러오지만 가볍다 — 넘으면 멈추고 보고)

Run: `uptime; E2E_PORT=4191 npx playwright test tests/e2e/charts.spec.ts tests/e2e/terrain.spec.ts tests/e2e/motion.spec.ts --workers=2 --reporter=line`
Expected: 모두 PASS. 단 로컬에서 `[data-scene="bubble"] > p` 화소 대비 2.05:1은 main에서도 로컬에서만 실패하던 것(PR #21 기록) — 이것만 실패하면 CI 결과로 판단

- [ ] **Step 6: 커밋**

```bash
git add src/components/sections/DataSection.tsx src/components/sections/Charts.tsx tests/e2e/charts.spec.ts
git commit -m "feat(sections): filter plate in ② and validation split plate + table card in ⑤ (plan 8-1)"
```

---

### Task 9: 눈 확인·기록·PR

**Files:**
- Modify: `docs/superpowers/specs/2026-09-30-validation-filter-dots-design.md`(끝에 "구현 결과"), `CLAUDE.md`(현재 상태·다음 할 일·페이지 구성)

- [ ] **Step 1: 눈 확인(헤드 있는 크로미움)**

`npx serve out -l 4199 --no-clipboard`를 띄우고 1440×900·390×844에서 3D 켜짐(기본)과 꺼짐(`?` 없이 `prefers-reduced-motion` 에뮬레이션)으로 두 블록을 단계마다 스크린샷해 직접 본다:
- 이름표가 판 안, 자막 띠와 겹침 없음, 좁은 판 수치·규칙·범례 줄 겹침 없음(겹치면 Task 4·5 "주의"대로 옮기고 테스트 다시)
- 걸러내기: 켜짐 → 떨어짐이 보이는지, 3D에서 떨어지는 점이 판 아래로 사라지는지
- 검증 설계: TSS 폴드가 1.2초마다 넘어갈 때 3D 점이 튀지 않는지 — 튀면 `SPLIT.subMs`를 1500으로 올리고 설계 "구현 결과"에 적는다
- ② 지도 → 걸러내기 → 보드, ⑤ 차트 3 → 검증 설계 → 표 카드 → 차트 4 사이 점 이동이 자연스러운지

- [ ] **Step 2: 설계 "구현 결과"**

설계 파일 끝에 `## 구현 결과 (계획 8-1, 2026-09-30)`를 더하고 실제 값(표본 규칙별 개수, 960분 초과 개수, charts.json gzip 전후, subMs 조정 여부, 문구 키 이름 `body1..3`으로 바꾼 점, 눈 확인에서 옮긴 이름표 자리)을 적는다.

- [ ] **Step 3: CLAUDE.md**

"현재 상태"에 계획 8-1 PR 번호, "다음 할 일" 2번을 "점 연출: 검증 설계·걸러내기는 8-1로 끝남(문구 검토 남음)"으로, "페이지 구성"의 ②·⑤ 줄에 걸러내기 판·검증 설계 판을 한 줄씩 더한다. "문구 검토" 항목에 `data.filter.*`·`charts.validation.*`를 더한다.

- [ ] **Step 4: 커밋·push·PR**

```bash
git add docs/superpowers/specs/2026-09-30-validation-filter-dots-design.md CLAUDE.md
git commit -m "docs: plan 8-1 implementation notes"
git push -u origin feat/validation-filter-dots
gh pr create --base main --title "feat: ⑤ 검증 설계·② 걸러내기 점 연출 (계획 8-1)" --body "<요약·확인·보는 법(미리보기에서 ② 지도 아래, ⑤ 차트 3 아래로 스크롤)>

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

- [ ] **Step 5: CI·미리보기 확인 후 사용자에게 링크 전달**

`gh pr checks <번호> --watch` → Vercel 미리보기 주소와 "어디를 스크롤해 보면 되는지"를 사용자에게 준다(CLAUDE.md 작업 방식).
