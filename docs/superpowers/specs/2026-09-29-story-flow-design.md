# 이야기 흐름 개선 설계 — ③ 모델 문단, ④ 발견 / ⑤ 검증 (2026-09-29, 계획 7-1)

> 기존 설계 `2026-09-25-page-restructure-design.md`(§2.1 섹션 목록, §3.3 ③, §3.4 ④)를 바꾸는 부분만 적는다.
> 데모·연락처는 사용자가 나중에 다시 만든다 — 이 계획에서는 손대지 않는다.

## 0. 목표

- 채용 담당자가 페이지를 내려가며 "무엇을 모았나 → **어떤 모델인가** → 무엇을 발견했나 → **그 결과를 어떻게 믿을 수 있나**" 순서로 읽게 한다.
- 지금 흐름의 가장 큰 구멍은 **모델 구조가 본문 어디에도 없다**는 것이다(③ 마지막 칸에 도구 이름 한 줄 `NeuralProphet · XGBoost · Optuna · 분위수 회귀 · SHAP`만 있다). ML 엔지니어 포트폴리오라 이 문단이 꼭 필요하다.
- ④ CHARTS는 "발견"(출발일·U자)과 "검증"(R² 거품·검증 설계·예측 구간·한계)이 한 섹션에 섞여 있다. 둘로 나눠 이야기의 매듭을 분명히 한다.

## 1. 사용자 결정 (2026-09-29)

| # | 정한 것 |
|---|---|
| 1 | ④를 **④ FINDINGS**(출발일별 가격, U자 예약 곡선)와 **⑤ VALIDATION**(R² 거품, 검증 설계, 예측 구간 보정, 한계와 다음 단계)으로 나눈다. 데모·연락처는 그 뒤에 그대로 |
| 2 | **③ 맨 앞에 모델 구조 문단**을 둔다. ③은 "모델과 피처"가 되고, 피처 와플은 문단 뒤에 그대로 |
| 3 | 모델을 위한 **새 점 연출은 지금 하지 않는다**(점 연출 아이디어 2번 "점이 추세선 + 잔차로 갈라짐"은 나중) |

## 2. 새 섹션 목록 (`src/lib/sections.ts`)

| 번호 | id | 머리표(세 언어 공통) | 제목(`h2`) ko / en / ja | 안에 든 것 |
|---|---|---|---|---|
| 01 | `project` | `01 — PROJECT` | (그대로) | 그대로 |
| 02 | `data` | `02 — DATA COLLECTION` | (그대로) | 그대로 |
| 03 | `features` | **`03 — MODEL & FEATURES`** | **모델 구조 / Model structure / モデルの構成** | **모델 카드(새)** → 피처 와플(그대로) |
| 04 | **`findings`** | **`04 — FINDINGS`** | 데이터가 보여 준 것 / What the data showed / データが示したこと (지금 `charts.heading` 그대로) | CHART 01 출발일 · CHART 02 U자 |
| 05 | **`validation`** | **`05 — VALIDATION`** | **모델 검증 / Checking the model / モデルの検証** (새 `charts.validationHeading`) | CHART 03 R² 거품 · 평가 방식 표 · CHART 04 예측 구간 · LIMITS |
| — | `demo`, `contact` | 번호 없음 | 그대로 | 그대로 |

- 머리표 제안: `MODEL & FEATURES`(옆 목차 낭독 "03 MODEL & FEATURES"). 더 짧게 가려면 `MODEL`도 가능하지만 와플이 그대로 있어 둘 다 드러나는 쪽을 권한다.
- ⑤ 안의 블록 머리표 `VALIDATION`(평가 방식 표)은 섹션 머리표 `05 — VALIDATION`과 같은 말이 겹친다 → 블록 머리표를 **`EVALUATION`** 으로 바꾸기를 제안한다(검토 때 사용자에게 함께 묻는다). 차트 번호 CHART 01~04는 페이지 전체에 이어 붙인 번호라 그대로 둔다.
- ③ 섹션 id는 `features` 그대로 둔다(주소 `#features`, e2e·움직임 테스트가 쓰는 `#features-h`를 살린다). ④·⑤ id는 새로 `findings`·`validation`. 옛 `#charts` 주소는 없어진다(외부에서 거는 링크 없음).
- 섹션 id `validation`과 장면 키 `validation`(평가 방식 표 블록)이 이름이 같지만 서로 다른 층이다 — 장면은 `data-scene`, 섹션은 `id`로만 찾으므로 충돌하지 않는다(`activeScene.ts`는 섹션 id를 보지 않는다).

