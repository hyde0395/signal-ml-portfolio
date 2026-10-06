# 정보 전달 2 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 제목과 숫자만 읽어도 결과가 들어오게 — 결론형 제목, ① 숫자 4개를 성과로, ② 걸러내기 규칙 이름표, ③ 모델 구조 자막 2칸, ⑤ 검증 점수판, ⑤ 차트 3을 R² 전·후 아령 판으로 바꾼다.

**Architecture:** 새 수치는 `scripts/export_facts.py`의 `add_derived()`가 `facts.json`에 넣고(차트 데이터에서 계산하는 `insight.*` 포함), zod 스키마와 단위 테스트가 `charts.json`과 대조한다. 그림은 기존 그림 판(ChartStage) 구조를 그대로 쓴다 — 배치 함수(`src/charts/*.ts`)가 점·이름표·선·덧그림을 돌려주고, 3D와 2D가 같은 배치를 그린다. 차트 3은 3D 장면 카드(`bubble`)에서 새 배치 함수 `bubbleLayout`을 쓰는 판(`chartBubble`)으로 바뀐다.

**Tech Stack:** Next.js(App Router, 정적 export) · React 19 · TypeScript · zod 4 · vitest · Playwright(+axe) · Python 3.11(pandas, pytest)

**설계서:** `docs/superpowers/specs/2026-10-06-info-clarity-2-design.md` · 브랜치 `feat/info-clarity-2`(이미 있음, 설계서 커밋 `a54e116`)

---

## 설계서 검토 결과 (계획에 반영한 것)

코드와 대조해 보니 설계서와 다른 점·빈 곳이 있어 아래처럼 정했다. 작업 1에서 설계서 끝 "구현 결과"가 아니라 **해당 절에 바로** 고쳐 적는다.

1. **`insight.*`를 어디서 계산하나** — `export_facts.py`는 출발일 %를 모른다(`export_charts.py`가 만든다). 그런데 갱신 순서는 facts → … → charts다. 그래서 계산 함수 `add_derived(facts, charts)`는 `export_facts.py`에 두고 ① `npm run facts`가 (있으면) 기존 `charts.<기준일>.json`으로, ② `npm run charts`가 끝에서 새 charts로 한 번 더(`refresh_derived`), ③ 원본 CSV 없이 `npm run facts:derived`로 부를 수 있게 한다. 이번 PR은 ③만 돌린다(원본 데이터는 그대로)
2. **zod가 모르는 키를 지운다** — `factsSchema.parse()`는 스키마에 없는 키를 버리므로 `insight`·`baselineGap`·`groupShare`·`filter.removed`를 스키마에 넣지 않으면 자리 표시가 "Missing fact"로 깨진다
3. **부호 있는 정수 형식이 없다** — `|signed`는 소수 한 자리(`−5.0`)라 제목의 `+71%`·`−5%`를 못 만든다. `i18n.ts`에 `signed0`(부호 + 정수)을 더한다
4. **① 3번 칸 화살표** — `.project-stats dd`는 플립 글자판이 아니다(그냥 글자). `flip.ts` 문자 집합은 손대지 않는다. 휴대폰 배치도 2×2가 아니라 `flex-wrap`이다(그대로 둔다)
5. **② 규칙 ③ 이름** — 설계서 en·ja 초안이 기존 `data.filter.boxLabel`(en "Nonstop, but as long as a connection", ja "直行便なのに乗り継ぎ並み")과 다르다. 같은 말이어야 하므로 **규칙 ③ 이름은 `boxLabel` 키를 그대로 쓰고** 새 키는 `rule1`·`rule2`만 만든다
6. **② 걸러내기 h2·③ 모델 구조 h2** — `data.heading`·`features.structure.heading`은 h2다. 두 섹션은 머리표(`02 — DATA COLLECTION`·`03 — MODEL & FEATURES`)가 섹션 이름을 맡으므로 h2를 결론 문장으로 바꿔도 이름이 사라지지 않는다 — 설계서 표대로 바꾼다(④·⑤ h2는 그대로)
7. **차트 3 판에 필요한 새 문구** — 설계서에 없던 키: `charts.bubble.row1`·`row1Note`·`row2`·`row2Note`·`legendBefore`·`legendAfter`·`maeSame`·`alt`. `row2Note`의 9,387은 `{data.removedImplausible}` 자리 표시
8. **서버 → 클라이언트로 함수를 넘길 수 없다** — `ChartStrings`는 서버 컴포넌트(Charts.tsx)가 넘기는 값이라 형식 함수(`r2(v)` 등)는 `build.ts`에서 만든다. 아령 판 문구는 숫자·글자만 담은 `BubbleInput`으로 넘긴다
9. **⑤ 점수판 글자 폭** — 옆 칸(판 폭의 22%)에 `TIMESERIESSPLIT R² 0.637 · MAE 48,235원`을 1.4배로 넣으면 넘친다. 줄마다 두 칸(이름·R² / MAE)으로 나누고 판 위 이름은 `TSS`로 줄인다(표와 낭독 문단은 전체 이름 그대로)
10. **3D 제거 레이어** — `bubble` 장면이 빠지면 `removed`·`drop`을 1로 두는 장면이 없다. 셰이더·`terrain.json`의 제거 레이어 점(9,387개)은 이번에 지우지 않고 값 0으로 둔다 → `.claude/rules/performance.md` 후보에 "제거 레이어 점·셰이더 정리" 한 줄을 더한다(작업 8)

## 파일 구조

| 파일 | 할 일 |
|---|---|
| `scripts/export_facts.py` | `half_up`·`weekday_means`·`holiday_peak`·`add_derived`·`load_charts`·`refresh_derived`·`--derived-only` |
| `scripts/export_charts.py` | 끝에서 `refresh_derived(charts)` |
| `scripts/tests/test_export_facts.py` | 새 함수 테스트 |
| `package.json` | `facts:derived` 스크립트 |
| `data/facts.json` | `npm run facts:derived` 결과(손 편집 금지 — 단 `site` 한 줄 되돌리기는 알려진 절차) |
| `src/lib/facts.ts` | 스키마에 새 키 |
| `src/lib/i18n.ts` | `signed0` 형식 |
| `src/charts/layouts.ts` | `weekdayMeans`·`holidayPeakIndex`를 밖으로(테스트가 facts와 대조) |
| `content/{ko,en,ja}.json` | 제목·① 숫자·규칙 이름·아령 문구·`tools`·`tagTss`, `figure.bubble` 삭제 |
| `src/components/sections/Project.tsx` + `globals.css` | ① 숫자 4개, 2번 칸 작은 줄 |
| `src/charts/filter.ts` · `DataSection.tsx` | 규칙 이름표 = 이름 + 개수 |
| `src/charts/split.ts` · `types.ts` · `globals.css` · `ChartStage.tsx` | 점수판 줄(`score`·`scoreHi`·`scorePast`) |
| `src/components/sections/Charts.tsx` · `ValidationTable.tsx` | `EVALUATION` 머리표 없앰, 표 caption 숨김, `TSS`, 차트 3 판 블록 |
| `src/charts/bubble.ts` (새 파일) | 아령 배치 |
| `src/charts/types.ts` · `build.ts` | `chartBubble` 키, `keyRing` 이름표 |
| `src/three/scenes.ts` · `figureKeys.ts` · `TerrainScene.tsx` · `scripts/capture-fallbacks.mjs` · `public/fallback/bubble.webp` | `bubble` 장면·대체 이미지 정리, `chartBubble` 장면 |
| `src/charts/model.ts` · `Features.tsx` · `build.ts` | ③ 2칸 + `modelStage(칸, sub)` |
| `src/components/charts/ChartStage.tsx` | sub 타이머 `threshold: 0.5` |
| `tests/unit/*` · `tests/e2e/*` | 아래 작업마다 |

작업 순서: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8. 2·3은 1의 값(`removed`·`signed0`)을 쓴다. 4·5·7은 서로 파일이 겹치지 않지만(5·6은 `build.ts`·`types.ts`, 7도 `build.ts`) **한 폴더에서 순서대로** 한다 — 주간 사용량이 빠듯해 병렬은 권하지 않는다(메모리 `project-status`). e2e 전체는 작업 8에서 한 번(무거운 브라우저 테스트는 동시에 한두 개까지).

모든 작업 공통:
- 브랜치 `feat/info-clarity-2`에서. `git add <경로>`만(훅이 `-A`를 막는다)
- 코드에 **한국어 주석**: 파일 맨 위 한두 줄 + "왜"(`code-style` 규칙)
- 문구에 숫자 직접 기입 금지 — `tests/unit/content.test.ts`가 잡는다
- 테스트·빌드처럼 출력이 긴 실행은 `test-runner` 에이전트에 맡겨도 된다

---

### Task 1: facts 새 수치

**Files:**
- Modify: `scripts/export_facts.py`
- Modify: `scripts/export_charts.py:28-30`(import), `main()` 끝
- Modify: `scripts/tests/test_export_facts.py`
- Modify: `package.json`(scripts)
- Modify: `src/lib/facts.ts`, `src/lib/i18n.ts`, `src/charts/layouts.ts:153-154, 182-185`
- Modify: `tests/unit/facts.test.ts`, `tests/unit/i18n.test.ts`
- Modify: `docs/superpowers/specs/2026-10-06-info-clarity-2-design.md`(위 "설계서 검토 결과" 반영)
- Regenerate: `data/facts.json`

- [ ] **Step 1: 실패하는 pytest를 쓴다** — `scripts/tests/test_export_facts.py` 끝에 더한다

```python
def test_half_up_matches_js_math_round():
    # 사이트 단위 테스트가 Math.round로 다시 계산해 대조한다 — 파이썬 round()(은행가 반올림)와 .5에서 다르다
    assert ef.half_up(70.5) == 71
    assert ef.half_up(-17.27) == -17
    assert ef.half_up(-17.5) == -17
    assert ef.half_up(46.8) == 47


def test_weekday_means_monday_first_and_none_for_missing():
    # 2027-01-03 일, 01-04 월, 01-10 일
    got = ef.weekday_means(["2027-01-03", "2027-01-04", "2027-01-10"], [200, -170, 100])
    assert got == [-17, None, None, None, None, None, 15]


def test_holiday_peak_first_max_among_holiday_dates():
    # 공휴일이 아닌 날(800)은 무시, 같은 값이면 앞의 것(④ departLayout과 같은 규칙)
    assert ef.holiday_peak([800, 705, 705, 300], [None, "kr_new_year", "kr_christmas_day", "kr_new_year"]) == {"pct": 71, "holiday": "kr_new_year"}
    with pytest.raises(SystemExit):
        ef.holiday_peak([100], [None])


def test_add_derived_fills_new_numbers_without_touching_input():
    facts = {
        "data": {"filter": {"unit": 5742, "mismatch": 826, "direct": 9387, "durationMax": 400}},
        "model": {
            "baselineMae": 48688, "tss": {"mae": 48235},
            "featureGroups": [{"id": "lookup", "gain": 46.8, "features": []}, {"id": "categorical", "gain": 26.0, "features": []}],
            "bookingCurve": [{"label": "a", "pct": 11.1}, {"label": "b", "pct": -5.0}, {"label": "c", "pct": -4.3}],
        },
    }
    charts = {"dates": ["2027-01-03", "2027-01-04"], "depart": {"pct": [713, -100], "holiday": ["kr_new_year", None]}}
    out = ef.add_derived(facts, charts)
    assert out["data"]["filter"]["removed"] == 15955
    assert out["model"]["baselineGap"] == {"mae": 453, "pct": 0.9}
    assert out["model"]["groupShare"] == {"lookup": 47, "categorical": 26}
    assert out["insight"]["holidayPeak"] == {"pct": 71, "holiday": "kr_new_year"}
    assert out["insight"]["weekdayPct"] == [-10, None, None, None, None, None, 71]
    assert out["insight"]["curveMin"] == -5.0
    assert "removed" not in facts["data"]["filter"]  # 입력은 그대로


def test_add_derived_without_charts_keeps_existing_insight():
    facts = {
        "data": {"filter": {"unit": 1, "mismatch": 2, "direct": 3, "durationMax": 400}},
        "model": {"baselineMae": 100, "tss": {"mae": 90}, "featureGroups": [], "bookingCurve": [{"label": "a", "pct": 1.0}]},
        "insight": {"curveMin": 1.0},
    }
    out = ef.add_derived(facts, None)
    assert out["insight"] == {"curveMin": 1.0}
    assert out["model"]["baselineGap"] == {"mae": 10, "pct": 10.0}
```

- [ ] **Step 2: 실패 확인**

Run: `npm run pytest`
Expected: FAIL — `AttributeError: module 'export_facts' has no attribute 'half_up'`

- [ ] **Step 3: `export_facts.py` 구현**

맨 위 docstring의 실행 줄 아래에 한 줄 더한다:

```python
실행: npm run facts   (AIRFARE_ROOT 기본값 ~/Documents/airfare-forecasting-ml)
      npm run facts:derived   (원본 CSV 없이 facts.json·charts.json에서 계산하는 값만 다시 — 정보 전달 2)
```

`import json` 아래에 `import math`를 더하고, `METRICS_PATH` 아래에:

```python
CHARTS_DIR = ROOT / "public" / "data"
```

`merge_facts` 아래에 더한다:

