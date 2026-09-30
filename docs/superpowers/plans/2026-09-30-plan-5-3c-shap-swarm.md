# 계획 5-3c: ③ 와플 → SHAP 벌떼 펼치기 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ③ 와플 그룹을 누르면(또는 초점 후 Enter/Space) 와플 6개가 판 위 작은 줄로 줄고, 남은 판 전체에 그 그룹 피처별 SHAP 벌떼(가로 = 가격을 움직인 %, 색 = 피처 값 순위)가 펼쳐진다. Esc·다시 누르기로 닫는다.

**Architecture:** 파이썬 추출(`export_charts.py`)이 서비스 모델의 XGBoost `pred_contribs`로 피처 33개 × 표본 150개의 SHAP 값을 `charts.json`의 `shap`에 넣는다. 사이트는 새 순수 배치 함수 `shapOpenLayout`(`src/charts/shap.ts`)으로 "작은 와플 줄 + 벌떼" 배치를 만들고, `ChartStage`가 펼침 상태(`open`)에 따라 닫힌 와플/펼친 배치를 다시 만들어 저장소에 올린다. 3D는 배치의 `variant`가 바뀌면 반대 슬롯에 써서 점이 옮겨 가게 하고, 값 색은 색 번호 10~110(`TONE_VAL + 순위`)으로 셰이더·2D 모두 파랑→호박 보간한다.

**Tech Stack:** Python(pandas·xgboost, 항공권 저장소 모델) · Next.js 정적 export · React Three Fiber 셰이더 · Vitest · Playwright(+axe)

**설계:** `docs/superpowers/specs/2026-09-30-shap-swarm-design.md`

## 설계에서 바꾼 점(구현 쉽게, 동작 같음)

- 값 색은 새 배열(`val`) 대신 **색 번호 확장**으로: `tone ≥ 10`이면 값 색(`tone − 10` = 0~100 순위). 3D 속성·2D 인터페이스를 늘리지 않는다.
- 범주형 표시는 줄마다 "범주형" 글자 대신: 범주형 피처는 모두 "노선·항공사" 그룹이라, 그 그룹을 펼치면 색 범례 자리에 "범주형 피처라 값 색은 없습니다" 한 줄. (설계 §3.2 표시 방법만 바뀜 — 설계 문서 "구현 결과"에 적는다)
- `waffleLayout(open)` 대신 별도 함수 `shapOpenLayout` — 닫힌 와플 코드는 그대로 둔다.
- 와플은 닫힌 상태에 데이터가 필요 없으므로 `charts.json`을 못 받아도 와플은 그리고, 누르면 안내만 띄운다.

## 공통 규칙

- **작업 폴더**: git worktree `~/dev/untitled folder/signal-ml-portfolio-5-3c`, 브랜치 `plan-5-3c-shap`. main에 직접 커밋하지 않는다.
- **코드 주석은 한국어**: 새 파일 맨 위 한두 줄, 이유가 드러나지 않는 로직에 "왜". 코드를 한 줄씩 옮겨 적는 주석은 달지 않는다.
- 커밋 메시지 끝에 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. 커밋 이메일은 저장소 설정(noreply) 그대로.
- **문구 규칙**: 숫자 직접 기입 금지(3개 언어 테스트), 세 언어 키 동일, 담백한 톤.
- **동시 작업**: 여러 에이전트가 같은 폴더에서 돌 수 있다. 각 태스크는 자기 "Files" 목록 밖 파일을 건드리지 않고, `git add`는 자기 파일만 경로로 지정한다(`git add -A` 금지). `index.lock` 오류가 나면 몇 초 뒤 다시 시도한다.
- **포트**: e2e는 `out/`을 4173으로 띄운다(`playwright.config.ts`, 로컬은 떠 있는 서버 재사용). e2e 전에 `lsof -ti :4173`이 다른 worktree 서버면 끈다. 눈 확인용 개발 서버는 `npx next dev -p 3072`.
- **3D 눈 확인**: 헤드리스 swiftshader는 3D를 끄므로 헤드 있는 크로미움을 화면 밖에 띄워(`chromium.launch({ headless: false, args: ['--window-position=-2400,0'] })`) 본다. 임시 스크립트는 세션 스크래치 폴더에 두고 커밋하지 않는다.
- 흔들리는 e2e 두 개(`board.spec` "화면에 들어오면 넘어가고…", `terrain.spec` 화소 대비)는 실패하면 따로 한 번 더 돌린다.

## 파일 지도

| 파일 | 할 일 | 태스크 |
|---|---|---|
| `scripts/export_charts.py` · `scripts/tests/test_export_charts.py` | SHAP 표본 블록(순수 함수 + 모델 계산), 피처 대조 | 1, 2 |
| `public/data/charts.2026-09-22.json` | `shap` 추가(다른 키는 그대로) | 2 |
| `src/charts/types.ts` · `src/charts/draw2d.ts` · `tests/unit/charts-draw.test.ts` | 값 색 번호, 새 이름표 종류, `variant`·`summary` | 3 |
| `src/charts/shap.ts`(새) · `tests/unit/charts-shap.test.ts`(새) | `shapRows`·`shapOpenLayout` | 4 |
| `src/charts/data.ts` · `tests/unit/charts-data.test.ts` | 스키마 `shap` | 5 |
| `src/charts/build.ts` · `tests/unit/charts-draw.test.ts` | 와플 데이터 불러오기, `open` 인자, 문구 | 6 |
| `src/three/shaders.ts` · `src/three/TerrainPoints.tsx` · `src/three/chartTargets.ts` · `src/three/TerrainScene.tsx` · `tests/unit/chart-targets.test.ts` | 값 색 셰이더, 배치 바뀌면 반대 슬롯 | 7 |
| `content/{ko,en,ja}.json` | `features.shap.*`, `features.hint` | 8 |
| `src/components/charts/ChartStage.tsx` · `src/components/sections/Features.tsx` · `src/styles/globals.css` | 버튼 층, 펼침 상태, Esc, 숨은 요약, 알림 | 9 |
| `tests/e2e/charts.spec.ts` | 펼치기 e2e, 옛 휴대폰 토글 테스트 교체 | 10 |
| 설계 문서 · `CLAUDE.md` | 구현 결과, 상태 표 | 11 |

**동시에 돌릴 수 있는 묶음**: {1→2}, {3→4→5→6}, {7}, {8}은 서로 파일이 겹치지 않는다. 9는 3·6·8 뒤, 10은 9 뒤, 11은 마지막.

---

### Task 1: SHAP 표본 블록 — 순수 함수(파이썬)

**Files:**
- Modify: `scripts/export_charts.py`
- Test: `scripts/tests/test_export_charts.py`

- [ ] **Step 1: 실패하는 테스트 쓰기** — `scripts/tests/test_export_charts.py` 끝에 더한다(파일 위 import에 `import numpy as np` 추가):

```python
def test_value_rank_spreads_0_to_100_with_ties_averaged():
    assert ec.value_rank(pd.Series([10.0, 30.0, 20.0])) == [0, 100, 50]
    assert ec.value_rank(pd.Series([5.0, 5.0, 9.0])) == [25, 25, 100]
    assert ec.value_rank(pd.Series([7.0])) == [0]


def test_shap_block_scales_contribs_ranks_values_and_fixes_categorical():
    enc = pd.DataFrame({"days": [1.0, 3.0, 2.0], "route": [0.0, 2.0, 1.0]})
    contribs = np.array([[0.1234, -0.05, 9.0], [-0.2, 0.0004, 9.0], [0.0, 0.01, 9.0]])  # 마지막 열 = bias
    b = ec.shap_block(contribs, enc, ["route", "airline"])
    assert b == {
        "n": 3,
        "features": ["days", "route"],
        "categorical": ["route"],
        "v": [[123, -200, 0], [-50, 0, 10]],
        "f": [[0, 100, 50], [50, 50, 50]],
    }


def test_shap_block_rejects_shape_mismatch():
    enc = pd.DataFrame({"a": [1.0, 2.0]})
    with pytest.raises(ValueError):
        ec.shap_block(np.zeros((2, 3)), enc, [])


def test_check_shap_features_matches_fact_groups():
    facts = {"model": {"featureGroups": [{"features": ["a", "b"]}, {"features": ["c"]}]}}
    ec.check_shap_features(["c", "a", "b"], facts)
    with pytest.raises(SystemExit):
        ec.check_shap_features(["a", "b"], facts)
    with pytest.raises(SystemExit):
        ec.check_shap_features(["a", "b", "c", "d"], facts)
```

- [ ] **Step 2: 실패 확인** — `npm run pytest -- -k "shap or value_rank"` → `AttributeError: module 'export_charts' has no attribute 'value_rank'`

- [ ] **Step 3: 구현** — `scripts/export_charts.py`의 상수 블록 아래(`CURVE_TOLERANCE` 다음)에 상수를, `check_curve` 다음에 함수를 더한다. 파일 맨 위 docstring 목록에 한 줄 추가: `- shap: ③ 와플 펼치기(계획 5-3c) — 서비스 모델 XGBoost의 피처별 SHAP(×1000 정수)과 피처 값 순위(0~100), 표본 150개.`