## 3. 무엇이 어디로 옮겨 가나

### 3.1 부품

| 지금 | 바뀐 뒤 |
|---|---|
| `Charts.tsx`의 `Charts`(섹션 하나, `BLOCKS` 6개) | 같은 파일에서 블록 그리기(`renderBlock`)를 공유하는 **`Findings`**(블록 `depart`·`curve`)와 **`Validation`**(블록 `bubble`·`validation`·`band`·`limits`) 두 섹션. 머리(`.charts-head` + 머리표 + `h2`)는 두 섹션이 같은 모양 |
| `HomePage.tsx` `SECTION_VIEWS` `{ …, charts: Charts }` | `{ …, findings: Findings, validation: Validation }` (빠뜨리면 타입 오류 — 지금 구조 그대로) |
| `Features.tsx`: 그림 판 블록 하나(`data-scene="features"`), 글 상자 안에 머리표 + `h2#features-h`(`{model.featureCount} FEATURES`) + 세 칸(설명 · lookup 주의 · 모델·서비스 도구) | ① **모델 카드**(`.chapter`, `data-scene="model"`): 머리표 `03 — MODEL & FEATURES`, `h2#features-h`("모델 구조", `data-reveal`), 문단 두 개, 흐름 한 줄, 코드 보기(`v2_predictor.py`) ② **와플 블록**(그대로, `data-scene="features"`): 머리표 없이 `h3#waffle-h.display`(`{model.featureCount} FEATURES`), 세 칸 = 설명 · lookup 주의 · 서비스 도구(`features.serve`만). `features.model`(도구 이름 줄)은 모델 문단이 대신하므로 지운다 |

### 3.2 문구 키 (`content/{ko,en,ja}.json`, 세 언어 같은 키)

- 새 키: `features.structure.heading` · `features.structure.body1` · `features.structure.body2` · `features.structure.flow` · `charts.validationHeading`
- 지우는 키: `features.model`
- 그대로: `charts.heading`(④ 제목), `charts.<블록>.*` 전부, `features.heading`(와플 `h3`로 자리만 옮김), `features.lead`·`hint`·`lookupNote`·`serve`·`groups`·`unit`
- 블록 머리표(`CHART 01`·`VALIDATION`·`LIMITS` 등)는 코드 안 상수(세 언어 공통)다 — `VALIDATION` → `EVALUATION`은 `Charts.tsx`의 한 줄

### 3.3 facts·코드 링크

- 모델 문단이 쓰는 수치는 **모두 이미 있다**: `{model.featureCount}`(33), `{model.optunaTrials}`(100). 기본 초안은 새 수치를 쓰지 않는다.
- 새 코드 링크 장: `codeLinks.paths.model = "blob/main/src/models/v2_predictor.py"` — `data/facts.json`(손으로, `export_facts.py`는 `codeLinks`를 건드리지 않고 보존한다) + `src/lib/facts.ts`의 `chapters` 목록에 `'model'`.
- (선택안) 문단에 분위수 이름 `q10`·`q90`을 숫자로 쓰고 싶으면 문구에 숫자를 직접 쓸 수 없으므로 새 수치 `model.interval.qLow`(10)·`model.interval.qHigh`(90)가 필요하다. 모델 수치의 원본은 `scripts/model_metrics.json`이고 `scripts/export_facts.py`가 그 내용을 `facts.json`의 `model`에 그대로 옮긴다 — 더할 곳은 `model_metrics.json` · `src/lib/facts.ts`(zod 스키마) · `data/facts.json`(또는 `npm run facts`로 다시 생성), `export_facts.py` 코드 변경은 필요 없다(`scripts/tests/test_export_facts.py`가 키를 고정 검사하면 거기도). 기본안은 "아래쪽·위쪽 분위수"라고 말로 풀어 이 추가를 피한다.