```python
def half_up(v: float) -> int:
    """JS Math.round와 같은 반올림(.5는 위로). 사이트 단위 테스트가 Math.round로 다시 계산해 대조하므로 같은 규칙을 쓴다."""
    return int(math.floor(v + 0.5))


def weekday_means(dates: list[str], pct10: list[int]) -> list[int | None]:
    """요일(월=0 … 일=6)별 출발일 % 평균(정수). ④ 요일 막대(src/charts/layouts.ts weekdayMeans)와 같은 계산 — 출발일이 없는 요일은 None."""
    total, count = [0.0] * 7, [0] * 7
    for d, p in zip(dates, pct10):
        k = pd.Timestamp(d).weekday()
        total[k] += p / 10
        count[k] += 1
    return [half_up(total[k] / count[k]) if count[k] else None for k in range(7)]


def holiday_peak(pct10: list[int], holiday: list[str | None]) -> dict:
    """공휴일 무렵 출발일 중 가장 비싼 날의 %(정수)와 공휴일 코드. ④ 봉우리 이름표(layouts.ts holidayPeakIndex)와 같은 규칙 —
    같은 값이면 앞의 날. ④ 제목이 공휴일 이름을 글자로 쓰므로(자리 표시로 못 끌어옴) 사이트 테스트가 코드를 확인한다."""
    best: tuple[int, str] | None = None
    for p, h in zip(pct10, holiday):
        if h is not None and (best is None or p > best[0]):
            best = (p, h)
    if best is None:
        raise SystemExit("공휴일 무렵 출발일이 없다 — ④ 출발일 제목을 만들 수 없다")
    return {"pct": half_up(best[0] / 10), "holiday": best[1]}


def add_derived(facts: dict, charts: dict | None) -> dict:
    """정보 전달 2(설계 2026-10-06 §2): 다른 수치에서 계산하는 값을 채운 새 dict. charts가 없으면 insight는 있던 것을 둔다.
    - data.filter.removed: 규칙 셋이 뺀 행 합(② 걸러내기 제목)
    - model.baselineGap: 단순 기준선과 모델 MAE 차이(⑤ 한계 제목), model.groupShare: 그룹 gain 정수(③ 와플 제목)
    - insight: charts.json 출발일 %에서 공휴일 봉우리·요일 평균(④ 출발일 제목), bookingCurve 최솟값(④ U자 제목)"""
    out = json.loads(json.dumps(facts))
    f = out["data"]["filter"]
    f["removed"] = f["unit"] + f["mismatch"] + f["direct"]
    m = out["model"]
    gap = m["baselineMae"] - m["tss"]["mae"]
    m["baselineGap"] = {"mae": half_up(gap), "pct": round(gap / m["baselineMae"] * 100, 1)}
    m["groupShare"] = {g["id"]: half_up(g["gain"]) for g in m["featureGroups"]}
    if charts is not None:
        dep = charts["depart"]
        out["insight"] = {
            "holidayPeak": holiday_peak(dep["pct"], dep["holiday"]),
            "weekdayPct": weekday_means(charts["dates"], dep["pct"]),
            "curveMin": min(b["pct"] for b in m["bookingCurve"]),
        }
    return out


def load_charts(as_of: str) -> dict | None:
    path = CHARTS_DIR / f"charts.{as_of}.json"
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else None


def write_facts(facts: dict) -> None:
    FACTS_PATH.write_text(json.dumps(facts, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def refresh_derived(charts: dict | None = None) -> None:
    """facts.json의 계산 값만 다시 쓴다. export_charts.py가 새 charts.json을 만든 뒤 부른다(갱신 순서가 facts → charts라서)."""
    facts = json.loads(FACTS_PATH.read_text(encoding="utf-8"))
    write_facts(add_derived(facts, charts if charts is not None else load_charts(facts["dataVersion"])))
```

`main()`을 바꾼다:

```python
def main(argv: list[str] | None = None) -> None:
    if "--derived-only" in (sys.argv[1:] if argv is None else argv):
        refresh_derived()
        print("facts.json 계산 값 갱신(원본 CSV 안 읽음)")
        return
    metrics = json.loads(METRICS_PATH.read_text(encoding="utf-8"))
    meta = metrics.pop("_meta")
    as_of = meta["asOf"]
    raw = pd.read_csv(AIRFARE_ROOT / "data" / "raw" / "flight_prices.csv")
    data = compute_data_stats(raw, as_of)
    check_snapshot(data, meta)
    metrics["featureCount"] = check_feature_groups(metrics["featureGroups"], model_feature_names())
    existing = json.loads(FACTS_PATH.read_text(encoding="utf-8")) if FACTS_PATH.exists() else {}
    merged = add_derived(merge_facts(existing, as_of, data, metrics), load_charts(as_of))
    write_facts(merged)
    print(f"facts.json 갱신: {as_of}, {data['filteredRows']:,}행")
```

- [ ] **Step 4: `export_charts.py`가 끝에서 부른다**

import 줄에 `refresh_derived`를 더한다:

```python
from export_facts import (  # noqa: E402
    AIRFARE_ROOT, DURATION_MAX, METRICS_PATH, PRICE_FLOOR, drop_implausible_direct_flights, drop_inconsistent_flight_times,
    refresh_derived,
)
```

`main()`에서 `out.write_bytes(body)` 바로 아래:

```python
    # facts.json의 insight(④ 제목 수치)는 이 출발일 %에서 계산한다 — 갱신 순서가 facts → charts라 여기서 한 번 더 맞춘다
    refresh_derived(charts)
```

- [ ] **Step 5: pytest 통과 확인**

Run: `npm run pytest`
Expected: PASS(새 5개 포함 전부)

- [ ] **Step 6: `package.json`에 스크립트**

`"facts": …` 줄 아래:

```json
    "facts:derived": "sh scripts/py.sh scripts/export_facts.py --derived-only",
```

- [ ] **Step 7: facts.json 다시 만들기**

Run: `npm run facts:derived && git diff --stat data/facts.json && git diff data/facts.json | head -80`
Expected: `data.filter.removed: 15955`, `model.baselineGap {mae: 453, pct: 0.9}`, `model.groupShare {lookup: 47, categorical: 26, holiday: 11, days: 7, flight: 5, market: 1}`, 끝에 `insight {holidayPeak {pct: 71, holiday: kr_new_year}, weekdayPct [2, -17, -17, -11, 7, 3, 20], curveMin: -5.0}`.
`site` 줄이 여러 줄로 펼쳐졌으면 원래 한 줄 `"site": { "airport": { "code": "ICN", "lat": 37.46, "lon": 126.44 } },`로 되돌린다(알려진 동작, `refresh-data` 스킬). 다른 값이 바뀌었으면 멈추고 원인을 찾는다.

- [ ] **Step 8: 실패하는 vitest를 쓴다**

`tests/unit/i18n.test.ts`의 `formatValue` describe 안(없으면 끝)에:

```ts
it('signed0: 부호 + 정수(정보 전달 2 제목의 +71% · −5%)', () => {
  expect(formatValue(71, 'signed0', 'ko')).toBe('+71');
  expect(formatValue(-5, 'signed0', 'en')).toBe('-5');
  expect(formatValue(-4.6, 'signed0', 'ja')).toBe('-5');
  expect(formatValue(0, 'signed0', 'ko')).toBe('0');
});
```

(파일 위에 `formatValue` import가 없으면 `import { formatValue } from '@/lib/i18n';`을 더한다.)

`tests/unit/facts.test.ts` 맨 위 import에 더한다:

```ts
import { readFileSync } from 'node:fs';
import type { ChartsData } from '@/charts/data';
import { holidayPeakIndex, weekdayMeans } from '@/charts/layouts';
```

파일 끝에:

```ts
// 정보 전달 2(설계 2026-10-06 §2): export_facts.py add_derived가 넣은 값을 사이트 데이터로 다시 계산해 대조한다
describe('정보 전달 2 새 수치', () => {
  const charts = JSON.parse(readFileSync(`public/data/charts.${facts.dataVersion}.json`, 'utf8')) as ChartsData;

  it('걸러 낸 행 = 규칙 셋의 합 = 원본 − 남은 행', () => {
    const f = facts.data.filter;
    expect(f.removed).toBe(f.unit + f.mismatch + f.direct);
    expect(f.removed).toBe(facts.data.rawRows - facts.data.filteredRows);
  });

  it('단순 기준선과 MAE 차이(원·%)', () => {
    const gap = facts.model.baselineMae - facts.model.tss.mae;
    expect(facts.model.baselineGap.mae).toBe(Math.round(gap));
    expect(facts.model.baselineGap.pct).toBeCloseTo(Math.round((gap / facts.model.baselineMae) * 1000) / 10, 9);
  });

  it('그룹 몫 = gain 반올림(③ 와플 제목)', () => {
    for (const g of facts.model.featureGroups) expect(facts.model.groupShare[g.id]).toBe(Math.round(g.gain));
  });

  // ④ 출발일 제목은 공휴일 이름을 글자로 쓴다("신정"/"New Year"/"元日") — 재학습으로 봉우리가 바뀌면 여기서 멈추고 제목을 고친다
  it('공휴일 봉우리 = 출발일 차트 이름표와 같은 날, 신정', () => {
    const i = holidayPeakIndex(charts);
    expect(facts.insight.holidayPeak.pct).toBe(Math.round(charts.depart.pct[i] / 10));
    expect(facts.insight.holidayPeak.holiday).toBe(charts.depart.holiday[i]);
    expect(facts.insight.holidayPeak.holiday).toBe('kr_new_year');
  });

  it('요일 평균 = 요일 막대 값(정수)', () => {
    expect(facts.insight.weekdayPct).toEqual(weekdayMeans(charts).map((v) => (v === null ? null : Math.round(v))));
  });

  it('U자 최솟값 = bookingCurve 최솟값', () => {
    expect(facts.insight.curveMin).toBe(Math.min(...facts.model.bookingCurve.map((b) => b.pct)));
  });
});
```

- [ ] **Step 9: 실패 확인**

Run: `npx vitest run tests/unit/facts.test.ts tests/unit/i18n.test.ts`
Expected: FAIL — `holidayPeakIndex is not a function`(또는 import 오류), `Cannot format 71 as "signed0"`

- [ ] **Step 10: 스키마·형식·도우미 구현**

`src/lib/facts.ts` — `data.filter` 줄을 바꾼다:

```ts
    // ② 걸러내기 판(계획 8-1): 규칙별 제거 행 수(① 단위·소요, ② 시각 불일치, ③ 직항 확인)와 소요 시간 상한(분).
    // removed = 셋의 합(정보 전달 2, ② 걸러내기 제목) — export_facts.py add_derived가 계산한다
    filter: z.object({
      unit: z.number().int(), mismatch: z.number().int(), direct: z.number().int(), durationMax: z.number().int(), removed: z.number().int(),
    }),
```

`model` 안 `featureCount` 줄 아래:

```ts
    // 정보 전달 2(설계 2026-10-06 §2) — export_facts.py add_derived가 계산한다. ⑤ 한계 제목·③ 와플 제목
    baselineGap: z.object({ mae: z.number().int(), pct: z.number() }),
    groupShare: z.object({
      lookup: z.number().int(), categorical: z.number().int(), holiday: z.number().int(),
      days: z.number().int(), flight: z.number().int(), market: z.number().int(),
    }),
```

`model: z.object({...}),` 닫는 줄 아래(최상위):

```ts
  // ④ 제목 수치(정보 전달 2) — charts.json 출발일 %와 bookingCurve에서 계산한다. 단위 테스트가 charts.json과 대조한다
  insight: z.object({
    holidayPeak: z.object({ pct: z.number().int(), holiday: z.string().min(1) }),
    weekdayPct: z.array(z.number().int().nullable()).length(7), // 월 … 일, 출발일이 없는 요일은 null
    curveMin: z.number(),
  }),
```

`src/lib/i18n.ts` — `if (format === 'plain' …` 줄 위에:

```ts
  // 제목 속 부호 있는 정수 %(정보 전달 2: "+71%", "−5%"). signed는 소수 한 자리라 따로 둔다
  if (format === 'signed0' && typeof value === 'number') {
    return new Intl.NumberFormat(intl, { maximumFractionDigits: 0, signDisplay: 'exceptZero' }).format(value);
  }
```

`src/charts/layouts.ts` — `export const DEPART = …` 줄 바로 아래에 두 함수를 더한다(파일 위에 `ChartsData` 타입 import가 이미 있는지 확인, 없으면 `import type { ChartsData } from './data';`):

```ts
// 요일(월=0 … 일=6)별 출발일 % 평균. 출발일이 없는 요일은 null. facts insight.weekdayPct(export_facts.py weekday_means)와
// 같은 계산이라 단위 테스트가 둘을 대조한다
export function weekdayMeans(d: Pick<ChartsData, 'dates' | 'depart'>): (number | null)[] {
  const sum = Array(7).fill(0), cnt = Array(7).fill(0);
  d.dates.forEach((iso, i) => { const k = (new Date(utc(iso)).getUTCDay() + 6) % 7; sum[k] += d.depart.pct[i] / 10; cnt[k]++; });
  return sum.map((v, k) => (cnt[k] ? v / cnt[k] : null));
}

// 공휴일 무렵 출발일 중 가장 비싼 날의 번호(없으면 −1, 같은 값이면 앞의 날). ④ 봉우리 이름표와 facts insight.holidayPeak가 같은 규칙
export function holidayPeakIndex(d: Pick<ChartsData, 'dates' | 'depart'>): number {
  let peak = -1;
  d.dates.forEach((_, i) => { if (d.depart.holiday[i] !== null && (peak < 0 || d.depart.pct[i] > d.depart.pct[peak])) peak = i; });
  return peak;
}
```

`departLayout` 안에서 153–154행을

```ts
  const peak = holidayPeakIndex(d);
```

로, 182–185행(요일 평균 `sum`·`cnt`·`avg` 세 줄)을

```ts
  // 요일 평균(월=0 … 일=6)
  const avg = weekdayMeans(d);
```

로 바꾼다.

- [ ] **Step 11: 통과 확인**