```python
SHAP_SAMPLE = 150             # ③ SHAP 벌떼 표본 수(계획 5-3c) — 피처 33개 × 150점
CATEGORICAL = ["origin", "destination", "route", "airline", "airline_class"]
```

```python
def value_rank(col: pd.Series) -> list[int]:
    """피처 값 → 표본 안 순위 백분위(0~100, 같은 값은 평균 순위). 원값 대신 순위를 내보내
    원본을 공개하지 않고, 치우친 분포도 색이 고르게 퍼지게 한다(설계 2026-09-30 §2)."""
    n = len(col)
    r = (col.rank(method="average") - 1) / max(n - 1, 1) * 100
    return [int(x) for x in r.round().astype(int)]


def shap_block(contribs: np.ndarray, enc: pd.DataFrame, categorical: list[str]) -> dict:
    """pred_contribs 결과(행 = 표본, 열 = 피처 + 마지막 bias)와 인코딩된 입력 → charts.json의 shap.
    SHAP은 log 잔차 단위라 ×1000 정수로 줄인다(사이트가 exp(v/1000)−1로 %를 만든다).
    범주형은 인코딩 번호의 크고 작음에 뜻이 없으므로 순위 대신 50(중간색)으로 둔다."""
    names = list(enc.columns)
    if contribs.shape != (len(enc), len(names) + 1):
        raise ValueError(f"pred_contribs 모양 {contribs.shape} ≠ ({len(enc)}, {len(names) + 1})")
    cat = [c for c in names if c in categorical]
    v = [[int(round(float(x) * 1000)) for x in contribs[:, j]] for j in range(len(names))]
    f = [[50] * len(enc) if c in cat else value_rank(enc[c]) for c in names]
    return {"n": len(enc), "features": names, "categorical": cat, "v": v, "f": f}


def check_shap_features(names: list[str], facts: dict) -> None:
    """모델 입력 피처 = facts.json 와플 그룹 피처의 합집합인지 — 다르면 와플 그룹을 펼칠 때 줄이 빠진다."""
    want = {f for g in facts["model"]["featureGroups"] for f in g["features"]}
    if set(names) != want or len(names) != len(want):
        raise SystemExit(f"SHAP 피처가 facts.json 그룹과 다르다 — 모델에만 {sorted(set(names) - want)}, "
                         f"facts에만 {sorted(want - set(names))}")
```

- [ ] **Step 4: 통과 확인** — `npm run pytest` → 전체 통과(기존 42개 + 4개)
- [ ] **Step 5: 커밋**

```bash
git add scripts/export_charts.py scripts/tests/test_export_charts.py
git commit -m "feat(charts-data): SHAP sample block helpers for the waffle swarm"
```

### Task 2: SHAP 계산을 추출에 연결하고 `charts.json` 다시 만들기

**Files:**
- Modify: `scripts/export_charts.py`
- Modify: `public/data/charts.2026-09-22.json`

- [ ] **Step 1: 항공권 저장소 준비** — `~/Documents/airfare-forecasting-ml/CLAUDE.md`의 "iCloud 동기화 I/O 병목" 절(워밍 절차)을 읽고 그대로 따른다. **그 저장소의 `.venv`는 지우거나 다시 만들지 않는다.** 파이썬은 `scripts/py.sh`가 고른다(`~/.venvs/airfare-py311` 우선).

- [ ] **Step 2: 모델 계산 함수 더하기** — `shap_block` 아래에:

```python
def compute_shap(kept: pd.DataFrame, size: int = SHAP_SAMPLE, seed: int = SEED) -> dict:
    """기준일까지의 정상 행에 학습 때와 같은 피처 함수를 붙이고 표본을 뽑아, 서비스 모델(v2_predictor.pkl)의
    XGBoost로 TreeSHAP을 계산한다(재학습 없음). 항공권 저장소 src/models/shap_analysis.py와 같은 경로:
    lookup → 전처리 → booster.predict(pred_contribs=True). shap.TreeExplainer는 XGBoost 2.x base_score
    파싱 버그가 있어 쓰지 않는다(그쪽 주석). 모델 로드는 약 17초, NeuralProphet 로그는 quiet()로 막는다."""
    import xgboost as xgb
    from export_demo import quiet
    from src.models.feature_importance import load_pkl_model
    from src.models.tscv_eval_v2 import (add_days_features, add_jp_holiday_features,
                                         add_kr_holiday_features, add_market_features)

    df = kept.copy()
    for step in (add_market_features, add_jp_holiday_features, add_kr_holiday_features, add_days_features):
        df = step(df)
    df["route"] = df["origin"].astype(str) + "_" + df["destination"].astype(str)
    df["departure_date"] = pd.to_datetime(df["departure_date"])
    take = df.sample(n=min(size, len(df)), random_state=seed).reset_index(drop=True)
    with quiet():
        model, names, predictor = load_pkl_model()
        enc = pd.DataFrame(predictor.preprocessor.transform(predictor._apply_lookup(take)), columns=names)
    contribs = model.get_booster().predict(xgb.DMatrix(enc.values), pred_contribs=True)
    # 기여의 합 = 모델 출력(log 잔차)이어야 한다 — 인코딩 경로가 서비스와 어긋나면 여기서 멈춘다
    pred = model.predict(enc.values)
    if not np.allclose(contribs.sum(axis=1), pred, atol=1e-3):
        raise SystemExit("SHAP 합이 모델 출력과 다르다 — 인코딩 경로를 확인한다")
    return shap_block(contribs, enc, CATEGORICAL)
```

`main()`에서 `charts = build_charts(raw, as_of)` 다음에:

```python
    kept, _ = et.split_rows(raw, as_of)
    charts["shap"] = compute_shap(kept)
    check_shap_features(charts["shap"]["features"], json.loads((ROOT / "data" / "facts.json").read_text(encoding="utf-8")))
```

`print` 줄 끝에 `f", SHAP {len(charts['shap']['features'])}×{charts['shap']['n']}"`를 더한다.

주의: 피처 함수 중 하나가 CSV 대신 네트워크(yfinance 등)를 부르면 그쪽 `load_data()`도 똑같이 부르는 것이므로 그대로 둔다. `load_pkl_model`·피처 함수 import 경로가 다르면 `src/models/shap_analysis.py`·`tscv_eval_v2.py` 상단 import를 보고 맞춘다.

- [ ] **Step 3: 다시 만들기** — `cp public/data/charts.2026-09-22.json "$SCRATCH/charts.before.json"` 후 `npm run charts`. 출력 끝에 `SHAP 33×150`.
- [ ] **Step 4: 다른 키가 그대로인지 확인**

```bash
node -e 'const a=require(process.argv[1]),b=require("./public/data/charts.2026-09-22.json");delete b.shap;console.log(JSON.stringify(a)===JSON.stringify(b)?"same":"DIFF")' "$SCRATCH/charts.before.json"
```
Expected: `same`. `DIFF`면 멈추고 보고한다(원본 CSV·기준일 문제).
- [ ] **Step 5: 값 훑어보기** — 피처별 평균 |%|가 큰 순 상위 5개를 출력해 보고서에 적는다(lookup·days 계열이 위에 있으면 정상):

```bash
node -e 'const s=require("./public/data/charts.2026-09-22.json").shap;console.log(s.features.map((f,j)=>[f,(s.v[j].reduce((a,v)=>a+Math.abs(Math.expm1(v/1000)*100),0)/s.n).toFixed(2)]).sort((a,b)=>b[1]-a[1]).slice(0,5))'
```
- [ ] **Step 6: pytest·커밋** — `npm run pytest` 통과 후

```bash
git add scripts/export_charts.py public/data/charts.2026-09-22.json
git commit -m "feat(charts-data): export SHAP sample (33 features × 150) into charts.json"
```

### Task 3: 값 색 번호·새 이름표·배치 표식(타입과 2D)

**Files:**
- Modify: `src/charts/types.ts`, `src/charts/draw2d.ts`
- Test: `tests/unit/charts-draw.test.ts`

- [ ] **Step 1: 실패하는 테스트** — `tests/unit/charts-draw.test.ts`의 `describe('drawLayout'` 안에 더한다(import에 `toneColor`, `TONE_VAL`, `VAL_LO`, `valTone` 추가):

```ts
  it('값 색 번호(10~110)는 파랑 → 호박 보간, 범위 밖은 자른다', () => {
    expect(valTone(0)).toBe(TONE_VAL);
    expect(valTone(100)).toBe(TONE_VAL + 100);
    expect(valTone(140)).toBe(TONE_VAL + 100);
    expect(valTone(-3)).toBe(TONE_VAL);
    expect(toneColor(TONE_VAL)).toBe(VAL_LO.toLowerCase());
    expect(toneColor(TONE_VAL + 100)).toBe('#ffb547');
    expect(toneColor(TONE_VAL + 50)).toBe('#ada1a3'); // (#5A8CFF + #FFB547) / 2, 반올림
    expect(toneColor(TONE.dot)).toBe(TONE_COLOR[TONE.dot]);
  });
```

- [ ] **Step 2: 실패 확인** — `npx vitest run tests/unit/charts-draw.test.ts` → import 오류
- [ ] **Step 3: 구현**

`src/charts/types.ts` — `TONE` 아래:

```ts
// 값 색(계획 5-3c SHAP 벌떼): 색 번호 TONE_VAL + 0~100 = 피처 값 순위. 낮음 VAL_LO(파랑) → 높음 호박.
// 새 속성을 늘리지 않으려고 색 번호를 넓혀 쓴다 — 셰이더 toneColor와 draw2d.toneColor가 같은 규칙
export const TONE_VAL = 10;
export const VAL_LO = '#5A8CFF';
export const valTone = (rank: number) => TONE_VAL + Math.round(Math.min(100, Math.max(0, rank)));
```

`ChartLabel`의 `text` 종류 `cls`에 `'feature' | 'head'`를 더하고, `group` 종류에 `mini?: 'name' | 'pct'`(펼친 화면의 작은 와플 이름표 — 넓은 판은 이름만, 좁은 판은 %만) 를 더한다. `ChartLayout`에 두 필드:

```ts
  // 배치 종류 표식(계획 5-3c). 같은 차트라도 이 값이 바뀌면 3D가 반대 슬롯에 써서 점이 옮겨 간다(chartTargets.pickSlot).
  // 없으면 '' — 창 크기 변경처럼 같은 종류의 다시 배치는 같은 슬롯
  variant?: string;
  summary?: string[]; // 화면 낭독기용 요약 문장(펼친 SHAP 벌떼의 피처별 한 줄)
```

`src/charts/draw2d.ts`:

```ts
import { TONE, TONE_VAL, VAL_LO, type ChartLayout } from './types';

const hex = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const LO = hex(VAL_LO), HI = hex('#FFB547');

// 색 번호 → CSS 색. 값 색(TONE_VAL 이상)은 두 색 사이를 sRGB에서 보간한다
export function toneColor(t: number): string {
  if (t < TONE_VAL) return TONE_COLOR[t] ?? TONE_COLOR[TONE.dot];
  const k = Math.min(1, (t - TONE_VAL) / 100);
  return `#${LO.map((a, i) => Math.round(a + (HI[i] - a) * k).toString(16).padStart(2, '0')).join('')}`;
}
```

`drawLayout`의 `fillStyle` 줄을 `ctx.fillStyle = focused ? toneColor(layout.focusTone) : toneColor(layout.tone[i]);`로.

- [ ] **Step 4: 통과 확인** — `npx vitest run tests/unit/charts-draw.test.ts` + `npx tsc --noEmit`
- [ ] **Step 5: 커밋** — `git add src/charts/types.ts src/charts/draw2d.ts tests/unit/charts-draw.test.ts && git commit -m "feat(charts): value colour tones, feature/head labels, layout variant"`

### Task 4: SHAP 벌떼 배치 `src/charts/shap.ts`

**Files:**
- Create: `src/charts/shap.ts`
- Test: `tests/unit/charts-shap.test.ts`

- [ ] **Step 1: 실패하는 테스트** — `tests/unit/charts-shap.test.ts`:

```ts
// SHAP 벌떼 배치 검사(계획 5-3c): 줄 순서·방향, 점 겹침 없음, 판 안, 3D 점 짝 맞추기 순서, 범주형 색.
import { describe, expect, it } from 'vitest';
import type { FeatureGroupInput } from '@/charts/layouts';
import { shapOpenLayout, shapPct, shapRows, SHAP_LAYOUT, type ShapData, type ShapRow } from '@/charts/shap';
import { TONE, TONE_VAL, type ChartLayout } from '@/charts/types';

// 피처 a: 값이 높을수록 크게 올림, b: 작고 방향 반대, c: 범주형
const N = 150;
const seq = (f: (i: number) => number) => Array.from({ length: N }, (_, i) => f(i));
const shap: ShapData = {
  n: N,
  features: ['b', 'a', 'c', 'd'],
  categorical: ['c'],
  v: [seq((i) => -Math.round((i - 75) * 0.5)), seq((i) => Math.round((i - 75) * 3)), seq((i) => ((i * 37) % 60) - 30), seq(() => 0)],
  f: [seq((i) => Math.round((i / (N - 1)) * 100)), seq((i) => Math.round((i / (N - 1)) * 100)), seq(() => 50), seq((i) => i % 101)],
};
const groups: FeatureGroupInput[] = [
  { id: 'g0', gain: 40, features: ['a', 'b'], name: 'G0' },
  { id: 'g1', gain: 30, features: ['c'], name: 'G1' },
  { id: 'holiday', gain: 20.4, features: ['d'], name: 'H' },
  { id: 'g3', gain: 9.6, features: [], name: 'G3' },
];
const s = {
  gain: (v: number) => `${v.toFixed(1)}%`, count: (n: number) => `${n}개`, pct: (v: number) => `${v}%`,
  lead: 'LEAD', down: 'DOWN', up: 'UP', low: 'LOW', high: 'HIGH', catNote: 'CAT',
  row: (r: ShapRow) => `${r.id}:${r.dir}`,
};
const inside = (L: ChartLayout) => {
  for (let i = 0; i < L.n; i++) {
    expect(L.x[i]).toBeGreaterThanOrEqual(0); expect(L.x[i]).toBeLessThanOrEqual(1);
    expect(L.y[i]).toBeGreaterThanOrEqual(0); expect(L.y[i]).toBeLessThanOrEqual(1);
  }
  for (const l of L.labels) { expect(l.x).toBeGreaterThanOrEqual(0); expect(l.x).toBeLessThanOrEqual(1); expect(l.y).toBeGreaterThanOrEqual(0); expect(l.y).toBeLessThanOrEqual(1); }
};

describe('shapPct', () => {
  it('log 잔차 ×1000 → %', () => {
    expect(shapPct(0)).toBe(0);
    expect(shapPct(1000)).toBeCloseTo((Math.E - 1) * 100, 6);
  });
});

describe('shapRows', () => {
  const rows = shapRows(shap, ['b', 'a', 'c']);
  it('그룹 피처만, 평균 |%|가 큰 순', () => {
    expect(rows.map((r) => r.id)).toEqual(['a', 'b', 'c'].sort((x, y) => rows.find((r) => r.id === y)!.meanAbs - rows.find((r) => r.id === x)!.meanAbs));
    expect(rows[0].id).toBe('a');
    for (let i = 1; i < rows.length; i++) expect(rows[i - 1].meanAbs).toBeGreaterThanOrEqual(rows[i].meanAbs);
  });
  it('방향: 값과 SHAP의 상관 부호, 범주형은 cat', () => {
    const by = Object.fromEntries(rows.map((r) => [r.id, r.dir]));
    expect(by).toEqual({ a: 'up', b: 'down', c: 'cat' });
    expect(shapRows(shap, ['d'])[0].dir).toBe('mixed'); // SHAP이 모두 0 → 상관 없음
  });
  it('없는 피처 이름은 던진다(facts와 charts.json이 어긋나면 바로 보이게)', () => {
    expect(() => shapRows(shap, ['zzz'])).toThrow();
  });
});