### 3.4 3D 장면 키와 자막

- 장면은 섹션이 아니라 **블록의 `data-scene`** 으로 고른다(`src/three/activeScene.ts`: 화면 세로 가운데에 걸친 `[data-scene]` 중 가장 짧은 것). 블록의 `data-scene` 값(`chartDepart`·`chartCurve`·`bubble`·`validation`·`chartCloud`·`limits`)은 그대로 옮기므로 **④·⑤로 나눠도 장면 대응은 바뀌지 않는다**. 차트 장면 네 개(`features`·`chartDepart`·`chartCurve`·`chartCloud`)와 판 위치 추적(`[data-scene="X"] .chart-stage`)도 그대로다.
- **머리 사이 빈 구간**: 섹션 머리(`.charts-head`)에는 `data-scene`이 없어 그 화면에서는 활성 장면이 없고, `TerrainScene`은 직전 목표를 유지한다. 지금도 ④ 머리가 와플(차트 장면) 뒤에 이렇게 있다. 새 ⑤ 머리는 CHART 02(차트 장면 `chartCurve`) 뒤, CHART 03(`bubble`, 지형 장면) 앞에 온다 — 점은 U자 배치 그대로 판을 따라 위로 빠져나가고(`shiftKey`가 마지막 판을 따라감), ⑤ 머리를 지나 `bubble`이 가운데 오면 지형으로 풀린다. 눈 확인과 글 대비 화소 검사(`#validation-h`)로 확인한다.
- **모델 카드 장면 `model`(새 장면 키, 지형 장면)**: 모델 문단은 "출발일별 가격 흐름"을 말하므로 그 가격 지형(가로 = 남은 일수, 깊이 = 출발일, 높이 = 가격)을 조용히 보여 준다. 새 점 연출은 없고 카메라 자리 하나뿐이다. 처음 값은 `limits`와 같은 구도(데스크톱 `camera [-5, 12, 26]`·`target [-5, 0, 0]`, 세로 화면 `camera [0, 9, 26]`·`target [0, -3, 0]` + 1.6배 물러남), `noise 0.5` — 글 대비 화소 검사를 통과하는 값으로 눈 확인 때 맞춘다. 흐름: ② 보드(흐린 지도) → ③ 모델(지형) → ③ 와플(차트). 대체 이미지(`ChapterFigure`)는 두지 않는다(3D 꺼짐이면 글만).
  - 대안(더 작게): 모델 카드에 `data-scene`을 두지 않아 ② 보드 장면(흐린 지도)이 이어지게 할 수도 있다. 장면 코드가 전혀 안 바뀌지만, 모델 문단 뒤에 지도가 남아 내용과 어긋난다 — 기본안은 `model` 장면.
- **자막 띠**(`motion/caption.ts`)는 `.chart-block`만 다룬다. 모델 카드는 `.chapter`라 자막 대상이 아니고, 와플 블록의 칸 수(`--paras` 3)는 그대로다.

## 4. 모델 구조 — 조사한 사실 (항공권 저장소, 코드 기준)