Run: `npm run typecheck && npx vitest run tests/unit/facts.test.ts tests/unit/i18n.test.ts tests/unit/charts-layouts.test.ts`
Expected: PASS

- [ ] **Step 12: 설계서에 검토 결과 반영**

`docs/superpowers/specs/2026-10-06-info-clarity-2-design.md`에서:
- §2 표 아래 첫 줄 앞에 "계산 함수 `add_derived`는 `export_facts.py`, 호출은 `npm run facts`·`npm run charts` 끝·`npm run facts:derived`(원본 CSV 없이)" 한 줄
- §3 자리 표시 줄: `{insight.curveMin|signed}` → `{insight.curveMin|signed0}`, 출발일 `+{pct}%` → `{insight.holidayPeak.pct|signed0}%`, "새 형식 `signed0`(부호 + 정수)" 덧붙임
- §4: "`→`를 글자판 문자 집합에 넣거나…" 문장을 "① 숫자 칸은 플립 글자판이 아니라 그냥 글자라 바꿀 것 없음"으로, "휴대폰: 지금처럼 2×2" → "휴대폰: 지금처럼 줄바꿈(flex-wrap)"
- §8: 이름 키를 "`data.filter.rule1`·`rule2` + 규칙 ③은 `data.filter.boxLabel` 그대로", en·ja 초안의 ③ 줄 삭제
- §6 끝에 "새 문구 키: `charts.bubble.row1`·`row1Note`·`row2`·`row2Note`·`legendBefore`·`legendAfter`·`maeSame`·`alt`. 3D 제거 레이어 점·셰이더는 값 0으로 두고 성능 계획에서 정리"
- §5에 "판 위 방식 이름은 `TSS`(옆 칸 폭), 줄마다 두 칸(이름·R² / MAE)"

- [ ] **Step 13: 커밋**

```bash
git add scripts/export_facts.py scripts/export_charts.py scripts/tests/test_export_facts.py package.json data/facts.json \
  src/lib/facts.ts src/lib/i18n.ts src/charts/layouts.ts tests/unit/facts.test.ts tests/unit/i18n.test.ts \
  docs/superpowers/specs/2026-10-06-info-clarity-2-design.md
git commit -m "feat: 정보 전달 2 facts 새 수치(걸러 낸 행·기준선 차이·그룹 몫·봉우리·요일·U자 최솟값)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: 결론형 제목 + ① 숫자 4개

**Files:**
- Modify: `content/ko.json`, `content/en.json`, `content/ja.json`
- Modify: `src/components/sections/Project.tsx`
- Modify: `src/styles/globals.css:400-404`

- [ ] **Step 1: 문구 바꾸기(세 언어 한 번에)**

content 파일은 `json.dumps(indent=2, ensure_ascii=False)` 형식과 정확히 같다(확인함) — 스크립트로 바꿔도 다른 줄이 흔들리지 않는다.

```bash
python3 - <<'EOF'
import json
# 정보 전달 2(설계 2026-10-06 §3·§4): 결론형 제목과 ① 숫자 4개. 영·일은 Claude 초안(문구 검토 때 사용자·검수자)
T = {
  "data.heading": {
    "ko": "{data.collectMonths}개월 동안 가격 {data.rawRows}개를 모았다",
    "en": "{data.rawRows} prices collected over {data.collectMonths} months",
    "ja": "{data.collectMonths}か月で価格{data.rawRows}件を集めた"},
  "data.filter.heading": {
    "ko": "잘못 들어온 {data.filter.removed}행을 걸러 냈다",
    "en": "{data.filter.removed} faulty rows filtered out",
    "ja": "誤った{data.filter.removed}行を取り除いた"},
  "features.structure.heading": {
    "ko": "기준 가격을 먼저 잡고, 벗어난 몫을 배운다",
    "en": "A baseline price first, then the gap from it",
    "ja": "まず基準価格を置き、そこからのずれを学ぶ"},
  "features.heading": {
    "ko": "과거 가격 통계 {model.groupShare.lookup}% · 노선·항공사 {model.groupShare.categorical}%",
    "en": "Past-price stats {model.groupShare.lookup}% · route & airline {model.groupShare.categorical}%",
    "ja": "過去価格の統計 {model.groupShare.lookup}% · 路線・航空会社 {model.groupShare.categorical}%"},
  "charts.depart.heading": {
    "ko": "언제 떠나느냐가 더 크다: 신정 무렵 {insight.holidayPeak.pct|signed0}%",
    "en": "When you fly matters more: {insight.holidayPeak.pct|signed0}% around New Year",
    "ja": "いつ発つかの方が大きい：元日前後 {insight.holidayPeak.pct|signed0}%"},
  "charts.curve.heading": {
    "ko": "언제 사느냐는 그보다 작다: 출발 한 달 전후 {insight.curveMin|signed0}%",
    "en": "When you buy matters less: {insight.curveMin|signed0}% about a month out",
    "ja": "いつ買うかはそれより小さい：出発ひと月前後 {insight.curveMin|signed0}%"},
  "charts.bubble.heading": {
    "ko": "R²는 두 번 부풀려져 있었다",
    "en": "R² was inflated — twice",
    "ja": "R²は二度、水増しされていた"},
  "charts.validation.heading": {
    "ko": "미래 데이터를 쓰지 않는 검증으로 성능을 잰다",
    "en": "Measured without peeking at future data",
    "ja": "未来のデータを使わない検証で性能を測る"},
  "charts.band.heading": {
    "ko": "예측 구간이 실제 가격의 {model.interval.coverage}%를 감쌌다",
    "en": "The interval covered {model.interval.coverage}% of actual prices",
    "ja": "予測区間が実際の価格の{model.interval.coverage}%を捉えた"},
  "charts.limits.heading": {
    "ko": "단순 기준선과 MAE 차이는 {model.baselineGap.mae}원({model.baselineGap.pct|fixed1}%)",
    "en": "MAE gap to a simple baseline: ₩{model.baselineGap.mae} ({model.baselineGap.pct|fixed1}%)",
    "ja": "単純なベースラインとのMAE差は{model.baselineGap.mae}ウォン({model.baselineGap.pct|fixed1}%)"},
  # ⑤ 점수판 TSS 꼬리표(설계 §5)
  "charts.validation.tagTss": {
    "ko": "운영 기준 · 대표값", "en": "production baseline · headline value", "ja": "運用基準 · 代表値"},
}
STATS = {  # ① 숫자 4개(설계 §4) — 키 순서 = 화면 순서
  "ko": {"rows": {"value": "{data.rawRows}", "label": "모은 가격"},
         "coverage": {"value": "{model.interval.coverage}%", "label": "예측 구간 포함률", "sub": "보정 전 {model.interval.driftLow}%"},
         "r2Fix": {"value": "{model.bubble.firstR2} → {model.bubble.firstR2After}", "label": "부풀려진 R² 바로잡음"},
         "routes": {"value": "{data.routes}", "label": "노선"}},
  "en": {"rows": {"value": "{data.rawRows}", "label": "prices collected"},
         "coverage": {"value": "{model.interval.coverage}%", "label": "interval coverage", "sub": "{model.interval.driftLow}% before calibration"},
         "r2Fix": {"value": "{model.bubble.firstR2} → {model.bubble.firstR2After}", "label": "inflated R², corrected"},
         "routes": {"value": "{data.routes}", "label": "routes"}},
  "ja": {"rows": {"value": "{data.rawRows}", "label": "集めた価格"},
         "coverage": {"value": "{model.interval.coverage}%", "label": "予測区間のカバー率", "sub": "補正前 {model.interval.driftLow}%"},
         "r2Fix": {"value": "{model.bubble.firstR2} → {model.bubble.firstR2After}", "label": "水増しされたR²を修正"},
         "routes": {"value": "{data.routes}", "label": "路線"}},
}
def put(d, key, v):
    *path, last = key.split(".")
    for p in path: d = d[p]
    assert last in d, key  # 새 키를 만들지 않고 있는 키만 바꾼다(오타 방지)
    d[last] = v
for l in ("ko", "en", "ja"):
    p = f"content/{l}.json"
    d = json.load(open(p, encoding="utf-8"))
    for k, v in T.items(): put(d, k, v[l])
    d["project"]["stats"] = STATS[l]
    open(p, "w", encoding="utf-8").write(json.dumps(d, ensure_ascii=False, indent=2) + "\n")
EOF
git diff --stat content/
```

Expected: 세 파일만 바뀜, 각 20줄 안팎.

- [ ] **Step 2: 문구 테스트**

Run: `npx vitest run tests/unit/content.test.ts`
Expected: PASS(자리 표시가 모두 facts에서 풀리고, 숫자 직접 기입 없음). `R²`의 `²`는 숫자 검사 정규식 `[0-9０-９]`에 걸리지 않는다.

- [ ] **Step 3: `Project.tsx` — 숫자 4개와 작은 줄**

`STATS` 줄과 `<dl>` 부분을 바꾼다:

```tsx
// content/*.json의 project.stats.<키>.value/label(+ sub)과 순서를 맞춘다. 숫자는 과정 성과만(방향 결정 2, 2026-10-04)
const STATS = ['rows', 'coverage', 'r2Fix', 'routes'] as const;
```

```tsx
        <dl className="project-stats">
          {STATS.map((k) => {
            // 작은 둘째 줄(예: "보정 전 69%")은 이름 아래 — 있는 칸만
            const sub = (dictionaries[locale].project.stats as Record<string, { sub?: string }>)[k].sub;
            return (
              // 숫자를 위에, 이름을 아래에 보이도록 CSS(column-reverse)로 뒤집는다. 읽는 순서는 이름 → 숫자
              <div key={k}>
                <dt>{t(`project.stats.${k}.label`)}{sub && <small>{t(`project.stats.${k}.sub`)}</small>}</dt>
                <dd className="mono">{t(`project.stats.${k}.value`)}</dd>
              </div>
            );
          })}
        </dl>
```

import를 `import { dictionaries, getT } from '@/lib/content';`로 바꾼다. 파일 맨 위 주석 "숫자 4개" 뒤에 "(정보 전달 2: 모은 가격·구간 포함률·R² 바로잡음·노선)"을 더한다.

- [ ] **Step 4: CSS**

`src/styles/globals.css` 403행(`.project-stats dt`) 아래:

```css
/* ① 2번 칸 작은 둘째 줄(정보 전달 2 §4): 이름 아래 작게 — 숫자가 무엇과 비교한 값인지 */
.project-stats dt small { display: block; margin-top: 2px; font-size: 0.75rem; color: var(--mute); }
```

- [ ] **Step 5: 타입·단위 테스트**

Run: `npm run typecheck && npm test`
Expected: PASS. (`charts-content.test.ts`·`content.test.ts` 포함)

- [ ] **Step 6: 커밋**

```bash
git add content/ko.json content/en.json content/ja.json src/components/sections/Project.tsx src/styles/globals.css
git commit -m "feat: 결론형 제목과 ① 숫자 4개를 성과로

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: ② 걸러내기 규칙 이름표

**Files:**
- Modify: `src/charts/filter.ts:16, 18-22, 63-70`
- Modify: `src/charts/build.ts`(`ChartStrings`, `chartFilter` case)
- Modify: `src/components/sections/DataSection.tsx`(strings)
- Modify: `content/{ko,en,ja}.json`(`data.filter.rule1`·`rule2`)
- Test: `tests/unit/charts-filter.test.ts`

- [ ] **Step 1: 실패하는 테스트**

`tests/unit/charts-filter.test.ts` 16행 `S`에 두 필드를 더한다:

```ts
const S = { axisX: '소요', axisY: '평균 대비', box: '직항인데 오래', rowsRaw: '258,829 ROWS', rowsKept: '242,874 ROWS', minutes: (v: number) => `${v}`, pct: (v: number) => `${v}%`,
  rules: ['단위 오류', '시각 불일치', '직항인데 오래'] as [string, string, string], counts: ['5,742', '826', '9,387'] as [string, string, string] };
```

'규칙 이름표: 적용된 규칙은 ruleOn' 테스트 아래에 더한다:

```ts
  // 정보 전달 2 §8: 넓은 판 "RULE n · 이름 · 개수", 켜지기 전에는 개수 없음, 좁은 판은 이름 생략
  it('규칙 이름표 글자: 넓은 판은 이름 + 켜진 뒤 개수, 좁은 판은 RULE n · 개수', () => {
    const text = (st: number, w = 1080) => filterLayout(data, { w, h: 414 }, st, 0, S).labels
      .filter((l) => l.type === 'text' && /^RULE/.test(l.text)).map((l) => (l as { text: string }).text);
    expect(text(0)).toEqual(['RULE 1 · 단위 오류', 'RULE 2 · 시각 불일치', 'RULE 3 · 직항인데 오래']);
    expect(text(1)).toEqual(['RULE 1 · 단위 오류 · 5,742', 'RULE 2 · 시각 불일치 · 826', 'RULE 3 · 직항인데 오래']);
    expect(text(2)).toEqual(['RULE 1 · 단위 오류 · 5,742', 'RULE 2 · 시각 불일치 · 826', 'RULE 3 · 직항인데 오래 · 9,387']);
    expect(text(0, 358)).toEqual(['RULE 1', 'RULE 2', 'RULE 3']);
    expect(text(2, 358)).toEqual(['RULE 1 · 5,742', 'RULE 2 · 826', 'RULE 3 · 9,387']);
  });
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/unit/charts-filter.test.ts`
Expected: FAIL — 글자가 `RULE 1 · DURATION · UNIT`

- [ ] **Step 3: `filter.ts` 구현**

16행 `const RULES = …`를 지우고 `FilterTexts`를 바꾼다:

```ts
export type FilterTexts = {
  axisX: string; axisY: string; box: string;
  rowsRaw: string; rowsKept: string; // "258,829 ROWS"처럼 이미 형식을 갖춘 글자(서버가 facts로 만든다)
  // 규칙 이름(언어별, ③은 상자 이름표와 같은 말)과 개수(지역 천 단위, facts data.filter.unit·mismatch·direct) — 정보 전달 2 §8
  rules: readonly [string, string, string]; counts: readonly [string, string, string];
  minutes(v: number): string; pct(v: number): string;
};
```

규칙 이름표 반복(지금 `RULES.forEach(…)`)을 바꾼다:

```ts
  // 규칙 이름표(정보 전달 2 §8): 머리 "RULE n"은 세 언어 공통. 켜지기 전에는 이름까지만, 켜지면 개수가 붙어 제목의 걸러 낸 행 수가
  // 단계마다 더해지는 모양이 된다. 좁은 판은 이름을 빼고 머리 + 개수만(세 칸이 한 줄에 들어가야 한다)
  s.rules.forEach((name, i) => {
    const on = i < 2 ? st >= 1 : st >= 2;
    const x = wide ? sideX : gx0 + ((W - 8 - gx0) / 3) * i;
    const y = wide ? H * 0.12 + i * 24 : H * 0.18;
    const head = `RULE ${i + 1}`;
    const text = wide ? `${head} · ${name}${on ? ` · ${s.counts[i]}` : ''}` : on ? `${head} · ${s.counts[i]}` : head;
    labels.push({ type: 'text', x: x / W, y: y / H, text, align: 'start', cls: on ? 'ruleOn' : 'rule' });
  });
```

- [ ] **Step 4: 문구 키 더하기**

```bash
python3 - <<'EOF'
import json
# ② 걸러내기 규칙 이름(정보 전달 2 §8). 규칙 ③은 data.filter.boxLabel을 그대로 쓴다(같은 말이어야 해서)
R = {"ko": ["소요 시간·단위 오류", "시각 불일치"], "en": ["Duration / unit error", "Time mismatch"], "ja": ["所要時間・単位の誤り", "時刻の不一致"]}
for l, (r1, r2) in R.items():
    p = f"content/{l}.json"; d = json.load(open(p, encoding="utf-8"))
    f = d["data"]["filter"]
    # boxLabel 바로 뒤에 넣어 세 파일 키 순서를 같게
    items = list(f.items()); i = [k for k, _ in items].index("boxLabel") + 1
    d["data"]["filter"] = dict(items[:i] + [("rule1", r1), ("rule2", r2)] + items[i:])
    open(p, "w", encoding="utf-8").write(json.dumps(d, ensure_ascii=False, indent=2) + "\n")
EOF
```

- [ ] **Step 5: `build.ts`·`DataSection.tsx` 연결**

`src/charts/build.ts` `ChartStrings`의 `box?` 줄 아래:

```ts
  rules?: [string, string, string];  // 걸러내기 규칙 이름(③은 box와 같은 말)
  ruleCounts?: [string, string, string]; // 걸러내기 규칙별 개수 글자(서버가 facts로 만든다)
```

`chartFilter` case의 `filterLayout(…, { … })` 객체에 더한다:

```ts
        rules: s.rules ?? ['', '', ''], counts: s.ruleCounts ?? ['', '', ''],
```

`DataSection.tsx`의 `strings={{ … }}` 안 `rowsRaw` 줄 아래에:

```tsx
            rules: [t('data.filter.rule1'), t('data.filter.rule2'), t('data.filter.boxLabel')],
            ruleCounts: [rows(facts.data.filter.unit), rows(facts.data.filter.mismatch), rows(facts.data.filter.direct)],
```

- [ ] **Step 6: 통과 확인**

Run: `npm run typecheck && npx vitest run tests/unit/charts-filter.test.ts tests/unit/charts-draw.test.ts tests/unit/content.test.ts`
Expected: PASS. `charts-draw.test.ts`의 chartFilter 테스트가 `rules` 없이 부르면 빈 이름이 들어가도 통과한다.

- [ ] **Step 7: 커밋**

```bash
git add src/charts/filter.ts src/charts/build.ts src/components/sections/DataSection.tsx content/ko.json content/en.json content/ja.json tests/unit/charts-filter.test.ts
git commit -m "feat: ② 걸러내기 규칙 이름표에 언어별 이름과 개수

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: ⑤ 검증 점수판 + 겹치는 이름 정리

**Files:**
- Modify: `src/charts/split.ts:66-73`(수치 이름표 5개)
- Modify: `src/charts/types.ts`(`ChartLabel` cls)
- Modify: `src/components/charts/ChartStage.tsx:389`(플립 대상)
- Modify: `src/styles/globals.css:561-566, 622-624`
- Modify: `src/components/sections/Charts.tsx`(`TSS`, `EVALUATION` 제거, `tag` 선택)
- Modify: `src/components/sections/ValidationTable.tsx`(caption 숨김)
- Test: `tests/unit/charts-split.test.ts`

- [ ] **Step 1: 실패하는 테스트**

`tests/unit/charts-split.test.ts`의 '앞 이름표 5개는 …' 테스트를 아래로 **바꾼다**:

```ts
  // 정보 전달 2 §5 점수판: 앞 8개 = 줄 3개 × (이름·R², MAE) + 꼬리표 + 폴드. 아직 안 나온 줄은 빈 글자(자리 번호가 단계 사이에 이어져
  // 같은 자리의 플립이 이어진다), 지난 줄은 scorePast, 지금 줄은 score, TSS 단계의 TSS 줄만 scoreHi + ▶
  it('점수판: 단계 n에 줄 n+1개, 마지막 줄만 강조', () => {
    const head = (L: ReturnType<typeof splitLayout>) => L.labels.slice(0, 8).map((l) => (l.type === 'text' ? [l.text, l.cls] : null));
    expect(head(all[0])).toEqual([
      ['K-FOLD · R² 0.6', 'score'], ['MAE 1원', 'score'],
      ['', 'score'], ['', 'score'], ['', 'score'], ['', 'score'],
      ['k-fold', 'note'], ['', 'statSm'],
    ]);
    expect(head(all[1]).slice(0, 4)).toEqual([
      ['K-FOLD · R² 0.6', 'scorePast'], ['MAE 1원', 'scorePast'],
      ['GROUPKFOLD · R² 0.6', 'score'], ['MAE 1원', 'score'],
    ]);
    const tss = head(all[4]);
    expect(tss[4]).toEqual(['▶ TIMESERIESSPLIT · R² 0.6', 'scoreHi']);
    expect(tss[5]).toEqual(['MAE 1원', 'scoreHi']);
    expect(tss[6]).toEqual(['timeseriessplit', 'note']);
    expect(tss[7]).toEqual(['FOLD 5 / 5', 'statSm']);
    expect(head(all[3])[7]).toEqual(['FOLD 3 / 5', 'statSm']);
  });
  it('좁은 판: 지난 줄은 MAE를 뺀다(이름·R²만)', () => {
    const L = splitLayout(data, { w: 358, h: 354 }, 2, 4, S);
    const t = L.labels.slice(0, 6).map((l) => (l.type === 'text' ? l.text : ''));
    expect(t).toEqual(['K-FOLD · R² 0.6', '', 'GROUPKFOLD · R² 0.6', '', '▶ TIMESERIESSPLIT · R² 0.6', 'MAE 1원']);
  });
```

'좁은 판: 세로축 이름이 수치 줄(설명·FOLD)과 범례 사이에 따로 있다' 테스트는 그대로 둔다(꼬리표 `note`와 범례·축 이름 간격 검사).

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/unit/charts-split.test.ts`
Expected: FAIL — 첫 이름표가 `K-FOLD`(옛 구조)

- [ ] **Step 3: 타입에 cls 더하기**

`src/charts/types.ts` `ChartLabel`의 첫 줄 주석에 "score·scoreHi·scorePast: ⑤ 검증 점수판 줄(지금·강조·지난, 정보 전달 2)"을 더하고 cls 목록 끝에 `| 'score' | 'scoreHi' | 'scorePast'`을 더한다:

```ts
      cls: 'tick' | 'axis' | 'month' | 'holiday' | 'feature' | 'head' | 'stat' | 'statSm' | 'rule' | 'ruleOn' | 'note' | 'keyDot' | 'keyAmber' | 'keyDim'
        | 'score' | 'scoreHi' | 'scorePast' }
```

- [ ] **Step 4: `split.ts` 점수판**

파일 맨 위 주석 셋째 줄 뒤에 "판 위 수치는 방식마다 한 줄씩 쌓이는 점수판(정보 전달 2 §5) — 지난 줄은 흐리게, 마지막 TSS 줄만 호박색·크게"를 더한다. 66–73행(`// 이름표: 수치 5개를…`부터 `FOLD` 줄까지)을 바꾼다:

```ts
  // 점수판(정보 전달 2 §5): 줄 3개 × (이름·R², MAE) + 꼬리표 + 폴드 = 앞 8개. 아직 안 나온 줄도 빈 글자로 자리를 둔다 —
  // 그림 판이 이름표를 번호로 그려, 같은 번호의 플립이 단계 사이에 이어지고 지난 줄은 글자가 그대로라 다시 플립하지 않는다.
  // 넓은 판은 줄마다 두 줄(이름·R² / MAE), 좁은 판은 한 줄(지금 줄만 MAE를 오른쪽에)
  const labels: ChartLabel[] = [];
  const sx = wide ? W * 0.78 : gx0, sy = wide ? H * 0.1 : H * 0.04;
  const rowH = wide ? 50 : 18, maeDy = wide ? 20 : 0, maeX = wide ? sx : sx + W * 0.5;
  const hiDy = wide ? 8 : 0; // 강조 줄은 글자가 커서 MAE를 조금 더 내린다
  s.methods.forEach((m, i) => {
    const shown = i <= st, now = i === st, hi = now && st === 2;
    const cls = !shown || now ? (hi ? 'scoreHi' : 'score') : 'scorePast';
    const y = sy + i * rowH;
    labels.push({ type: 'text', x: sx / W, y: y / H, text: shown ? `${hi ? '▶ ' : ''}${m.name} · ${m.r2}` : '', align: 'start', cls });
    // 좁은 판의 지난 줄은 MAE를 뺀다 — 세 줄이 판 위 공간(판 높이의 34%)에 들어가야 한다
    const mae = shown && (wide || now) ? m.mae : '';
    labels.push({ type: 'text', x: maeX / W, y: (y + maeDy + (hi ? hiDy : 0)) / H, text: mae, align: 'start', cls });
  });
  const tagY = sy + (st + 1) * rowH + (wide ? 4 : 0);
  labels.push({ type: 'text', x: sx / W, y: tagY / H, text: s.methods[st].tag, align: 'start', cls: 'note' });
  labels.push({ type: 'text', x: (wide ? sx : sx + W * 0.5) / W, y: (wide ? tagY + 22 : tagY) / H, text: st === 2 ? `FOLD ${sb + 1} / ${SPLIT.subs[2]}` : '', align: 'start', cls: 'statSm' });
```

범례 위치 `const ky = wide ? H * 0.72 : top - 30;`는 그대로 둔다 — 넓은 판에서 TSS 단계 꼬리표·폴드는 `0.1H + 3×50 + 4 + 22 ≈ 0.1H + 176px`(414px 판에서 약 217px)라 범례(0.72H ≈ 298px)와 떨어져 있다. 좁은 판에서 꼬리표는 `0.04H + 54px ≈ 68px`, 범례는 `0.34H − 30 ≈ 90px`.

- [ ] **Step 5: 점수판도 플립**

`ChartStage.tsx` 389행:

```tsx
            // 판 위 수치(stat·statSm)와 ⑤ 점수판 줄은 글자가 바뀌면 플립 — 지난 줄은 글자가 같아 다시 플립하지 않고 색만 바뀐다
            if (l.cls === 'stat' || l.cls === 'statSm' || l.cls.startsWith('score')) return <FlipLabel key={i} text={l.text} className={cls} style={style} />;
```

- [ ] **Step 6: CSS**

`globals.css` 562행(`.chart-label.statSm`) 아래:

```css
/* ⑤ 점수판(정보 전달 2 §5): 지금 줄 = statSm 크기, TSS 줄 = 호박색 약 1.4배, 지난 줄 = 흐리게. 흐린 줄도 대비 4.5:1 —
   알파 0.45로는 어두운 판 위에서 모자랄 수 있어 0.55(설계 §9) */
.chart-label:is(.score, .scorePast) { font: 500 13px var(--font-mono); color: var(--tx); letter-spacing: 0.04em; }
.chart-label.scorePast { opacity: 0.55; }
.chart-label.scoreHi { font: 600 18px var(--font-mono); color: var(--amb); letter-spacing: 0.02em; }
```

564행 `white-space: normal` 목록에 넣는다: `.chart-label:is(.stat, .statSm, .rule, .ruleOn, .note, .score, .scoreHi, .scorePast) { white-space: normal; }`

좁은 판 미디어 쿼리(622–624행 근처) 안에 더한다:

```css
  .chart-label:is(.score, .scorePast) { font-size: 10px; }
  .chart-label.scoreHi { font-size: 13px; }
```

- [ ] **Step 7: `Charts.tsx` — TSS 이름, EVALUATION 머리표 없앰**

`Common` 타입의 `tag`를 선택으로:

```ts
// paras = content의 charts.<id>.body1..N 개수. tag는 플립 글자판 머리표(세 언어 공통). 없으면 머리표 없음 —
// ⑤ 검증 설계 판은 번호 차트가 아니고 섹션 머리표(05 — VALIDATION)와 겹쳐 빼었다(정보 전달 2 §5)
type Common = { id: string; tag?: string; code: CodeChapter; paras: number };
```