describe('shapOpenLayout', () => {
  const W = 1080, H = 414;
  const L = shapOpenLayout(groups, 0, shap, { w: W, h: H }, s);
  it('variant·요약 문장·강조 색', () => {
    expect(L.variant).toBe('open:0');
    expect(L.summary).toEqual(['a:up', 'b:down']);
    expect(L.focusTone).toBe(TONE.amber);
  });
  it('3D 짝 맞추기 순서: 다른 그룹 자리(k×100)는 그 그룹 작은 와플, 펼친 그룹 자리는 벌떼 점', () => {
    for (let k = 1; k < groups.length; k++) for (let j = 0; j < 100; j++) expect(L.hl[k * 100 + j]).toBe(k);
    for (let j = 0; j < 100; j++) expect(L.hl[j]).toBe(-1);
    // 펼친 그룹의 작은 와플 100개는 그 뒤(400~499)
    for (let j = 400; j < 500; j++) expect(L.hl[j]).toBe(0);
  });
  it('작은 와플 켜진 점 수 = 반올림 gain, 공휴일 그룹 켜진 점은 호박', () => {
    const lit = (from: number) => { let n = 0; for (let j = from; j < from + 100; j++) if (L.alpha[j] > 0.5) n++; return n; };
    expect(lit(100)).toBe(30); expect(lit(200)).toBe(20); expect(lit(300)).toBe(10); expect(lit(400)).toBe(40);
    for (let j = 200; j < 300; j++) expect(L.tone[j] === TONE.amber).toBe(L.alpha[j] > 0.5);
  });
  it('벌떼 점: 비범주형은 값 색, 겹치지 않는다, 판 안', () => {
    const swarm: number[] = [];
    for (let i = 0; i < L.n; i++) if (L.hl[i] === -1 && L.tone[i] >= TONE_VAL) swarm.push(i);
    expect(swarm.length).toBeGreaterThan(250); // 2줄 × 150 중 98% 범위 밖·넘침을 빼고
    const seen = new Set<string>();
    for (const i of swarm) {
      const key = `${Math.round(L.x[i] * W * 10)}:${Math.round(L.y[i] * H * 10)}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
    inside(L);
  });
  it('이름표: 작은 와플 그룹 4 + 피처 이름 2(줄 순서대로 위에서 아래) + 머리 줄 + 범례 + 축', () => {
    const g = L.labels.filter((l) => l.type === 'group');
    expect(g).toHaveLength(4);
    expect(g.every((l) => l.type === 'group' && l.mini === 'name' && l.compact)).toBe(true);
    const f = L.labels.filter((l) => l.type === 'text' && l.cls === 'feature');
    expect(f.map((l) => l.type === 'text' && l.text)).toEqual(['a', 'b']);
    expect(f[0].y).toBeLessThan(f[1].y);
    const head = L.labels.find((l) => l.type === 'text' && l.cls === 'head');
    expect(head && head.type === 'text' && head.text).toBe('G0 · 40.0% · 2개 — LEAD');
    const texts = L.labels.flatMap((l) => (l.type === 'text' ? [l.text] : []));
    for (const t of ['LOW', 'HIGH', 'DOWN', 'UP', '0%']) expect(texts).toContain(t);
    expect(texts).not.toContain('CAT');
  });
  it('범주형만 있는 그룹: 벌떼 점은 중간색(TONE.dot), 범례 대신 안내 한 줄', () => {
    const C = shapOpenLayout(groups, 1, shap, { w: W, h: H }, s);
    for (let j = 0; j < 100; j++) if (C.alpha[j] > 0) expect(C.tone[j]).toBe(TONE.dot);
    const texts = C.labels.flatMap((l) => (l.type === 'text' ? [l.text] : []));
    expect(texts).toContain('CAT');
    expect(texts).not.toContain('LOW');
  });
  it('좁은 판(휴대폰): 머리 줄에 설명 없음, 작은 와플 이름표는 %, 판 안', () => {
    const M = shapOpenLayout(groups, 0, shap, { w: 358, h: 354 }, s);
    const head = M.labels.find((l) => l.type === 'text' && l.cls === 'head');
    expect(head && head.type === 'text' && head.text).toBe('G0 · 40.0% · 2개');
    expect(M.labels.filter((l) => l.type === 'group').every((l) => l.type === 'group' && l.mini === 'pct')).toBe(true);
    inside(M);
  });
  it('13줄(가장 많은 그룹)도 줄 높이가 점 두 개 이상', () => {
    const many: ShapData = { ...shap, features: Array.from({ length: 13 }, (_, i) => `x${i}`), categorical: [],
      v: Array.from({ length: 13 }, (_, k) => shap.v[1].map((x) => x * (k + 1))), f: Array.from({ length: 13 }, () => shap.f[1]) };
    const G: FeatureGroupInput[] = [{ id: 'lookup', gain: 46.8, features: many.features, name: 'L' }, ...groups.slice(1)];
    const M = shapOpenLayout(G, 0, many, { w: 358, h: 354 }, s);
    const ys = M.labels.filter((l) => l.type === 'text' && l.cls === 'feature').map((l) => l.y * 354);
    expect(ys).toHaveLength(13);
    for (let i = 1; i < ys.length; i++) expect(ys[i] - ys[i - 1]).toBeGreaterThanOrEqual(SHAP_LAYOUT.dot.narrow * 4);
    inside(M);
  });
});
```

- [ ] **Step 2: 실패 확인** — `npx vitest run tests/unit/charts-shap.test.ts` → 모듈 없음
- [ ] **Step 3: 구현** — `src/charts/shap.ts`:

```ts
// ③ 와플 펼치기 → SHAP 벌떼 배치(계획 5-3c, 설계 2026-09-30 §3.2 배치 A). 펼치면 와플 6개가 판 위 작은 줄로 줄고,
// 남은 판에 펼친 그룹의 피처마다 가로줄 하나 — 점 하나 = 표본 예측 하나에서 그 피처가 가격을 움직인 %.
// layouts.ts와 같은 순수 함수라 2D 대체 그림과 3D 점이 같은 결과를 쓴다.
import type { ChartsData } from './data';
import { Pts, WAFFLE, type FeatureGroupInput, type PlotSize } from './layouts';
import { FOCUS_DIM, TONE, valTone, type ChartLabel, type ChartLayout } from './types';

export type ShapData = NonNullable<ChartsData['shap']>;
export type ShapRow = { id: string; categorical: boolean; pct: number[]; f: number[]; meanAbs: number; dir: 'up' | 'down' | 'mixed' | 'cat' };

// leadMinPx: 머리 줄에 설명 문장을 붙일 최소 판 폭 — 그보다 좁으면 오른쪽 색 범례와 겹친다(한국어·영어 1080px 판 어림)
export const SHAP_LAYOUT = {
  wideMinPx: 560, leadMinPx: 1000,
  mini: { wide: 44, narrow: 30 }, miniFrac: { wide: 0.12, narrow: 0.6 }, miniLabelPx: 18,
  headGap: 10, headPx: { wide: 18, narrow: 32 }, bottomPx: 34,
  labelW: { wide: 150, narrow: 100 }, dot: { wide: 3, narrow: 2.2 }, gap: 0.4,
  clipQ: 0.98, minLim: 1, dirMinCorr: 0.2, legendDots: 24, legendW: 90,
} as const;

export const shapPct = (v: number) => Math.expm1(v / 1000) * 100;

function corr(a: number[], b: number[]): number {
  const n = a.length, ma = a.reduce((s, x) => s + x, 0) / n, mb = b.reduce((s, x) => s + x, 0) / n;
  let sab = 0, saa = 0, sbb = 0;
  for (let i = 0; i < n; i++) { const da = a[i] - ma, db = b[i] - mb; sab += da * db; saa += da * da; sbb += db * db; }
  return saa && sbb ? sab / Math.sqrt(saa * sbb) : 0;
}

// 그룹 피처의 줄들. 순서 = 평균 |%| 내림차순(영향 큰 피처가 위). 방향 = 값 순위와 SHAP의 상관 부호(|r| < 0.2면 mixed)
export function shapRows(shap: ShapData, ids: string[]): ShapRow[] {
  return ids.map((id) => {
    const j = shap.features.indexOf(id);
    if (j < 0) throw new Error(`charts.json shap에 피처 ${id}가 없다`);
    const pct = shap.v[j].map(shapPct), f = shap.f[j];
    const categorical = shap.categorical.includes(id);
    const meanAbs = pct.reduce((s, x) => s + Math.abs(x), 0) / pct.length;
    const r = categorical ? 0 : corr(f, pct);
    const dir = categorical ? 'cat' : r >= SHAP_LAYOUT.dirMinCorr ? 'up' : r <= -SHAP_LAYOUT.dirMinCorr ? 'down' : 'mixed';
    return { id, categorical, pct, f, meanAbs, dir } as ShapRow;
  }).sort((a, b) => b.meanAbs - a.meanAbs);
}

type P = [x: number, y: number, size: number, alpha: number, tone: number, hl: number];

export function shapOpenLayout(
  groups: FeatureGroupInput[], open: number, shap: ShapData, size: PlotSize,
  s: { gain(v: number): string; count(n: number): string; pct(v: number): string; lead: string; down: string; up: string; low: string; high: string; catNote: string; row(r: ShapRow): string },
): ChartLayout {
  const L = SHAP_LAYOUT, W = size.w, H = size.h, wide = W >= L.wideMinPx;
  const g = groups[open];
  const rows = shapRows(shap, g.features);
  const labels: ChartLabel[] = [];

  // 작은 와플 줄: 그룹마다 칸 하나, 가운데 정렬
  const colW = W / groups.length;
  const sq = Math.min(wide ? L.mini.wide : L.mini.narrow, wide ? H * L.miniFrac.wide : colW * L.miniFrac.narrow);
  const cell = sq / WAFFLE.side;
  const mini: P[][] = groups.map((gr, k) => {
    const x0 = k * colW + (colW - sq) / 2, lit = Math.round(gr.gain), hol = gr.id === 'holiday';
    labels.push({
      type: 'group', x: (x0 + sq / 2) / W, y: (sq + 2) / H, id: gr.id, pct: s.gain(gr.gain), name: gr.name,
      count: s.count(gr.features.length), features: gr.features, holiday: hol, compact: true, mini: wide ? 'name' : 'pct',
    });
    return Array.from({ length: WAFFLE.side * WAFFLE.side }, (_, c): P => {
      const on = c < lit;
      return [x0 + ((c % WAFFLE.side) + 0.5) * cell, ((Math.floor(c / WAFFLE.side)) + 0.5) * cell, Math.max(1.6, cell * 0.72), on ? 0.95 : 0.13, on && hol ? TONE.amber : TONE.dot, k];
    });
  });

  // 머리 줄 + 색 범례(범주형뿐이면 안내 한 줄)
  const headY = sq + L.miniLabelPx + L.headGap;
  const headText = `${g.name} · ${s.gain(g.gain)} · ${s.count(g.features.length)}`;
  labels.push({ type: 'text', x: 0, y: headY / H, text: W >= L.leadMinPx ? `${headText} — ${s.lead}` : headText, align: 'start', cls: 'head' });
  const legendY = wide ? headY : headY + 14;
  const extra: P[] = [];
  if (rows.every((r) => r.categorical)) {
    labels.push({ type: 'text', x: 1, y: legendY / H, text: s.catNote, align: 'end', cls: 'tick' });
  } else {
    const lx1 = W - 40, lx0 = lx1 - L.legendW;
    for (let i = 0; i < L.legendDots; i++) {
      const k = i / (L.legendDots - 1);
      extra.push([lx0 + (lx1 - lx0) * k, legendY, 3, 0.9, valTone(k * 100), -1]);
    }
    labels.push({ type: 'text', x: (lx0 - 6) / W, y: legendY / H, text: s.low, align: 'end', cls: 'tick' });
    labels.push({ type: 'text', x: (lx1 + 6) / W, y: legendY / H, text: s.high, align: 'start', cls: 'tick' });
  }

  // 벌떼: 가로 범위는 그룹 전체 |%|의 98번째 백분위로 좌우 대칭. 밖의 점은 가장자리에 붙이지 않고 버린다
  // (④ 벌떼와 같은 이유 — 겹겹이 쌓여 밝은 막대가 된다)
  const top = headY + (wide ? L.headPx.wide : L.headPx.narrow), bottom = H - L.bottomPx;
  const rowH = (bottom - top) / Math.max(1, rows.length);
  const abs = rows.flatMap((r) => r.pct.map(Math.abs)).sort((a, b) => a - b);
  const lim = Math.max(L.minLim, abs.length ? abs[Math.floor(L.clipQ * (abs.length - 1))] : 0);
  const labelW = wide ? L.labelW.wide : L.labelW.narrow;
  const ax0 = labelW + 8, ax1 = W - 8;
  const X = (v: number) => ax0 + (ax1 - ax0) * ((v + lim) / (2 * lim));
  const dot = wide ? L.dot.wide : L.dot.narrow, step = dot + L.gap;
  const swarm: P[] = [];
  rows.forEach((r, ri) => {
    const cy = top + rowH * (ri + 0.5);
    labels.push({ type: 'text', x: labelW / W, y: cy / H, text: r.id, align: 'end', cls: 'feature' });
    const used = new Map<number, number>();
    r.pct.forEach((v, i) => {
      if (Math.abs(v) > lim) return;
      // 가로를 점 간격 단위 열로 맞추고, 같은 열의 k번째 점은 줄 가운데에서 위아래로 번갈아 비킨다 → 겹치지 않는다
      const col = Math.round(X(v) / step);
      const k = used.get(col) ?? 0;
      used.set(col, k + 1);
      const off = Math.ceil(k / 2) * step * (k % 2 ? 1 : -1);
      if (Math.abs(off) > rowH * 0.45) return;
      swarm.push([col * step, cy + off, dot, 0.85, r.categorical ? TONE.dot : valTone(r.f[i]), -1]);
    });
  });
  for (let y = top; y <= bottom; y += 4) extra.push([X(0), y, 1.6, 0.28, TONE.text, -1]);

  // 축: 눈금(−lim·0·+lim) 한 줄 + 방향 글 한 줄
  const tickY = H - 22, dirY = H - 7;
  labels.push({ type: 'text', x: ax0 / W, y: tickY / H, text: s.pct(-Math.round(lim)), align: 'start', cls: 'tick' });
  labels.push({ type: 'text', x: X(0) / W, y: tickY / H, text: s.pct(0), align: 'center', cls: 'tick' });
  labels.push({ type: 'text', x: ax1 / W, y: tickY / H, text: s.pct(Math.round(lim)), align: 'end', cls: 'tick' });
  labels.push({ type: 'text', x: ax0 / W, y: dirY / H, text: s.down, align: 'start', cls: 'axis' });
  labels.push({ type: 'text', x: ax1 / W, y: dirY / H, text: s.up, align: 'end', cls: 'axis' });

  // 점 순서 = 3D 점 짝(assignPoints가 순서대로 점 구름을 배정한다). 닫힌 와플의 그룹 k 자리(k×100)에 그대로 그룹 k의
  // 작은 와플을 두어 점이 제자리에서 줄어들게 하고, 펼친 그룹 자리에는 벌떼 앞 100점을 두어 그 와플 점이 벌떼로
  // 흩어지게 한다. 펼친 그룹의 작은 와플·나머지 벌떼·0선·범례는 그 뒤(지형에서 날아온다)
  const p = new Pts();
  const add = (q: P) => p.add(q[0] / W, q[1] / H, q[2], q[3], q[4], -1, q[5]);
  const head = swarm.slice(0, 100);
  // 벌떼 점이 100개보다 적으면(범위 밖이 많은 작은 그룹) 보이지 않는 점으로 채워 뒤 그룹 자리가 밀리지 않게 한다
  while (head.length < 100) head.push([X(0), top, 1.6, 0, TONE.dot, -1]);
  groups.forEach((_, k) => (k === open ? head : mini[k]).forEach(add));
  mini[open].forEach(add);
  swarm.slice(100).forEach(add);
  extra.forEach(add);
  return { ...p.done(labels, TONE.amber, FOCUS_DIM), variant: `open:${open}`, summary: rows.map(s.row) };
}
```

`src/charts/layouts.ts`의 `class Pts`는 이미 `export`다. `ChartsData['shap']`는 Task 5 스키마에서 생기므로, **Task 5를 먼저 끝내거나** 이 태스크 안에서 임시로 `export type ShapData = { n: number; features: string[]; categorical: string[]; v: number[][]; f: number[][] }`로 두고 Task 5에서 `NonNullable<ChartsData['shap']>`로 바꾼다(권장: 위 임시 타입으로 시작 — 모양이 같다).

- [ ] **Step 4: 통과 확인** — `npx vitest run tests/unit/charts-shap.test.ts tests/unit/charts-layouts.test.ts` + `npx tsc --noEmit`. 테스트 값(예: 켜진 점 수, 벌떼 점 >250)이 구현 규칙과 다르면 **규칙이 설계와 맞는지 먼저 확인**하고 테스트 쪽 숫자만 고친다.
- [ ] **Step 5: 커밋** — `git add src/charts/shap.ts tests/unit/charts-shap.test.ts && git commit -m "feat(charts): SHAP swarm layout for the opened waffle group"`

### Task 5: 스키마 `shap`

**Files:**
- Modify: `src/charts/data.ts`, `src/charts/shap.ts`(타입 한 줄)
- Test: `tests/unit/charts-data.test.ts`

- [ ] **Step 1: 실패하는 테스트** — `describe('loadCharts'` 안에:

```ts
  it('SHAP 표본: 피처 33개 × n, 값 순위 0~100', async () => {
    const c = await loadCharts(v, as(vi.fn(() => ok(file('charts')))));
    expect(c.shap?.features).toHaveLength(33);
    expect(c.shap?.v.every((r) => r.length === c.shap!.n)).toBe(true);
    expect(c.shap?.f.flat().every((x) => x >= 0 && x <= 100)).toBe(true);
  });
  it('SHAP 줄 길이가 n과 다르면 reject', async () => {
    const bad = file('charts');
    bad.shap.v[0] = bad.shap.v[0].slice(1);
    await expect(loadCharts(v, as(vi.fn(() => ok(bad))))).rejects.toThrow();
  });
```

(Task 2 전에 돌리면 첫 테스트는 `shap`이 없어 실패한다 — Task 2 뒤에 통과해야 한다.)

- [ ] **Step 2: 구현** — `chartsSchema`의 `curve` 다음에:

```ts
  // ③ SHAP 벌떼(계획 5-3c). 없어도 받아들인다 — 와플은 닫힌 상태에 데이터가 필요 없고, 펼치기만 안 된다
  shap: z.object({
    n: z.number().int().positive(),
    features: z.array(z.string()).min(1),
    categorical: z.array(z.string()),
    v: z.array(ints),
    f: z.array(ints),
  }).optional(),
```

refine 하나 더:

```ts
  .refine((c) => !c.shap || (c.shap.v.length === c.shap.features.length && c.shap.f.length === c.shap.features.length
    && [...c.shap.v, ...c.shap.f].every((r) => r.length === c.shap!.n)), 'SHAP 배열 모양이 다르다')
```

`src/charts/shap.ts`의 `ShapData`를 `NonNullable<ChartsData['shap']>`로.

- [ ] **Step 3: 통과 확인** — `npx vitest run tests/unit/charts-data.test.ts tests/unit/charts-shap.test.ts` + `npx tsc --noEmit`
- [ ] **Step 4: 커밋** — `git add src/charts/data.ts src/charts/shap.ts tests/unit/charts-data.test.ts && git commit -m "feat(charts-data): validate the SHAP sample"`

### Task 6: 배치 조립 `build.ts`

**Files:**
- Modify: `src/charts/build.ts`
- Test: `tests/unit/charts-draw.test.ts`

- [ ] **Step 1: 실패하는 테스트** — `charts-draw.test.ts`의 키별 조립 describe(`buildLayout`을 쓰는 곳) 안에:

```ts
  it('와플: open이 있으면 SHAP 벌떼 배치, 없거나 SHAP 데이터가 없으면 닫힌 와플', () => {
    const charts = JSON.parse(readFileSync(`public/data/charts.${facts.dataVersion}.json`, 'utf8')) as ChartsData;
    const groups = facts.model.featureGroups.map((g) => ({ id: g.id, gain: g.gain, features: g.features, name: g.id }));
    const shapTexts = { lead: 'L', down: 'D', up: 'U', low: 'lo', high: 'hi', catNote: 'C', rowUp: '{v.name} up {v.pct}', rowDown: '{v.name} down {v.pct}', rowMixed: '{v.name} mixed {v.pct}', rowCat: '{v.name} cat {v.pct}', opened: '{v.name}', closed: 'x' };
    const s = { locale: 'ko' as const, holidays: {}, groups, countUnit: '개', shap: shapTexts };
    const closed = buildLayout('features', { charts }, { w: 1080, h: 414 }, s);
    expect(closed.variant ?? '').toBe('');
    const open = buildLayout('features', { charts }, { w: 1080, h: 414 }, s, 0);
    expect(open.variant).toBe('open:0');
    expect(open.summary).toHaveLength(groups[0].features.length);
    expect(open.summary![0]).toMatch(/ (up|down|mixed|cat) \d+\.\d%$/);
    expect(buildLayout('features', {}, { w: 1080, h: 414 }, s, 0).variant ?? '').toBe(''); // 데이터 없음 → 닫힌 와플
  });
```

(파일 위 import에 `readFileSync`(`node:fs`)가 없으면 더한다.)

- [ ] **Step 2: 구현**

```ts
import { shapOpenLayout } from './shap';

// ③ SHAP 벌떼 문구(content features.shap). row*·opened는 {v.name}·{v.pct} 자리표시를 남긴 채 넘어온다
export type ShapTexts = { lead: string; down: string; up: string; low: string; high: string; catNote: string; rowUp: string; rowDown: string; rowMixed: string; rowCat: string; opened: string; closed: string };
```

`ChartStrings`에 `shap?: ShapTexts; // 와플(③)만 — 펼친 SHAP 벌떼`.

`loadFor`의 와플 줄:

```ts
  // 와플은 닫힌 상태에 데이터가 필요 없다 — charts.json을 못 받아도 와플은 그리고 펼치기만 막는다(ChartStage)
  if (key === 'features') return { charts: await once(`charts:${dataVersion}`, () => loadCharts(dataVersion)).catch(() => undefined) };
```

`buildLayout(key, loaded, size, s, open = -1)` — 마지막 인자 추가(주석: `open: ③ 펼친 와플 그룹 번호(−1 = 닫힘)`), `case 'features'`:

```ts
    case 'features': {
      const gain = (v: number) => `${v.toFixed(1)}%`, count = (n: number) => `${n}${s.countUnit ?? ''}`;
      const shap = loaded.charts?.shap, T = s.shap, groups = s.groups ?? [];
      if (open >= 0 && open < groups.length && shap && T) {
        const tpl = { up: T.rowUp, down: T.rowDown, mixed: T.rowMixed, cat: T.rowCat };
        return shapOpenLayout(groups, open, shap, size, {
          gain, count, pct: signed, lead: T.lead, down: T.down, up: T.up, low: T.low, high: T.high, catNote: T.catNote,
          row: (r) => interpolate(tpl[r.dir], { v: { name: r.id, pct: `${r.meanAbs.toFixed(1)}%` } }, s.locale),
        });
      }
      return waffleLayout(groups, size, { pct: gain, count });
    }
```

- [ ] **Step 3: 통과 확인** — `npx vitest run tests/unit/charts-draw.test.ts tests/unit/client-imports.test.ts` + `npx tsc --noEmit`
- [ ] **Step 4: 커밋** — `git add src/charts/build.ts tests/unit/charts-draw.test.ts && git commit -m "feat(charts): build the opened SHAP layout for the waffle"`

### Task 7: 3D — 값 색 셰이더, 배치가 바뀌면 반대 슬롯

**Files:**
- Modify: `src/three/shaders.ts`, `src/three/TerrainPoints.tsx`, `src/three/chartTargets.ts`, `src/three/TerrainScene.tsx`
- Test: `tests/unit/chart-targets.test.ts`

- [ ] **Step 1: 실패하는 테스트** — `describe('pickSlot'` 안에:

```ts
  it('같은 차트라도 배치 종류(variant)가 바뀌면 반대 슬롯 — 와플 펼치기·닫기·그룹 바꾸기에 점이 옮겨 간다', () => {
    expect(pickSlot({ key: 'features', variant: '', slot: 0 }, 'features', 'open:2')).toBe(1);
    expect(pickSlot({ key: 'features', variant: 'open:2', slot: 1 }, 'features', 'open:3')).toBe(0);
    expect(pickSlot({ key: 'features', variant: 'open:2', slot: 1 }, 'features', '')).toBe(0);
  });
  it('같은 종류의 다시 배치(창 크기 변경)는 같은 슬롯', () => {
    expect(pickSlot({ key: 'features', variant: 'open:2', slot: 1 }, 'features', 'open:2')).toBe(1);
  });
```

- [ ] **Step 2: 실패 확인** — `npx vitest run tests/unit/chart-targets.test.ts`
- [ ] **Step 3: 구현**

`chartTargets.ts`:

```ts
// 새 차트 배치를 쓸 슬롯. last는 마지막으로 슬롯에 써 넣은 차트로, 지형 장면으로 나가도 지우지 않는다 —
// (기존 설명 유지) … 같은 차트라도 배치 종류(ChartLayout.variant — ③ 와플 펼침 상태)가 바뀌면 반대 슬롯에 써서
// uSlot이 옮겨 가는 동안 점이 옛 자리에서 새 자리로 움직이게 한다(계획 5-3c). 창 크기 변경은 종류가 같아 같은 슬롯
export function pickSlot(last: { key: ChartKey | null; variant?: string; slot: 0 | 1 }, next: ChartKey, variant = ''): 0 | 1 {
  if (last.key === null || (last.key === next && (last.variant ?? '') === variant)) return last.slot;
  return last.slot === 0 ? 1 : 0;
}
```

`TerrainScene.tsx`: `lastWritten` 타입에 `variant: string`(초기 `''`), 159~164줄:

```ts
        const variant = entry.layout.variant ?? '';
        const slot = pickSlot(lastWritten.current, chartKey, variant);
        …
        lastWritten.current = { key: chartKey, variant, slot };
```

`shaders.ts`: 유니폼 목록에 `uniform vec3 uValLo;`, `toneColor`를

```glsl
  vec3 toneColor(float t) { return t > 9.5 ? mix(uValLo, uAmber, clamp((t - 10.0) / 100.0, 0.0, 1.0)) : (t > 2.5 ? uText : (t > 1.5 ? uAmber : uDot)); }
```

위 설명 주석의 `toneColor:` 줄에 "10~110 = 값 색(계획 5-3c SHAP 벌떼, charts/types.ts TONE_VAL) — uValLo → uAmber 보간"을 더한다. (선형 공간 보간이라 2D sRGB 보간과 가운데 색이 조금 다르다 — 괜찮다.)

`TerrainPoints.tsx` 유니폼(139줄 근처): `uValLo: { value: new THREE.Color('#5A8CFF') }, // charts/types.ts VAL_LO`.

- [ ] **Step 4: 통과 확인** — `npx vitest run tests/unit/chart-targets.test.ts tests/unit/three-*.test.ts` + `npx tsc --noEmit`
- [ ] **Step 5: 커밋** — `git add src/three/shaders.ts src/three/TerrainPoints.tsx src/three/chartTargets.ts src/three/TerrainScene.tsx tests/unit/chart-targets.test.ts && git commit -m "feat(3d): value colours and slot swap when the chart layout variant changes"`

### Task 8: 문구(3개 언어)

**Files:**
- Modify: `content/ko.json`, `content/en.json`, `content/ja.json`

- [ ] **Step 1: 문구 넣기** — 각 파일 `features` 안에 `shap` 객체를 더하고 `hint`를 바꾼다(숫자 없음, `{v.…}`만).

ko:
```json
"hint": "그룹에 마우스를 올리면 피처 이름이 보이고, 누르면 피처별 SHAP 값이 펼쳐집니다(Esc로 닫기).",
"shap": {
  "lead": "점 하나 = 예측 하나에서 이 피처가 가격을 움직인 정도",
  "down": "← 가격을 내림", "up": "가격을 올림 →",
  "low": "값 낮음", "high": "높음",
  "catNote": "범주형 피처라 값 색은 없습니다",
  "rowUp": "{v.name}: 평균 영향 ±{v.pct}, 값이 높을수록 가격을 올림",
  "rowDown": "{v.name}: 평균 영향 ±{v.pct}, 값이 높을수록 가격을 내림",
  "rowMixed": "{v.name}: 평균 영향 ±{v.pct}, 값에 따른 방향이 일정하지 않음",
  "rowCat": "{v.name}: 평균 영향 ±{v.pct}, 범주형",
  "opened": "{v.name} 그룹의 피처별 SHAP 값을 펼쳤습니다",
  "closed": "SHAP 값을 닫았습니다"
}
```

en:
```json
"hint": "Hover over a group to see its feature names; click it to expand SHAP values per feature (Esc closes).",
"shap": {
  "lead": "One dot = how much this feature moved the price in one prediction",
  "down": "← lowers price", "up": "raises price →",
  "low": "low value", "high": "high",
  "catNote": "Categorical features have no value colour",
  "rowUp": "{v.name}: average effect ±{v.pct}; higher values raise the price",
  "rowDown": "{v.name}: average effect ±{v.pct}; higher values lower the price",
  "rowMixed": "{v.name}: average effect ±{v.pct}; no consistent direction",
  "rowCat": "{v.name}: average effect ±{v.pct}; categorical",
  "opened": "Expanded SHAP values for {v.name}",
  "closed": "Closed SHAP values"
}
```

ja:
```json
"hint": "グループにマウスを乗せると特徴量の名前が、クリックすると特徴量ごとのSHAP値が開きます(Escで閉じる)。",
"shap": {
  "lead": "点ひとつ = ひとつの予測でこの特徴量が価格を動かした大きさ",
  "down": "← 価格を下げる", "up": "価格を上げる →",
  "low": "値が低い", "high": "高い",
  "catNote": "カテゴリ特徴量のため値の色はありません",
  "rowUp": "{v.name}: 平均影響 ±{v.pct}、値が高いほど価格を上げる",
  "rowDown": "{v.name}: 平均影響 ±{v.pct}、値が高いほど価格を下げる",
  "rowMixed": "{v.name}: 平均影響 ±{v.pct}、値による向きは一定でない",
  "rowCat": "{v.name}: 平均影響 ±{v.pct}、カテゴリ",
  "opened": "{v.name} の特徴量ごとのSHAP値を開きました",
  "closed": "SHAP値を閉じました"
}
```

- [ ] **Step 2: 확인** — `npx vitest run tests/unit/content.test.ts tests/unit/charts-content.test.ts`. 숫자 금지 테스트가 `{v.…}` 자리표시를 잡으면(현재 `charts.*.tip`과 같은 방식이라 통과해야 한다) 보고한다. `features.shap.*`를 `t()`로 직접 부르면 `{v.name}`에서 throw하므로 Task 9는 `prefill`을 쓴다.
- [ ] **Step 3: 커밋** — `git add content/ko.json content/en.json content/ja.json && git commit -m "content: SHAP swarm copy (ko draft; en/ja drafts)"`

### Task 9: 그림 판 — 버튼 층·펼침 상태·Esc·요약·알림

**Files:**
- Modify: `src/components/charts/ChartStage.tsx`, `src/components/sections/Features.tsx`, `src/styles/globals.css`

- [ ] **Step 1: `Features.tsx`** — SHAP 문구를 `prefill`로 넘긴다:

```ts
import { dictionaries, getT } from '@/lib/content';
import { formatValue, prefill, type Locale } from '@/lib/i18n';
import type { ShapTexts } from '@/charts/build';
…
  // SHAP 문구는 {v.…}를 남긴 채 넘긴다(t()는 facts에서 찾다가 throw) — 배치 코드가 피처 값으로 채운다
  const shap = Object.fromEntries(Object.entries(dictionaries[locale].features.shap).map(([k, v]) => [k, prefill(v as string, facts, locale)])) as ShapTexts;
```

`strings={{ locale, holidays: {}, groups, countUnit, shap }}`. (`import type`이라 build 청크가 초기 JS에 들어가지 않는다 — `client-imports` 테스트로 확인.)

- [ ] **Step 2: `ChartStage.tsx`** — 바꿀 것(와플일 때만 쓰이는 상태지만 한 부품이라 그대로 둔다):

1. 상태: `const [open, setOpen] = useState(-1); const openRef = useRef(-1); const relayout = useRef<() => void>(() => {}); const [shapOk, setShapOk] = useState(false); const [announce, setAnnounce] = useState(''); const buttons = useRef<(HTMLButtonElement | null)[]>([]);`
2. 불러온 뒤: `setShapOk(!!loaded.charts?.shap);`, `redraw` 안 `mod.buildLayout(chartKey, loaded, { w: r.width, h: r.height }, strings, openRef.current)`, `redraw` 끝의 `draw(selRef.current)` → `draw(openRef.current >= 0 ? openRef.current : selRef.current)`, `redraw()` 호출 앞에 `relayout.current = redraw;`. 정리 함수에 `relayout.current = () => {};`.
3. 강조: 펼친 동안은 펼친 그룹이 강조다.

```ts
  // 펼친 동안(③)은 펼친 그룹이 강조 — 마우스 올리기(sel)는 닫힌 상태에서만 쓴다
  const focusNow = open >= 0 ? open : sel;
  useEffect(() => {
    selRef.current = sel;
    publishFocus(chartKey, focusNow);
    paint.current(focusNow);
  }, [sel, focusNow, chartKey]);
  useEffect(() => { openRef.current = open; relayout.current(); }, [open]);
```

4. 여닫기·Esc:

```ts
  const toggle = (gi: number) => {
    if (!shapOk) { setFailed(true); return; } // SHAP 데이터를 못 받았으면 펼치지 않고 안내만
    setSel(-1);
    const next = openRef.current === gi ? -1 : gi;
    setOpen(next);
    setAnnounce(next >= 0 && strings.shap ? strings.shap.opened.replace('{v.name}', groups[gi]?.name ?? '') : strings.shap?.closed ?? '');
  };
  // Esc: 펼친 동안 어디에 초점이 있든 닫고, 초점을 그 그룹 버튼으로 돌려놓는다(화면이 튀지 않게 preventScroll)
  useEffect(() => {
    if (open < 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const gi = openRef.current;
      setOpen(-1);
      setAnnounce(strings.shap?.closed ?? '');
      buttons.current[gi]?.focus({ preventScroll: true });
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, strings]);
```

`groupHandlers(gi)`:

```ts
  // 마우스·펜은 올리면 설명 줄(닫힌 상태만), 누르기·Enter·Space(button의 click)는 모든 포인터에서 펼치기/닫기
  const groupHandlers = (gi: number) => ({
    onPointerEnter: (e: React.PointerEvent) => { if (e.pointerType !== 'touch' && openRef.current < 0) setSel(gi); },
    onPointerLeave: (e: React.PointerEvent) => { if (e.pointerType !== 'touch') setSel(-1); },
    onClick: () => toggle(gi),
  });
```

`lastPointer` ref는 더 쓰지 않으면 지운다.

5. 그리기: `.chart-labels`(aria-hidden) 안에서는 `group` 이름표를 건너뛰고(`if (l.type === 'group') return null;`), 그 뒤에 버튼 층을 따로 둔다:

```tsx
        {/* ③ 와플 그룹 버튼(계획 5-3c): 축·눈금 글자가 낭독되지 않게 이름표 층(aria-hidden) 밖에 둔다 */}
        {groups.length > 0 && (
          <div className="chart-groups">
            {groups.map((l, gi) => {
              const cls = `chart-group${l.holiday ? ' is-holiday' : ''}${l.mini ? ' is-mini' : ''}${focusNow === gi ? ' is-focus' : focusNow >= 0 ? ' is-dim' : ''}`;
              return (
                <button key={l.id} ref={(el) => { buttons.current[gi] = el; }} type="button" className={cls}
                  style={{ left: `${l.x * 100}%`, top: `${l.y * 100}%` }}
                  aria-expanded={open === gi} aria-controls={`${chartKey}-shap`} aria-label={`${l.name} ${l.pct} · ${l.count}`}
                  {...groupHandlers(gi)}>
                  {l.mini !== 'name' && <span className="chart-group-pct">{l.pct}</span>}
                  {l.mini !== 'pct' && <span className="chart-group-name">{l.name}</span>}
                  {!l.compact && <span className="chart-group-count">{l.count}</span>}
                </button>
              );
            })}
          </div>
        )}
```

(`groups`는 지금 map 안의 IIFE에서 계산하던 것을 컴포넌트 본문으로 올린다: `const groups = labels.filter((l): l is Extract<ChartLabel, { type: 'group' }> => l.type === 'group');` — 설명 줄(`detail`) 그리기도 이 `groups`와 `sel`을 쓴다.)

6. 요약·알림(판 안, `chart-error` 옆). `aria-controls`가 늘 있는 id를 가리키도록 목록은 늘 둔다:

```tsx
        {chartKey === 'features' && (
          <>
            <ul id={`${chartKey}-shap`} className="sr-only">{(open >= 0 ? lay?.summary ?? [] : []).map((t) => <li key={t}>{t}</li>)}</ul>
            <p className="sr-only" role="status">{announce}</p>
          </>
        )}
```

- [ ] **Step 3: CSS** — `globals.css`의 `.chart-group` 규칙 근처:

```css
/* ③ 와플 그룹 버튼 층(계획 5-3c): 판은 pointer-events: none이라 버튼만 받는다. 버튼 기본 모양은 지운다 */
.chart-groups { position: absolute; inset: 0; pointer-events: none; }
button.chart-group { background: none; border: 0; padding: 0; color: inherit; font: inherit; }
.chart-group.is-mini { gap: 0; }
.chart-group.is-mini .chart-group-pct, .chart-group.is-mini .chart-group-name { font-size: 0.7rem; }
.chart-label.feature { color: var(--tx); }
.chart-label.head { color: var(--tx); letter-spacing: 0.02em; }
```

(`.chart-group`의 `cursor: pointer` 주석은 "누르면 펼치기(toggle)"로 고친다.)

- [ ] **Step 4: 확인** — `npx tsc --noEmit`, `npm test`, `npm run build`, `npm run size`(초기 JS ≤150KB — 늘어난 양을 보고서에 적는다). 개발 서버(`npx next dev -p 3072`)에서 1440×900으로 ③을 열어 와플 누르기·Esc·다른 그룹 바꾸기를 3D 켜짐(헤드 있는 크로미움)·꺼짐(움직임 줄이기) 둘 다 눈으로 확인하고 스크린샷을 스크래치 폴더에 남긴다. 머리 줄과 색 범례가 겹치지 않는지, 피처 이름이 판 밖으로 안 나가는지 본다.
- [ ] **Step 5: 커밋** — `git add src/components/charts/ChartStage.tsx src/components/sections/Features.tsx src/styles/globals.css && git commit -m "feat(features): open a waffle group into its SHAP swarm (click, Enter/Space, Esc)"`

### Task 10: e2e

**Files:**
- Modify: `tests/e2e/charts.spec.ts`

- [ ] **Step 1: 옛 휴대폰 테스트 교체** — `test.describe('휴대폰 누르기'`의 "누르면 켜지고, 손을 떼도 남고, 다시 누르면 꺼진다"를 아래로 바꾼다:

```ts
    test('누르면 SHAP 벌떼로 펼치고, 다시 누르면 닫힌다 — 판 안, 가로 스크롤 없음', async ({ page }) => {
      await page.goto('/');
      await center(page, '[data-scene="features"]');
      const stage = page.locator('[data-scene="features"]');
      const g = stage.locator('.chart-group').nth(0);
      await expect(g).toBeVisible({ timeout: 10_000 });
      await g.tap();
      await expect(g).toHaveAttribute('aria-expanded', 'true');
      const feats = stage.locator('.chart-label.feature');
      await expect(feats).toHaveCount(facts.model.featureGroups[0].features.length);
      const plot = (await stage.locator('[data-plot]').boundingBox())!;
      for (const b of await feats.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON()))) {
        expect(b.left).toBeGreaterThanOrEqual(plot.x - 1);
        expect(b.bottom).toBeLessThanOrEqual(plot.y + plot.height + 2);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
      await stage.locator('.chart-group').nth(0).tap();
      await expect(stage.locator('.chart-group').nth(0)).toHaveAttribute('aria-expanded', 'false');
      await expect(feats).toHaveCount(0);
    });
```

파일 위에 facts를 fs로 읽는다(`board.spec.ts`와 같은 방식 — e2e에서는 JSON 정적 import가 실패한다):

```ts
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const facts = JSON.parse(readFileSync(fileURLToPath(new URL('../../data/facts.json', import.meta.url)), 'utf-8')) as {
  model: { featureGroups: { features: string[] }[] };
};
```

- [ ] **Step 2: 데스크톱 테스트 더하기** — `test.describe('3D 꺼짐(움직임 줄이기)'` 안에:

```ts
  test.describe('③ SHAP 벌떼 펼치기', () => {
    test.use({ viewport: { width: 1440, height: 900 } });
    const open = async (page: Page) => {
      await page.goto('/');
      await center(page, '[data-scene="features"]');
      const stage = page.locator('[data-scene="features"]');
      await expect(stage.locator('.chart-group')).toHaveCount(6, { timeout: 10_000 });
      return stage;
    };

    test('누르면 펼치고(피처 줄·요약·그림), Esc로 닫고 초점이 버튼으로', async ({ page }) => {
      const stage = await open(page);
      const b = stage.locator('.chart-group').nth(0);
      await b.click();
      await expect(b).toHaveAttribute('aria-expanded', 'true');
      const n = facts.model.featureGroups[0].features.length;
      await expect(stage.locator('.chart-label.feature')).toHaveCount(n);
      await expect(stage.locator('#features-shap li')).toHaveCount(n);
      await expect(stage.locator('[role="status"]').last()).not.toBeEmpty();
      await expect(stage.locator('.chart-group')).toHaveCount(6); // 작은 와플 줄
      await expect.poll(() => painted(page, 'features')).toBe(true);
      await page.keyboard.press('Escape');
      await expect(b).toHaveAttribute('aria-expanded', 'false');
      await expect(stage.locator('.chart-label.feature')).toHaveCount(0);
      await expect(b).toBeFocused();
    });

    test('키보드: Enter로 펼치고 Space로 닫는다', async ({ page }) => {
      const stage = await open(page);
      const b = stage.locator('.chart-group').nth(2);
      await b.focus();
      await page.keyboard.press('Enter');
      await expect(b).toHaveAttribute('aria-expanded', 'true');
      await expect(stage.locator('.chart-label.feature')).toHaveCount(facts.model.featureGroups[2].features.length);
      await page.keyboard.press('Space');
      await expect(b).toHaveAttribute('aria-expanded', 'false');
    });

    test('펼친 채 다른 작은 와플을 누르면 그 그룹으로 바뀐다(한 번에 하나)', async ({ page }) => {
      const stage = await open(page);
      await stage.locator('.chart-group').nth(0).click();
      await stage.locator('.chart-group').nth(3).click();
      await expect(stage.locator('.chart-group').nth(3)).toHaveAttribute('aria-expanded', 'true');
      await expect(stage.locator('.chart-group').nth(0)).toHaveAttribute('aria-expanded', 'false');
      await expect(stage.locator('.chart-label.feature')).toHaveCount(facts.model.featureGroups[3].features.length);
    });

    for (const path of ['/', '/en/', '/ja/']) {
      test(`${path} 머리 줄과 색 범례가 겹치지 않고, 이름표가 판 안`, async ({ page }) => {
        await page.goto(path);
        await center(page, '[data-scene="features"]');
        const stage = page.locator('[data-scene="features"]');
        await stage.locator('.chart-group').nth(0).click();
        const head = (await stage.locator('.chart-label.head').boundingBox())!;
        const ticks = await stage.locator('.chart-label.tick').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON()));
        const plot = (await stage.locator('[data-plot]').boundingBox())!;
        for (const t of ticks) if (Math.abs(t.top - head.y) < 8) expect(t.left).toBeGreaterThanOrEqual(head.x + head.width);
        for (const t of [...ticks, head]) {
          const b = 'left' in t ? t : { left: t.x, right: t.x + t.width };
          expect(b.left).toBeGreaterThanOrEqual(plot.x - 1);
          expect(b.right).toBeLessThanOrEqual(plot.x + plot.width + 1);
        }
      });
    }

    test('펼친 상태 axe 위반 없음', async ({ page }) => {
      const stage = await open(page);
      await stage.locator('.chart-group').nth(0).click();
      const r = await new AxeBuilder({ page }).include('[data-scene="features"]').analyze();
      expect(r.violations).toEqual([]);
    });
  });
```

파일 위에 `import AxeBuilder from '@axe-core/playwright';`.

- [ ] **Step 3: SHAP 데이터를 못 받았을 때** — 기존 "차트 데이터를 못 받으면 안내" 테스트 아래:

```ts
  test('차트 데이터를 못 받아도 와플은 그리고, 누르면 안내만 뜬다', async ({ page }) => {
    await page.route('**/data/charts.*.json', (r) => r.abort());
    await page.goto('/');
    await center(page, '[data-scene="features"]');
    const stage = page.locator('[data-scene="features"]');
    await expect(stage.locator('.chart-group')).toHaveCount(6, { timeout: 10_000 });
    await stage.locator('.chart-group').nth(0).click();
    await expect(stage.locator('.chart-error')).toBeVisible();
    await expect(stage.locator('.chart-label.feature')).toHaveCount(0);
  });
```

- [ ] **Step 4: 돌리기** — `npm run build && npx playwright test tests/e2e/charts.spec.ts`(desktop·mobile 프로젝트 모두). 그다음 전체 `npm run e2e`.
- [ ] **Step 5: 커밋** — `git add tests/e2e/charts.spec.ts && git commit -m "test(e2e): SHAP swarm open/close, keyboard, switch, axe, mobile"`

### Task 11: 마무리 — 검증·문서

**Files:**
- Modify: `docs/superpowers/specs/2026-09-30-shap-swarm-design.md`, `CLAUDE.md`

- [ ] **Step 1: 전체 검증** — `npx tsc --noEmit && npm test && npm run pytest && npm run build && npm run size && npm run e2e`. 결과 수(단위·e2e·pytest)와 초기 JS·3D 청크·`charts.json` gzip을 기록한다.
- [ ] **Step 2: 눈 확인(3D 켜짐)** — 헤드 있는 크로미움 1440×900에서 lookup·노선·항공사·공휴일 세 그룹을 펼친 스크린샷, 390×844 한 장. 와플 점이 벌떼로 옮겨 가는지, 값 색이 보이는지.
- [ ] **Step 3: 문서** — 설계 문서 끝에 "## 구현 결과 (계획 5-3c)": 위 "설계에서 바꾼 점", SHAP 상위 피처(Task 2 Step 5), 검증 수치. `CLAUDE.md`: 상태 표에 5-3c 줄(`2026-09-30-plan-5-3c-shap-swarm.md`, PR 번호는 올린 뒤), "현재 상태"·"다음 세션" 0번 갱신, 페이지 구성 ③ 문장에 "눌러 SHAP 벌떼로 펼치기(작은 와플 줄 + 벌떼)".
- [ ] **Step 4: 커밋·PR** — `git add docs/superpowers/specs/2026-09-30-shap-swarm-design.md CLAUDE.md && git commit -m "docs: plan 5-3c results"` → `git push -u origin plan-5-3c-shap` → `gh pr create`(본문 끝 `🤖 Generated with [Claude Code](https://claude.com/claude-code)`). CI 통과 확인 후 사용자 확인을 기다린다(병합은 사용자 확인 뒤).