| 항목 | 사실 | 근거 |
|---|---|---|
| 전체 구조 | 노선별 NeuralProphet 기준 가격 × 등급 수준 비율 → 그 위에 XGBoost가 로그 잔차를 예측. `예측가 = expm1(log1p(기준 가격) + 로그 잔차)` | `src/models/v2_predictor.py` `predict_optimal_timing` 3)~5), `train_and_save` [6]~[7] |
| NeuralProphet 입력 | 출발일(`departure_date`)별 **평균 가격** 한 줄(빈 날은 시간 보간). 예약 시점·항공사는 넣지 않는다 | `src/models/np_baseline.py` `_make_daily` |
| NeuralProphet 구성 | 추세 + **요일 주기**(weekly, multiplicative). 연·일 주기 없음, 공휴일·lag·외부 변수 없음. epochs 120, lr 0.02, 시드 고정 | `np_baseline.py` `_fit_single_np` |
| 노선별 | 행 수 상위 `TOP_ROUTES_FOR_NP = 6`개 노선마다 따로(= 6개 노선 전부) + 전 노선 합친 글로벌 모델(노선 모델이 없을 때 대신) | `np_baseline.py` `fit_np_models`, `np_baseline_for_route` |
| 등급 보정 | `(노선, 등급)` 평균 ÷ 노선 평균 비율을 기준 가격에 곱한다(평균 기반 — 중앙값이면 기준 가격이 부풀어서) | `v2_predictor.py` `_compute_class_level_ratio` |
| XGBoost 목표 | `log1p(실제 가격) − log1p(기준 가격)` = 로그 잔차. 피처 33개(수치 15 · 범주형 5 · lookup 13, 구성 A_rah) | `train_and_save` [6]·[7], 항공권 저장소 `CLAUDE.md` "피처 구성" |
| Optuna | **XGBoost 잔차 모델만** 튜닝(NeuralProphet은 한 번 학습 후 고정). TPE 표본기, **100 trials**, TimeSeriesSplit 5겹의 **가격 단위 R² 평균을 최대화**. 조정하는 값 9개: n_estimators, learning_rate, max_depth, subsample, colsample_bytree, min_child_weight, gamma, reg_alpha, reg_lambda | `src/models/tune_v2.py` `objective`, `main` |
| 예측 구간 | 같은 로그 잔차에 **XGBoost 분위수 회귀** 두 개(`reg:quantileerror`, α 0.10 / 0.90)를 따로 학습 → Conformal(CQR) 여백을 더한다 | `train_and_save` [7-b] |
| 구간 보정(분포 이동 외삽) | 보정셋에서 여백을 레벨별로 구하고, 독립된 최근 구간을 반으로 나눠 앞 절반에서 `2 × 커버리지 − 레벨 ≥ 80%`(떨어진 폭이 다음 구간에도 반복된다는 선형 외삽)를 만족하는 가장 낮은 레벨을 고른다 → 뒤 절반(가장 최근)으로 검증. 지금 pkl: 레벨 90%, 여백 0.118, 검증 커버리지 80.2% | `train_and_save` [7-b], 항공권 저장소 `CLAUDE.md` "예측 구간" |
| SHAP | 서비스 pkl의 XGBoost 잔차 모델을 재학습 없이 TreeSHAP(`pred_contribs`). 값은 로그 잔차 단위 = "이 편이 기준 가격에서 왜 벗어났나" | `src/models/shap_analysis.py`, 항공권 저장소 `README.md` "모델 해석 (SHAP)" |

사이트 `facts.json`에 이미 있는 것: `model.featureCount`(33), `model.optunaTrials`(100), `model.interval.level`(80) · `coverage`(80.2) · `driftLow`(69), `data.routes`(6). 없는 것(쓰려면 새 수치): 분위수 α(10·90), 고른 레벨(90)·여백(0.118), 튜닝 값 개수(9), 검증 겹 수(5). 기본 초안은 이것들을 쓰지 않는다 — 예측 구간 보정 이야기는 ⑤ CHART 04(`charts.band`)에 이미 있다.

## 5. 모델 카드 문구 초안

### 5.1 한국어 (Claude 초안 — 사용자 검토 필요)

- `features.structure.heading`: **모델 구조**
- `features.structure.body1`: 노선마다 NeuralProphet이 출발일별 평균 가격의 흐름(추세와 요일 주기)을 배우고, 등급별 가격 수준을 곱해 기준 가격을 만듭니다. XGBoost는 피처 {model.featureCount}개로 실제 가격이 이 기준에서 얼마나 벗어나는지를 로그 단위로 배우고, 둘을 더한 값이 예측가입니다.
- `features.structure.body2`: XGBoost 설정은 Optuna로 {model.optunaTrials}번 시도해 시간순 검증에서 가장 좋은 것을 골랐습니다. 같은 잔차에 아래쪽·위쪽 분위수 모델을 따로 학습해 예측 구간을 내고, 피처별 기여는 SHAP으로 나눠 봅니다.
- `features.structure.flow`(작은 고정폭 한 줄, 그림 대신): `기준 가격 (노선별 NeuralProphet × 등급 수준) + 벗어난 몫 (XGBoost, 로그 단위) = 예측가`