`VALIDATION_BLOCKS`의 검증 블록(주석 두 줄 포함)을 바꾼다:

```ts
  // 세 평가 방식이 데이터를 나누는 점 그림(계획 8-1) — TSS 칸은 폴드가 저절로 넘어간다. 판 위 수치는 점수판(정보 전달 2 §5)
  { kind: 'stage', id: 'validation', chart: 'chartSplit', code: 'validation', paras: 3, axis: true,
    stages: SPLIT.stages, subs: SPLIT.subs, subMs: SPLIT.subMs },
```

판 블록 렌더의 머리표 줄:

```tsx
            {b.tag && <p className="eyebrow" data-flip-on-enter>{b.tag}</p>}
```

`splitStrings.methods`의 셋째를 `method('TSS', facts.model.tss, t('charts.validation.tagTss'))`로 바꾸고 위 주석에 "판 위 이름은 옆 칸 폭 때문에 TSS(표·낭독 문단은 전체 이름)"를 덧붙인다. `kind: 'card'` 렌더의 머리표는 `tag`가 늘 있지만 타입이 선택이 되었으므로 같은 `{b.tag && …}`로 바꾼다.

- [ ] **Step 8: 표 caption 숨김**

`ValidationTable.tsx`:

```tsx
      {/* caption은 낭독용으로만 — 표가 점수판 판 바로 뒤라 화면에서는 제목 없이 읽힌다(정보 전달 2 §5) */}
      <caption className="sr-only">{t('charts.validation.table.caption')}</caption>
```

파일 맨 위 주석의 "평가 방식(EVALUATION) 블록"을 "검증 설계 판 뒤 표 카드"로 고친다.

- [ ] **Step 9: 통과 확인**

Run: `npm run typecheck && npx vitest run tests/unit/charts-split.test.ts tests/unit/charts-draw.test.ts`
Expected: PASS

- [ ] **Step 10: 커밋**

```bash
git add src/charts/split.ts src/charts/types.ts src/components/charts/ChartStage.tsx src/styles/globals.css \
  src/components/sections/Charts.tsx src/components/sections/ValidationTable.tsx tests/unit/charts-split.test.ts
git commit -m "feat: ⑤ 검증 설계 판 수치를 쌓이는 점수판으로, EVALUATION 머리표·표 제목 정리

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: 차트 3 아령 배치 `bubbleLayout`

**Files:**
- Create: `src/charts/bubble.ts`
- Modify: `src/charts/types.ts`(`keyRing` cls)
- Modify: `src/styles/globals.css:572-575`
- Test: `tests/unit/charts-bubble.test.ts`(새 파일)

- [ ] **Step 1: 실패하는 테스트**

`tests/unit/charts-bubble.test.ts`:

```ts
// ⑤ 차트 3 아령 배치(정보 전달 2 §6): 단계마다 보이는 쌍 수, 후 별은 호박, 전 점은 덧그림의 속 빈 점, 차이 값, 점 수 불변, 판 안
import { describe, expect, it } from 'vitest';
import { BUBBLE, bubbleLayout, type BubbleTexts } from '@/charts/bubble';
import { TONE } from '@/charts/types';

const S: BubbleTexts = {
  rows: [
    { name: '첫 정정', note: '하네다 고가 행', before: 0.93, after: 0.71 },
    { name: '둘째 정정', note: '경유 9,387행', before: 0.84, after: 0.64 },
  ],
  legendBefore: '걸러내기 전', legendAfter: '걸러낸 뒤', maeSame: '거의 그대로', maeChange: '48,442 → 48,235원',
  r2: (v) => v.toFixed(2), tick: (v) => v.toFixed(1), diff: (v) => `−${v.toFixed(2)}`,
};
const wide = { w: 1080, h: 414 }, narrow = { w: 358, h: 354 };
const at = (st: number, size = wide) => bubbleLayout(size, st, S);
const cores = (L: ReturnType<typeof at>) => Array.from({ length: L.n }, (_, i) => i).filter((i) => L.tone[i] === TONE.amber && L.alpha[i] === 1);

describe('bubbleLayout', () => {
  it('단계마다 보이는 쌍 수 1 · 2 · 2(선 개수, 호박 별 심)', () => {
    expect([0, 1, 2].map((s) => at(s).lines?.length)).toEqual([1, 2, 2]);
    expect([0, 1, 2].map((s) => cores(at(s)).length)).toEqual([1, 2, 2]);
  });
  it('단계 사이 점 개수가 같고(3D 슬롯 전환) variant는 단계', () => {
    expect(new Set([0, 1, 2].map((s) => at(s).n)).size).toBe(1);
    expect([0, 1, 2].map((s) => at(s).variant)).toEqual(['stage:0', 'stage:1', 'stage:2']);
  });
  it('후 별은 전 점보다 왼쪽(R²가 내려갔다), 선은 전 → 후', () => {
    const L = at(1);
    const [c0, c1] = cores(L);
    const hollow = L.overlay!(-1).filter((o) => o.type === 'dot' && o.hollow);
    const line0 = L.lines![0].pts;
    expect(L.x[c0]).toBeCloseTo(line0[2], 6);
    expect(line0[0]).toBeGreaterThan(line0[2]);
    expect(hollow.some((o) => o.type === 'dot' && Math.abs(o.x - line0[0]) < 1e-6)).toBe(true);
    expect(L.y[c1]).toBeGreaterThan(L.y[c0]); // 둘째 정정은 아래 줄
  });
  it('전 점은 덧그림의 속 빈 점 — 단계 2에서 흐려진다', () => {
    const before = (st: number) => at(st).overlay!(-1).filter((o) => o.type === 'dot' && o.hollow).map((o) => (o as { alpha: number }).alpha);
    expect(before(0)).toEqual([BUBBLE.beforeA]);
    expect(before(2).slice(0, 2)).toEqual([BUBBLE.pastA, BUBBLE.pastA]);
  });
  it('차이 값은 결론 이름표(callout) 설명 줄: −0.22 · −0.20', () => {
    const notes = (st: number) => at(st).labels.filter((l) => l.type === 'callout').map((l) => (l as { value: string; note: string }));
    expect(notes(0)).toEqual([{ type: 'callout', x: expect.any(Number), y: expect.any(Number), value: '0.71', note: '−0.22', tone: 'amber', place: 'above' }]);
    expect(notes(1).map((n) => n.note)).toEqual(['−0.22', '−0.20']);
  });
  it('MAE 칸: 둘째 정정 값은 단계 1부터', () => {
    const has = (st: number) => at(st).labels.some((l) => l.type === 'text' && l.text.includes('48,442'));
    expect([0, 1, 2].map(has)).toEqual([false, true, true]);
  });
  it('넓은 판·좁은 판 모두 점·이름표가 판 안', () => {
    for (const size of [wide, narrow]) for (const st of [0, 1, 2]) {
      const L = at(st, size);
      for (let i = 0; i < L.n; i++) {
        expect(L.x[i]).toBeGreaterThanOrEqual(0); expect(L.x[i]).toBeLessThanOrEqual(1);
        expect(L.y[i]).toBeGreaterThanOrEqual(0); expect(L.y[i]).toBeLessThanOrEqual(1);
      }
      for (const l of L.labels) {
        expect(l.x).toBeGreaterThanOrEqual(0); expect(l.x).toBeLessThanOrEqual(1);
        expect(l.y).toBeGreaterThanOrEqual(0); expect(l.y).toBeLessThanOrEqual(1);
      }
    }
  });
  it('범례: 속 빈 점(keyRing)과 호박 별(keyAmber)', () => {
    const cls = at(0).labels.filter((l) => l.type === 'text' && l.cls.startsWith('key')).map((l) => (l as { cls: string }).cls);
    expect(cls).toEqual(['keyRing', 'keyAmber']);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/unit/charts-bubble.test.ts`
Expected: FAIL — `Cannot find module '@/charts/bubble'`

- [ ] **Step 3: `keyRing` cls**

`src/charts/types.ts` `ChartLabel` cls 목록에 `| 'keyRing'`을 더하고 주석 "keyDot·keyAmber·keyDim: 범례(앞에 그 색 점)" 뒤에 "· keyRing: 속 빈 점 범례(⑤ 아령 '걸러내기 전')"를 붙인다.

`globals.css` 575행(`.chart-label.keyDim::before`) 아래:

```css
/* ⑤ 아령(정보 전달 2 §6): "걸러내기 전" 범례는 속 빈 점 — 색이 아니라 모양으로 전·후를 가른다 */
.chart-label.keyRing:not(:empty)::before { content: '○'; margin-right: 6px; color: var(--tx); }
```

- [ ] **Step 4: `src/charts/bubble.ts`**

```ts
// ⑤ 차트 3 "R² 거품" 아령 판(정보 전달 2 §6, 시안 docs/superpowers/mockups/2026-10-05/bubble-dumbbell.html 왼쪽 A).
// 가로 R² 축 하나에 정정 두 번의 전·후를 잇는다: 전 = 속 빈 점(SVG 덧그림), 후 = 호박 별(결론 층 점 + 빛 번짐), 사이에 가는 별자리 선과
// 차이(−0.22). 오른쪽 작은 칸(좁은 판은 축 아래)은 MAE가 거의 그대로였음을 보인다 — R²만 떨어지고 오차는 그대로라는 것이 이 차트의 결론.
// 단계(자막 칸): 0 첫 정정 → 1 둘째 정정 + MAE 값 → 2 둘 다, 전 점은 흐리게. 점 개수·순서는 단계와 무관하다(3D 슬롯 전환).
// 데이터 파일이 필요 없다 — 값은 facts(model.bubble)에서 서버가 넘긴다.
import { Pts, type PlotSize } from './layouts';
import { LINE, STAR } from './lines';
import { CHART_FOCUS_DIM, TONE, type ChartLabel, type ChartLayout, type ChartLine, type OverlayShape } from './types';

// lo·hi: R² 축 범위, ticks: 세로 점선 눈금(배경 층 — 3D에서 배경 점이 모일 자리), gridStepPx: 점선 점 간격.
// starD: 후 별 지름, ringR: 전 점 반지름(px), beforeA: 전 점 알파, pastA: 단계 2(결론)에서 흐린 전 점 알파
export const BUBBLE = {
  stages: 3, wideMinPx: 560, lo: 0.5, hi: 1.0, ticks: [0.6, 0.7, 0.8, 0.9], gridStepPx: 7, gridA: 0.2,
  starD: 9, ringR: 7, beforeA: 0.8, pastA: 0.35,
} as const;

export type BubbleRow = { name: string; note: string; before: number; after: number };
// 서버가 넘기는 값(숫자·글자만 — 함수는 서버 → 클라이언트로 못 넘긴다)
export type BubbleInput = {
  rows: readonly [BubbleRow, BubbleRow]; // 첫 정정, 둘째 정정
  legendBefore: string; legendAfter: string;
  maeSame: string;   // "거의 그대로"
  maeChange: string; // "48,442 → 48,235원"(서버가 facts로 만든다)
};
// build.ts가 언어별 형식 함수를 더한 것
export type BubbleTexts = BubbleInput & { r2(v: number): string; tick(v: number): string; diff(v: number): string };

export function bubbleLayout(size: PlotSize, stage: number, s: BubbleTexts): ChartLayout {
  const st = Math.max(0, Math.min(BUBBLE.stages - 1, Math.floor(stage)));
  const W = size.w, H = size.h, wide = W >= BUBBLE.wideMinPx;
  // 넓은 판: 왼쪽 20% 줄 이름, 가운데 축, 오른쪽 칸(0.8W~) MAE. 좁은 판: 줄 이름은 줄 위, MAE는 축 아래
  const gx0 = wide ? W * 0.2 : W * 0.06, gx1 = wide ? W * 0.74 : W - 16;
  const top = H * (wide ? 0.18 : 0.12), bottom = H * (wide ? 0.82 : 0.64);
  const X = (v: number) => gx0 + (gx1 - gx0) * ((v - BUBBLE.lo) / (BUBBLE.hi - BUBBLE.lo));
  const rowY = wide ? [H * 0.38, H * 0.64] : [H * 0.3, H * 0.52];
  const shown = (i: number) => i === 0 || st >= 1;
  const p = new Pts();

  // 배경 층: 눈금마다 세로 점선. 개수는 판 크기만의 함수 — 단계와 무관
  for (const v of BUBBLE.ticks) for (let y = top; y <= bottom; y += BUBBLE.gridStepPx) p.add(X(v) / W, y / H, 1.2, BUBBLE.gridA, TONE.dot);

  // 결론 층: 후 별(빛 번짐 + 심). 아직 안 나온 줄은 번짐까지 알파 0 — addStar는 번짐 알파가 고정이라 직접 넣는다
  const star = (x: number, y: number, tone: number, on: boolean) => {
    p.add(x / W, y / H, BUBBLE.starD * STAR.haloScale, on ? STAR.haloAlpha : 0, tone);
    p.add(x / W, y / H, BUBBLE.starD, on ? 1 : 0, tone);
  };
  s.rows.forEach((r, i) => star(X(r.after), rowY[i], TONE.amber, shown(i)));
  // MAE 칸(넓은 판): 둘째 정정의 전·후가 거의 겹친다 — 후는 파랑 별(R² 별과 색으로도 구분), 전은 덧그림의 속 빈 점
  const maeX = W * 0.86;
  if (wide) star(maeX + 3, rowY[1], TONE.dot, st >= 1);

  // 별자리 선: 전 → 후. 덧그림: 전 = 속 빈 점(단계 2에서 흐리게), MAE 칸의 전 점
  const lines: ChartLine[] = [];
  const shapes: OverlayShape[] = [];
  s.rows.forEach((r, i) => {
    if (!shown(i)) return;
    const y = rowY[i] / H;
    lines.push({ pts: [X(r.before) / W, y, X(r.after) / W, y], tone: TONE.text, alpha: LINE.alpha, width: LINE.width });
    shapes.push({ type: 'dot', x: X(r.before) / W, y, r: BUBBLE.ringR, tone: TONE.text, alpha: st === 2 ? BUBBLE.pastA : BUBBLE.beforeA, hollow: true });
  });
  if (wide && st >= 1) shapes.push({ type: 'dot', x: maeX / W, y: rowY[1] / H, r: BUBBLE.ringR, tone: TONE.text, alpha: BUBBLE.beforeA, hollow: true });

  const labels: ChartLabel[] = [];
  // 범례(맨 위): 속 빈 점 = 걸러내기 전, 호박 별 = 걸러낸 뒤
  const ly = H * (wide ? 0.07 : 0.04);
  labels.push({ type: 'text', x: gx0 / W, y: ly / H, text: s.legendBefore, align: 'start', cls: 'keyRing' });
  labels.push({ type: 'text', x: (gx0 + (wide ? 130 : 110)) / W, y: ly / H, text: s.legendAfter, align: 'start', cls: 'keyAmber' });
  s.rows.forEach((r, i) => {
    if (!shown(i)) return;
    const y = rowY[i];
    if (wide) {
      labels.push({ type: 'text', x: (W * 0.02) / W, y: (y - 9) / H, text: r.name, align: 'start', cls: 'head' });
      labels.push({ type: 'text', x: (W * 0.02) / W, y: (y + 11) / H, text: r.note, align: 'start', cls: 'tick' });
    } else {
      labels.push({ type: 'text', x: gx0 / W, y: (y - 34) / H, text: `${r.name} · ${r.note}`, align: 'start', cls: 'head' });
    }
    // 전 값은 작게 점 위, 후 값은 결론 이름표(큰 호박 숫자 + 차이)
    labels.push({ type: 'text', x: X(r.before) / W, y: (y - 20) / H, text: s.r2(r.before), align: 'center', cls: 'tick' });
    labels.push({ type: 'callout', x: X(r.after) / W, y: (y - 10) / H, value: s.r2(r.after), note: s.diff(r.before - r.after), tone: 'amber', place: 'above' });
  });
  // 축 눈금과 이름
  for (const v of BUBBLE.ticks) labels.push({ type: 'text', x: X(v) / W, y: (bottom + 14) / H, text: s.tick(v), align: 'center', cls: 'tick' });
  labels.push({ type: 'text', x: gx1 / W, y: (bottom + 32) / H, text: 'R²', align: 'end', cls: 'axis' });
  // MAE 칸
  if (wide) {
    const mx = W * 0.8;
    labels.push({ type: 'text', x: mx / W, y: (rowY[0] - 40) / H, text: 'MAE', align: 'start', cls: 'axis' });
    labels.push({ type: 'text', x: mx / W, y: rowY[0] / H, text: s.maeSame, align: 'start', cls: 'tick' });
    if (st >= 1) {
      labels.push({ type: 'text', x: mx / W, y: (rowY[1] + 24) / H, text: s.maeChange, align: 'start', cls: 'head' });
      labels.push({ type: 'text', x: mx / W, y: (rowY[1] + 42) / H, text: s.maeSame, align: 'start', cls: 'tick' });
    }
  } else {
    labels.push({ type: 'text', x: gx0 / W, y: (H * 0.78) / H, text: 'MAE', align: 'start', cls: 'axis' });
    labels.push({ type: 'text', x: gx0 / W, y: (H * 0.85) / H, text: `${s.rows[0].name} · ${s.maeSame}`, align: 'start', cls: 'tick' });
    if (st >= 1) labels.push({ type: 'text', x: gx0 / W, y: (H * 0.92) / H, text: `${s.rows[1].name} · ${s.maeChange} · ${s.maeSame}`, align: 'start', cls: 'tick' });
  }
  return { ...p.done(labels, TONE.text, CHART_FOCUS_DIM), variant: `stage:${st}`, lines, overlay: () => shapes };
}
```

- [ ] **Step 5: 통과 확인**

Run: `npm run typecheck && npx vitest run tests/unit/charts-bubble.test.ts`
Expected: PASS. 콜아웃 테스트의 `expect.any(Number)` 객체 비교가 `toEqual`로 실패하면(속성 순서와 무관하므로 실패하지 않아야 한다) `toMatchObject({ value: '0.71', note: '−0.22' })`로 바꾼다.

- [ ] **Step 6: 커밋**

```bash
git add src/charts/bubble.ts src/charts/types.ts src/styles/globals.css tests/unit/charts-bubble.test.ts
git commit -m "feat: ⑤ 차트 3 R² 전·후 아령 배치(bubbleLayout)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: 차트 3 판 연결 + 3D `bubble` 장면 정리

**Files:**
- Modify: `src/charts/types.ts:6`(`ChartKey`), `src/charts/build.ts`
- Modify: `src/components/sections/Charts.tsx`
- Modify: `src/three/scenes.ts:6-7, 86-87, 111-116, 146`
- Modify: `src/three/figureKeys.ts`, `src/three/TerrainScene.tsx:74`, `scripts/capture-fallbacks.mjs:9`
- Delete: `public/fallback/bubble.webp`
- Modify: `content/{ko,en,ja}.json`(`charts.bubble.*` 새 키, `figure.bubble` 삭제)
- Test: `tests/unit/three-scenes.test.ts`, `tests/unit/three-capability.test.ts`, `tests/unit/charts-content.test.ts`, `tests/unit/charts-draw.test.ts`

- [ ] **Step 1: 실패하는 테스트**

`tests/unit/three-scenes.test.ts`:
- 1행 주석 "bubble만 제거 레이어·떨어짐" → "제거 레이어·떨어짐을 쓰는 장면 없음(정보 전달 2에서 차트 3이 판으로)"
- `KEYS`의 `'bubble'` → `'chartBubble'`, `CHARTS`에 `'chartBubble'` 더하기
- '제거 레이어는 bubble에서만' 테스트를

```ts
  it('제거 레이어를 켜는 장면은 없다(차트 3이 판이 되어, 정보 전달 2)', () => {
    for (const k of KEYS) expect(SCENES[k].removed, k).toBe(0);
  });
```

- 차트 장면 테스트 이름 "일곱 개" → "여덟 개(… ⑤ 차트 3 포함)"
- 'bubble은 진행도로 drop이 0→1' 테스트를

```ts
  it('drop은 모든 장면에서 0', () => {
    for (const k of KEYS) for (const p of [0, 0.5, 1]) expect(sceneFor(k, p, false).drop, k).toBe(0);
  });
```

  (hero는 `sceneFor`가 따로 처리하지만 `drop: 0`을 돌려준다)
- `TEXT_SIDE`에서 `'bubble'` 삭제
- 158행 `expect(blendScenes(a, SCENES.bubble, 0.25).removed)…` →

```ts
    expect(blendScenes(a, { ...SCENES.limits, removed: 1 }, 0.25).removed).toBeCloseTo(0.25, 9);
```

`tests/unit/three-capability.test.ts` `parseCapture`:

```ts
  it('대체 이미지가 있는 두 장면만 받는다(차트 3은 판이 되어 대체 이미지 없음)', () => {
    for (const k of ['hero', 'problem']) expect(parseCapture(`?capture=${k}`)).toBe(k);
    expect(parseCapture('?capture=bubble')).toBeNull();
  });
```

`tests/unit/charts-content.test.ts` 'depart·curve·band' 테스트의 목록에 `'bubble'`을 더하고 이름을 "(depart·curve·bubble·band)"로.

`tests/unit/charts-draw.test.ts` `describe('buildLayout'` 안 끝에:

```ts
  // 정보 전달 2 §6: 차트 3 아령 판은 데이터 파일 없이 facts 값만으로 그린다
  it('chartBubble: 데이터 없이 단계 배치, 형식은 언어별(소수 둘째 자리, 차이 앞 −)', async () => {
    expect(await loadFor('chartBubble', facts.dataVersion)).toEqual({});
    const bubble = {
      rows: [{ name: 'A', note: 'a', before: 0.93, after: 0.71 }, { name: 'B', note: 'b', before: 0.84, after: 0.64 }] as const,
      legendBefore: 'before', legendAfter: 'after', maeSame: 'same', maeChange: '48,442 → 48,235',
    };
    const L = buildLayout('chartBubble', {}, { w: 1080, h: 414 }, { locale: 'en', holidays: {}, bubble }, -1, 1);
    expect(L.variant).toBe('stage:1');
    const callouts = L.labels.filter((l) => l.type === 'callout') as { value: string; note: string }[];
    expect(callouts.map((c) => [c.value, c.note])).toEqual([['0.71', '−0.22'], ['0.64', '−0.20']]);
  });
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/unit/three-scenes.test.ts tests/unit/three-capability.test.ts tests/unit/charts-content.test.ts tests/unit/charts-draw.test.ts`
Expected: FAIL(여러 개) — `chartBubble` 키 없음, `bubble` 장면 있음, `charts.bubble.alt` 없음

- [ ] **Step 3: 차트 키·배치 연결**

`src/charts/types.ts` 6행:

```ts
// chartModel: ③ 모델 구조 점(계획 7-2), chartFilter: ② 걸러내기·chartSplit: ⑤ 검증 설계(계획 8-1), chartBubble: ⑤ 차트 3 R² 아령(정보 전달 2)
export type ChartKey = 'features' | 'chartModel' | 'chartDepart' | 'chartCurve' | 'chartCloud' | 'chartFilter' | 'chartSplit' | 'chartBubble';
```

`src/charts/build.ts`:
- import: `import { bubbleLayout, type BubbleInput } from './bubble';`
- `ChartStrings` 끝에 `bubble?: BubbleInput; // ⑤ 차트 3 아령(정보 전달 2) — 숫자·글자만, 형식 함수는 여기서 만든다`
- `loadFor` 첫 줄에:

```ts
  // ⑤ 차트 3 아령은 facts 값만 쓴다(서버가 strings로 넘김) — 받을 데이터가 없다
  if (key === 'chartBubble') return {};
```

- `switch` 끝에:

```ts
    case 'chartBubble': {
      // R²는 소수 둘째 자리 고정(0.20이 0.2로 줄지 않게), 눈금은 첫째 자리. 차이 앞 부호는 다른 차트와 같은 −(U+2212)
      const f2 = new Intl.NumberFormat(s.locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const f1 = new Intl.NumberFormat(s.locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
      const empty = { name: '', note: '', before: 0.5, after: 0.5 };
      return bubbleLayout(size, step, {
        rows: [empty, empty], legendBefore: '', legendAfter: '', maeSame: '', maeChange: '', ...s.bubble,
        r2: (v) => f2.format(v), tick: (v) => f1.format(v), diff: (v) => `−${f2.format(Math.round(v * 100) / 100)}`,
      });
    }
```

- [ ] **Step 4: 문구 — 새 키와 `figure.bubble` 삭제**

```bash
python3 - <<'EOF'
import json
# ⑤ 차트 3 아령 판 문구(정보 전달 2 §6). 숫자는 모두 facts 자리 표시. figure.bubble(3D 대체 이미지 설명)은 이미지가 없어져 지운다
B = {
  "ko": {"row1": "첫 정정", "row1Note": "하네다 고가 행 매칭 오류", "row2": "둘째 정정", "row2Note": "직항으로 표시된 경유 {data.removedImplausible}행",
         "legendBefore": "걸러내기 전", "legendAfter": "걸러낸 뒤", "maeSame": "거의 그대로",
         "alt": "R² 전후를 가로축에 놓은 아령 그림입니다. 첫 정정에서 R²는 {model.bubble.firstR2}에서 {model.bubble.firstR2After}로, 둘째 정정에서 {model.bubble.r2Before}에서 {model.bubble.r2After}로 내려갔고, MAE는 두 번 모두 거의 그대로였습니다(둘째 정정 {model.bubble.maeBefore}원 → {model.bubble.maeAfter}원)."},
  "en": {"row1": "First fix", "row1Note": "Mismatched high fares on Haneda", "row2": "Second fix", "row2Note": "{data.removedImplausible} connecting rows labeled nonstop",
         "legendBefore": "before filtering", "legendAfter": "after", "maeSame": "barely changed",
         "alt": "A dumbbell chart with R² on the horizontal axis. The first fix took R² from {model.bubble.firstR2} to {model.bubble.firstR2After}, the second from {model.bubble.r2Before} to {model.bubble.r2After}, while MAE barely changed both times (second fix: ₩{model.bubble.maeBefore} → ₩{model.bubble.maeAfter})."},
  "ja": {"row1": "初回の修正", "row1Note": "羽田の高額行の誤マッチ", "row2": "二度目の修正", "row2Note": "直行と表示された経由便{data.removedImplausible}行",
         "legendBefore": "除外前", "legendAfter": "除外後", "maeSame": "ほぼ変わらず",
         "alt": "R²の前後を横軸に置いたダンベル図です。初回の修正でR²は{model.bubble.firstR2}から{model.bubble.firstR2After}へ、二度目は{model.bubble.r2Before}から{model.bubble.r2After}へ下がり、MAEはどちらもほぼ変わりませんでした（二度目：{model.bubble.maeBefore}ウォン → {model.bubble.maeAfter}ウォン）。"},
}
for l, add in B.items():
    p = f"content/{l}.json"; d = json.load(open(p, encoding="utf-8"))
    d["charts"]["bubble"].update(add)
    del d["figure"]["bubble"]
    open(p, "w", encoding="utf-8").write(json.dumps(d, ensure_ascii=False, indent=2) + "\n")
EOF
```

ja는 "1回目"처럼 숫자를 쓰면 `content.test.ts`가 막으므로 "初回"·"二度目"으로 썼다.

- [ ] **Step 5: `Charts.tsx` 블록**

`VALIDATION_BLOCKS` 첫 줄을 바꾼다:

```ts
  // 차트 3(정보 전달 2 §6): 3D 장면 카드(제거 레이어가 떨어짐)에서 R² 전·후 아령 판으로 — 축·이름표가 있어 숫자가 읽힌다
  { kind: 'stage', id: 'bubble', tag: 'CHART 03', chart: 'chartBubble', code: 'bubble', paras: 3, stages: 3 },
```

`ChartSection` 안 `splitStrings` 아래에:

```ts
  // ⑤ 차트 3 아령(정보 전달 2 §6): 값은 facts, MAE 변화 글자는 표와 같은 단위 규칙(영어만 띄움)
  const won = (v: number) => `${locale === 'en' ? '₩' : ''}${num(v)}${locale === 'en' ? '' : unit}`;
  const bubbleStrings = {
    bubble: {
      rows: [
        { name: t('charts.bubble.row1'), note: t('charts.bubble.row1Note'), before: facts.model.bubble.firstR2, after: facts.model.bubble.firstR2After },
        { name: t('charts.bubble.row2'), note: t('charts.bubble.row2Note'), before: facts.model.bubble.r2Before, after: facts.model.bubble.r2After },
      ] as const,
      legendBefore: t('charts.bubble.legendBefore'), legendAfter: t('charts.bubble.legendAfter'), maeSame: t('charts.bubble.maeSame'),
      maeChange: `${won(facts.model.bubble.maeBefore)} → ${won(facts.model.bubble.maeAfter)}`,
    },
  };
```

`ChartStage`의 `strings` 안 `...(b.chart === 'chartSplit' ? splitStrings : {}),` 아래:

```tsx
              ...(b.chart === 'chartBubble' ? bubbleStrings : {}),
```

`tip:` 줄의 조건을 `b.chart === 'chartSplit' || b.chart === 'chartBubble' ? undefined : tipOf(b.id)`로(아령 판은 짚을 항목이 없다). 맨 위 파일 주석의 "차트 3(R² 거품)·한계는 글 카드(.chapter)"를 "차트 3(R² 아령, 정보 전달 2)도 그림 판, 한계는 글 카드(.chapter)"로. `Validation` 위 주석(⑤ 머리 장면)의 "첫 블록 장면(bubble)은 … 지형 → 차트 3(지형)" 문장을 "⑤ 머리는 조용한 지형, 첫 블록은 차트 3 아령 판"으로 줄인다. 차트 3이 `figure`를 쓰던 유일한 카드였으므로 `Block` 카드 타입의 `figure?: FigureKey`, 카드 렌더의 `{b.figure && <ChapterFigure … />}` 줄, `import { ChapterFigure, type FigureKey } from './ChapterFigure';`를 지운다(`ChapterFigure` 파일은 ② `problem`이 계속 쓴다).

- [ ] **Step 6: 3D 장면 정리**

`src/three/scenes.ts`:
- `SceneKey`: `| 'bubble'` 삭제, `| 'chartBubble'` 추가
- 86–87행 `bubble: {…}`와 그 주석을

```ts
  // ⑤ 차트 3(정보 전달 2): 점이 R² 아령 판의 눈금 점선·별로 모인다
  chartBubble: { ...base, ...CHART },
```

- `PORTRAIT_OVERRIDE`의 `bubble` 주석 다섯 줄과 `bubble: {…}` 줄 삭제
- 146행 `const drop = key === 'bubble' ? … : 0;` 삭제, 아래 두 `return`의 `drop`을 지운다(`{ ...s, drop }` → `s`, `{ ...s, camera, target, drop }` → `{ ...s, camera, target }`) — 장면 표의 `drop`은 `base`에서 0
- `SceneState`의 `removed`·`drop` 주석 끝에 "— 쓰는 장면 없음(정보 전달 2), 셰이더·지형 데이터 정리는 성능 계획" 덧붙임

`src/three/figureKeys.ts`: `['hero', 'problem', 'bubble']` → `['hero', 'problem']`
`src/three/TerrainScene.tsx` 74행 bubble 주석 줄 삭제
`scripts/capture-fallbacks.mjs` 9행: `const KEYS = ['hero', 'problem'];`

```bash
git rm public/fallback/bubble.webp
```

- [ ] **Step 7: 통과 확인**

Run: `npm run typecheck && npm test`
Expected: PASS(전부). `client-imports.test.ts`가 `bubble.ts`를 초기 청크 밖으로 본다(`build.ts`만 부르므로).

- [ ] **Step 8: 커밋**

```bash
git add src/charts/types.ts src/charts/build.ts src/components/sections/Charts.tsx src/three/scenes.ts src/three/figureKeys.ts \
  src/three/TerrainScene.tsx scripts/capture-fallbacks.mjs content/ko.json content/en.json content/ja.json \
  tests/unit/three-scenes.test.ts tests/unit/three-capability.test.ts tests/unit/charts-content.test.ts tests/unit/charts-draw.test.ts
git commit -m "feat: ⑤ 차트 3을 R² 아령 판(chartBubble)으로, 3D bubble 장면·대체 이미지 정리

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

(`git rm`한 `public/fallback/bubble.webp`는 이미 스테이징돼 같은 커밋에 들어간다.)

---

### Task 7: ③ 모델 구조 2칸 + sub 타이머 문턱

**Files:**
- Modify: `src/charts/model.ts`(`MODEL_BLOCK`, `modelStage`)
- Modify: `src/charts/build.ts`(`chartModel` case)
- Modify: `src/components/sections/Features.tsx`
- Modify: `src/components/charts/ChartStage.tsx:212-216`
- Modify: `content/{ko,en,ja}.json`(`features.structure.tools`)
- Test: `tests/unit/charts-model.test.ts`, `tests/unit/charts-draw.test.ts:117-136`

- [ ] **Step 1: 실패하는 테스트**

`tests/unit/charts-model.test.ts` import에 `MODEL_BLOCK, modelStage`를 더하고 끝에:

```ts
// 정보 전달 2 §7: 자막 2칸 — 1칸 안에서 sub 0(모은 가격) → 1.2초 뒤 sub 1(기준 가격), 2칸 = 잔차
describe('modelStage', () => {
  it('(칸, sub) → 그림 단계', () => {
    expect(modelStage(0, 0)).toBe(0);
    expect(modelStage(0, 1)).toBe(1);
    expect(modelStage(1, 0)).toBe(2);
    expect(modelStage(5, 0)).toBe(2);
  });
  it('블록은 2칸, 첫 칸만 sub 2개(⑤ TSS와 같은 1.2초)', () => {
    expect(MODEL_BLOCK).toEqual({ stages: 2, subs: [2, 1], subMs: 1200 });
  });
});
```

`tests/unit/charts-draw.test.ts`의 'chartModel: step으로 단계 배치…' 테스트 안 반복을 (칸, sub) 기준으로 바꾼다:

```ts
      for (const [step, sub, fig] of [[0, 0, 0], [0, 1, 1], [1, 0, 2], [2, 0, 2]] as const) {
        const L = buildLayout('chartModel', { charts }, size, s, -1, step, sub);
        expect(L.variant).toBe(`stage:${fig}`);
```

같은 반복 안 축 검사는 `expect(axis).toMatchObject({ text: fig === 2 ? 'RES' : 'AX' });`로, 테스트 이름은 "chartModel: (칸, sub)로 단계 배치…"로 바꾼다.

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/unit/charts-model.test.ts tests/unit/charts-draw.test.ts`
Expected: FAIL — `modelStage is not a function`, `stage:1` 기대에 `stage:0`

- [ ] **Step 3: `model.ts`**

`export const MODEL = …` 아래:

```ts
// ③ 블록(정보 전달 2 §7): 자막 2칸. 1칸 = 모은 가격 → subMs 뒤 저절로 기준 가격(⑤ TSS 폴드와 같은 sub 타이머), 2칸 = 잔차.
// 그림 단계(MODEL.stages 3)는 그대로 두고 (칸, sub)를 그림 단계로 바꾼다 — 배치 코드와 3D 슬롯 규칙(variant stage:n)이 그대로다
export const MODEL_BLOCK = { stages: 2, subs: [2, 1], subMs: 1200 } as const;
export const modelStage = (para: number, sub: number) => (para <= 0 ? Math.min(1, Math.max(0, sub)) : 2);
```

맨 위 주석 첫 줄 "자막 칸에 맞춰 세 단계로" → "자막 2칸(첫 칸 안에서 저절로 한 번)에 맞춰 세 단계로".

`src/charts/build.ts` `chartModel` case: import에 `modelStage` 더하고 `modelLayout(loaded.charts!, size, step, {` → `modelLayout(loaded.charts!, size, modelStage(step, sub), {`.

- [ ] **Step 4: 문구 `tools`**

```bash
python3 - <<'EOF'
import json
# ③ 2칸의 마지막 줄(정보 전달 2 §7): body2(Optuna·분위수·SHAP 긴 문단)를 한 줄로. body2 키는 문구 정리 때 결정하려고 남긴다
T = {"ko": "Optuna로 설정을 고르고, 분위수 모델로 구간을, SHAP으로 피처별 기여를 봅니다.",
     "en": "Optuna picks the settings, quantile models give the interval, and SHAP splits out each feature's contribution.",
     "ja": "Optuna で設定を選び、分位点モデルで区間を、SHAP で特徴量ごとの寄与を見ます。"}
for l, v in T.items():
    p = f"content/{l}.json"; d = json.load(open(p, encoding="utf-8"))
    s = d["features"]["structure"]; items = list(s.items()); i = [k for k, _ in items].index("body2") + 1
    d["features"]["structure"] = dict(items[:i] + [("tools", v)] + items[i:])
    open(p, "w", encoding="utf-8").write(json.dumps(d, ensure_ascii=False, indent=2) + "\n")
EOF
```

(문체: 다른 자막 문단이 "~합니다"체라 맞췄다. 설계서 임시값 "~본다"와 다르면 문구 정리 때 한꺼번에.)

- [ ] **Step 5: `Features.tsx`**

import에 `import { MODEL_BLOCK } from '@/charts/model';`. 모델 구조 블록을 바꾼다:

```tsx
      <article className="chart-block" data-scene="chartModel" style={{ '--paras': MODEL_BLOCK.stages } as React.CSSProperties}>
        <ChartStage
          chartKey="chartModel"
          dataVersion={facts.dataVersion}
          stages={MODEL_BLOCK.stages}
          subs={MODEL_BLOCK.subs}
          subMs={MODEL_BLOCK.subMs}
```

자막 칸:

```tsx
          {/* 두 칸(정보 전달 2 §7): 모은 가격 → (저절로) 기준 가격 / 벗어난 몫 + 흐름 줄 + 도구 한 줄. step1·step2 문장은 그대로 이어 붙였다 */}
          <div className="chart-paras">
            <div className="chart-para"><p>{t('features.structure.step1')} {t('features.structure.step2')}</p></div>
            <div className="chart-para">
              <p>{t('features.structure.step3')}</p>
              <p className="muted mono data-tools model-flow">{t('features.structure.flow')}</p>
              <p className="muted">{t('features.structure.tools')}</p>
            </div>
          </div>
```

맨 위 주석 2–3행 "자막 칸이 바뀔 때마다 … 넷째 칸(Optuna·분위수·SHAP)은 셋째 단계 그대로." → "자막 두 칸 — 첫 칸 안에서 모은 가격 → 1.2초 뒤 저절로 NeuralProphet 기준 가격, 둘째 칸에서 기준에서 벗어난 몫(XGBoost)으로 옮겨 간다(src/charts/model.ts modelStage, 정보 전달 2)".

- [ ] **Step 6: sub 타이머 문턱**

`ChartStage.tsx` 212–216행의 `IntersectionObserver` 둘째 인자에 `{ threshold: 0.5 }`를 넣는다:

```ts
    // 판이 절반 이상 보일 때 시작한다 — 조금만 걸쳐도 시작하면 독자가 판에 닿기 전에 sub가 끝나 있다(③·⑤ 두 판이 쓴다, 정보 전달 2 §7)
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) { timer?.stop(); return; }
      if (timer) timer.restart();
      else timer = startSubs({ count, ms: subMs, reduced: false, set, setTimeout: window.setTimeout.bind(window) as typeof setTimeout, clearTimeout: window.clearTimeout.bind(window) });
    }, { threshold: 0.5 });
```

파일 맨 위 주석 12행 "(② 걸러내기·⑤ 검증 설계, 계획 8-1)" → "(② 걸러내기·⑤ 검증 설계·③ 모델 구조)".

주의: ② 걸러내기 판도 sub 타이머를 쓴다(`FILTER.subMs 700`) — 문턱이 같이 적용된다. 판 높이가 화면보다 크지 않아(sticky 판 = 화면 높이 안) 0.5는 판이 고정될 때 늘 넘는다.

- [ ] **Step 7: 통과 확인**

Run: `npm run typecheck && npm test`
Expected: PASS

- [ ] **Step 8: 커밋**

```bash
git add src/charts/model.ts src/charts/build.ts src/components/sections/Features.tsx src/components/charts/ChartStage.tsx \
  content/ko.json content/en.json content/ja.json tests/unit/charts-model.test.ts tests/unit/charts-draw.test.ts
git commit -m "feat: ③ 모델 구조 자막 2칸(첫 칸 안 저절로 기준 가격), sub 타이머 문턱 0.5

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: e2e·눈 확인·문서·PR

**Files:**
- Modify: `tests/e2e/charts.spec.ts`, `tests/e2e/motion.spec.ts:89-96`, `tests/e2e/terrain.spec.ts:172-173`
- Create: `tests/e2e/info-clarity.spec.ts`
- Modify: `docs/superpowers/specs/2026-10-06-info-clarity-2-design.md`("구현 결과"), `CLAUDE.md`("현재 상태"·"다음 할 일"), `.claude/rules/performance.md`(후보 한 줄), `.claude/rules/testing.md`(bubble 대비 줄 삭제)

- [ ] **Step 1: 기존 e2e 고치기**

`tests/e2e/charts.spec.ts`:
- 16행 `STAGES`에 `'chartBubble'` 추가(2D로 그리고 이름표)
- 별자리 선 반복 `[['chartCurve', 1], ['chartCloud', 1], ['chartDepart', 1]]`에 `['chartBubble', 2]` 추가 — 단, 아령 판은 단계 0에서 선 1개다. 움직임 줄이기 상태에서 `center()`로 판 가운데를 화면 가운데에 두면 자막 둘째 칸 근처일 수 있어 개수가 흔들린다 → 아령은 따로:

```ts
  test('chartBubble: 단계마다 선 1 → 2, 속 빈 점(전)과 결론 이름표(후)', async ({ page }) => {
    await page.goto('/');
    const block = page.locator('.chart-block[data-scene="chartBubble"]');
    const into = (f: number) => block.evaluate((el, f) => {
      const r = el.getBoundingClientRect();
      window.scrollTo(0, window.scrollY + r.top + (r.height - window.innerHeight) * f);
    }, f);
    for (const [f, n] of [[0.1, 1], [0.5, 2], [0.9, 2]] as const) {
      await into(f);
      const svg = block.locator('.chart-lines');
      await expect(svg).toHaveAttribute('data-on', '', { timeout: 10_000 });
      await expect(svg.locator('path')).toHaveCount(n);
      // 넓은 판(≥560px)은 둘째 단계부터 MAE 칸 전 점이 하나 더 — e2e는 desktop·mobile 두 프로젝트로 돈다
      const wide = (await block.locator('[data-plot]').boundingBox())!.width >= 560;
      await expect(svg.locator('circle[fill="none"]')).toHaveCount(n === 1 ? 1 : wide ? 3 : 2);
      await expect(block.locator('.chart-callout')).toHaveCount(n);
    }
    await expect(block.locator('[role="slider"]')).toHaveCount(0);
  });
```

- `③ 모델 구조` describe(81–124행): 반복을 2칸 기준으로

```ts
        // 움직임 줄이기라 첫 칸은 바로 마지막 sub(기준 가격) — data-sub 1, 그림 단계 1
        for (const [f, n, para, fig] of [[0.2, '0', 0, 1], [0.8, '1', 1, 2]] as const) {
          await scrollInto(page, f);
          await expect(stage).toHaveAttribute('data-stage', n, { timeout: 10_000 });
          await expect(block.locator('.chart-para').nth(para)).toHaveClass(/is-on/);
          await expect.poll(() => painted(page, 'chartModel'), { timeout: 10_000 }).toBe(true);
          await expect(axis).toHaveText(fig === 2 ? '기준 가격 대비' : '노선·등급 평균 대비');
          await expect(block.locator('.chart-label.head')).toHaveCount(1);
```

  (`plot` 판 안 검사와 가로 스크롤 검사는 그대로.) axe 테스트의 `scrollInto(page, 0.62)`·`data-stage '2'` → `scrollInto(page, 0.8)`·`'1'`.
- 같은 파일 맨 아래(움직임 줄이기 밖)에 저절로 넘김 테스트:

```ts
test.describe('③ 모델 구조 저절로 넘김(정보 전달 2 §7)', () => {
  test.use({ reducedMotion: 'no-preference' });
  test('첫 칸에서 sub 0 → 약 1.2초 뒤 1', async ({ page }) => {
    await page.goto('/');
    const block = page.locator('.chart-block[data-scene="chartModel"]');
    await block.evaluate((el) => { const r = el.getBoundingClientRect(); window.scrollTo(0, window.scrollY + r.top + (r.height - window.innerHeight) * 0.2); });
    const stage = block.locator('.chart-stage');
    await expect(stage).toHaveAttribute('data-stage', '0', { timeout: 10_000 });
    await expect(stage).toHaveAttribute('data-sub', '1', { timeout: 5_000 });
  });
});
```

- `② 걸러내기·⑤ 검증 설계` describe: 걸러내기 테스트 끝에 규칙 개수 확인 —

```ts
        const n = (v: number) => new Intl.NumberFormat('ko').format(v);
        await expect(stage.locator('.chart-label.ruleOn').last()).toContainText(n(facts.data.filter.direct));
```

  (파일 위 `facts` 타입에 `data: { filteredRows: number; filter: { direct: number } }`을 더한다.) 검증 설계 테스트의 `FOLD 5 / 5` 검사 아래에 —

```ts
        await expect(stage.locator('.chart-label.scoreHi').first()).toContainText('TSS');
        // 지난 줄 2개 × 두 칸(좁은 판의 빈 MAE 칸도 cls는 scorePast — 자리 번호를 지키려고 빈 글자로 둔다)
        await expect(stage.locator('.chart-label.scorePast')).toHaveCount(4);
```
- 'en 1024×768·768×1024' 테스트 목록 `['chartFilter', 'chartSplit']`에 `'chartBubble'` 추가, **같은 테스트를 `/ja/`로도** 돈다(바깥 반복에 `for (const path of ['/en/', '/ja/'])`)

`tests/e2e/motion.spec.ts` 92행: `'[data-scene="bubble"] .eyebrow'` → `'.chart-block[data-scene="chartBubble"] .eyebrow'`

`tests/e2e/terrain.spec.ts` 172–173행: 주석을 "LIMITS(limits): 글 뒤 판이 없는 카드형 챕터의 첫 본문 문단(차트 3은 정보 전달 2에서 판이 되어 자막 띠 — 차트 2처럼 재지 않는다)"으로, `['[data-scene="bubble"] > p:not(.eyebrow)', 1],` 줄 삭제.

- [ ] **Step 2: 새 e2e `tests/e2e/info-clarity.spec.ts`**

```ts
// 정보 전달 2(설계 2026-10-06): 결론형 제목의 수치, ① 숫자 4개, 제목이 두 줄을 넘지 않음(3개 언어 × 1024·768·390), EVALUATION 머리표 없음
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

// e2e(ESM)에서는 JSON 정적 import가 실패해 fs로 읽는다(board.spec.ts와 같은 방식)
const facts = JSON.parse(readFileSync(fileURLToPath(new URL('../../data/facts.json', import.meta.url)), 'utf-8')) as {
  data: { rawRows: number; routes: number; filter: { removed: number } };
  model: { interval: { coverage: number }; bubble: { firstR2: number; firstR2After: number }; baselineGap: { mae: number } };
  insight: { holidayPeak: { pct: number } };
};
const n = (v: number, l = 'ko') => new Intl.NumberFormat(l).format(v);

test('ko 제목에 facts 수치가 들어간다', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#data-h')).toContainText(n(facts.data.rawRows));
  await expect(page.locator('#filter-h')).toContainText(n(facts.data.filter.removed));
  await expect(page.locator('#chart-depart')).toContainText(`+${facts.insight.holidayPeak.pct}%`);
  await expect(page.locator('#chart-limits')).toContainText(n(facts.model.baselineGap.mae));
});

test('en·ja 출발일 제목', async ({ page }) => {
  await page.goto('/en/');
  await expect(page.locator('#chart-depart')).toContainText('New Year');
  await page.goto('/ja/');
  await expect(page.locator('#chart-depart')).toContainText('元日');
});

test('① 숫자 4개: 모은 가격 · 구간 포함률 · R² 바로잡음 · 노선', async ({ page }) => {
  await page.goto('/');
  const dd = page.locator('#project .project-stats dd');
  await expect(dd).toHaveText([
    n(facts.data.rawRows), `${n(facts.model.interval.coverage)}%`,
    `${n(facts.model.bubble.firstR2)} → ${n(facts.model.bubble.firstR2After)}`, String(facts.data.routes),
  ]);
});

test('⑤ 검증 설계 판에 EVALUATION 머리표가 없고 표 제목은 낭독용', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.chart-block[data-scene="chartSplit"] .eyebrow')).toHaveCount(0);
  await expect(page.locator('.vtable caption')).toHaveClass(/sr-only/);
});

// 설계 §3: 제목이 두 줄을 넘지 않는다(가장 긴 것: ④ 두 제목 en). 넘으면 문구 쪽을 고친다
for (const path of ['/', '/en/', '/ja/']) {
  for (const [w, h] of [[1024, 768], [768, 1024], [390, 844]] as const) {
    test(`${path} ${w}px: 결론 제목 두 줄 이하, 가로 스크롤 없음`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await page.goto(path);
      const lines = await page.locator('#data-h, #filter-h, #features-h, #waffle-h, .chart-copy h3, .chapter h3').evaluateAll((els) =>
        els.map((e) => {
          const cs = getComputedStyle(e);
          const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2;
          return { id: e.id, text: e.textContent, lines: Math.round(e.getBoundingClientRect().height / lh) };
        }));
      // 큰 글씨(display) 제목(②·③ h2, ③ 와플 h3)은 휴대폰에서 세 줄까지 허용
      for (const l of lines) expect(l.lines, `${l.id} "${l.text}"`).toBeLessThanOrEqual(w <= 390 && /^(data|features|waffle)-h$/.test(l.id) ? 3 : 2);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    });
  }
}
```

- [ ] **Step 3: 빌드·용량·e2e 전부**

부하 확인 후(`uptime`) 한 번에 하나:

Run: `npm run typecheck && npm test && npm run build && npm run size && npx playwright test`
Expected: 모두 PASS. 초기 JS gzip ≤ 150KB. 실패하면 `superpowers:systematic-debugging`으로 원인을 찾는다 — 특히
- 제목 줄 수 검사 실패 → 그 언어 문구를 짧게(콜론 앞뒤 중 덜 중요한 쪽을 줄인다), 설계서 §3 표도 같이 고친다
- 점수판·아령 이름표 가로 넘침 → 배치 상수(`BUBBLE`의 열 위치, `split.ts`의 `rowH`)를 고치고 단위 테스트에 그 크기를 더한다
- 맥미니 로컬 `terrain.spec.ts` 실패가 `bubble` 대비 하나였다면 이번에 사라진다

e2e는 출력이 길어 `test-runner` 에이전트에 맡기거나 CI에 맡겨도 된다(`testing` 규칙).

- [ ] **Step 4: 눈 확인(직접 캡처를 본다)**

`npm run build` 뒤 `npx serve out -l 4173`. Playwright MCP 또는 짧은 스크립트로 데스크톱 1440×900·1024×768, 휴대폰 390×844, 3D 켜짐·꺼짐(`?3d=off` 대신 움직임 줄이기)에서 캡처: ① 숫자, ② 걸러내기 판 단계 2, ③ 모델 구조 1칸(저절로 넘김 전·후)·2칸, ④ 두 제목, ⑤ 아령 단계 0·1·2, 점수판 TSS, 한계 제목. 일본어 820~1024px도 한 번. 이상하면 고친 뒤 다시.

- [ ] **Step 5: 문서**

- 설계서 끝 "구현 결과": 바뀐 파일 묶음, 설계와 달라진 점(위 "설계서 검토 결과" 1~10 중 실제로 그대로 된 것·달라진 것), 미리보기에서 확인받을 것 두 가지(⑤ `EVALUATION` 머리표·표 제목 숨김, 3D `bubble` 장면 연출이 사라짐)
- `.claude/rules/performance.md` 후보 목록에: "제거 레이어(9,387점)·`uRemoved`·`uDrop`·`terrain.json` removed 정리 — 정보 전달 2 뒤로 쓰는 장면 없음"
- `.claude/rules/testing.md`: `terrain.spec.ts` bubble 2.05:1 줄 삭제, "가로 넘침 e2e는 영어만" → "영어·일본어"
- `.claude/rules/content-i18n.md` "문구 검토 대기"에: "정보 전달 2 — 결론형 제목 10개·① 숫자 이름표·`data.filter.rule1/2`·`charts.bubble.row*/legend*/maeSame/alt`·`features.structure.tools`·`tagTss`(영·일 Claude 초안)"
- `CLAUDE.md` "현재 상태"·"다음 할 일" 1번: 정보 전달 2 PR 번호와 남은 확인

```bash
git add tests/e2e/charts.spec.ts tests/e2e/motion.spec.ts tests/e2e/terrain.spec.ts tests/e2e/info-clarity.spec.ts \
  docs/superpowers/specs/2026-10-06-info-clarity-2-design.md .claude/rules/performance.md .claude/rules/testing.md .claude/rules/content-i18n.md CLAUDE.md
git commit -m "test: 정보 전달 2 e2e(제목 수치·줄 수·아령·점수판·③ 2칸), 문서 갱신

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 6: PR**

`ship-pr` 스킬을 따른다: push → PR(본문 끝 `🤖 Generated with [Claude Code](https://claude.com/claude-code)`) → CI → **PR 주소 + Vercel 미리보기 주소 + 어디를 보면 되는지**를 사용자에게 준다:
- ① 숫자 4개(첫 화면 아래)
- ② 걸러내기 판 규칙 이름표·개수, ②·③ h2가 결론 문장이 된 것
- ③ 모델 구조 1칸에서 1.2초 뒤 기준 가격으로 넘어감
- ④ 두 제목
- ⑤ 아령 판(3D `bubble` 장면 연출이 없어진 것 — 확인받기), 점수판, `EVALUATION`·표 제목이 사라진 것(확인받기), 한계 제목
- 세 언어(`/en/`·`/ja/`)