쓰는 수치: `{model.featureCount}`, `{model.optunaTrials}` — 둘 다 이미 있다. 숫자 직접 기입 없음(`q10` 같은 표기도 쓰지 않음).

### 5.2 English (검토 전)

- heading: **Model structure**
- body1: For each route, NeuralProphet learns how the average fare moves across departure dates (trend and weekly cycle), and scaling it by each cabin class's price level gives a base price. XGBoost then uses {model.featureCount} features to learn how far the actual fare sits from that base on a log scale; the two added together are the prediction.
- body2: The XGBoost settings were chosen from {model.optunaTrials} Optuna trials by their score on time-ordered validation. Separate lower and upper quantile models on the same residual give the prediction interval, and SHAP splits each prediction into per-feature contributions.
- flow: `Base price (NeuralProphet per route × cabin level) + deviation (XGBoost, log scale) = prediction`

### 5.3 日本語 (검토 전)

- heading: **モデルの構成**
- body1: 路線ごとに NeuralProphet が出発日別の平均価格の流れ（トレンドと曜日の周期）を学び、クラスごとの価格水準を掛けて基準価格を作ります。XGBoost は {model.featureCount} 個の特徴量で、実際の価格がこの基準からどれだけずれるかを対数で学び、両者を足したものが予測価格です。
- body2: XGBoost の設定は Optuna で {model.optunaTrials} 回試し、時系列順の検証で最も良いものを選びました。同じ残差に下側・上側の分位点モデルを別に学習して予測区間を出し、特徴量ごとの寄与は SHAP で分けて見ます。
- flow: `基準価格（路線別 NeuralProphet × クラス水準）+ ずれ（XGBoost・対数）= 予測価格`

### 5.4 ⑤ 제목

- `charts.validationHeading`: ko **모델 검증** / en **Checking the model** / ja **モデルの検証** (검토 전 — ko도 사용자 확인)

## 6. 접근성·성능·테스트에 닿는 것

- 제목 순서: ③ `h2`(모델 구조) → `h3`(33 FEATURES, 와플). ④·⑤는 각자 `h2` + 블록 `h3`. 섹션마다 `aria-labelledby`.
- 옆 목차는 5개로 늘어난다(`SideNav`는 섹션 목록에서 저절로). 휴대폰은 지금처럼 숨김.
- 초기 JS: 섹션 부품은 서버 부품이라 문구만 늘어난다. `sections.ts`는 옆 목차(클라이언트)가 읽지만 줄 하나 더하는 정도. 3D 청크는 장면 표 한 줄.
- 테스트가 바뀌는 곳: `tests/unit/sections.test.ts`(id·번호·머리표), `tests/unit/three-scenes.test.ts`(`KEYS`에 `model`), `tests/e2e/site.spec.ts`(`#charts` → `#findings`·`#validation`, 블록 개수 2·4, JS 없이 `#validation table`), `tests/e2e/terrain.spec.ts`(`#charts-h` → `#findings-h`·`#validation-h`, 모델 카드 문단 대비), `tests/e2e/board.spec.ts`(옆 목차 링크 이름 `03 MODEL & FEATURES`). `motion.spec.ts`의 `#features-h`는 모델 카드 `h2`로 살아 있다.

## 사용자 확인 (2026-09-30)

- ③ 모델 카드 한국어 초안 **그대로 확정**. 영·일은 같은 뜻·톤으로 확정해도 된다(검수는 공개 전 문구 검토 때).
- ⑤ 안 검증 표 블록 머리표 `VALIDATION` → **`EVALUATION`**.
