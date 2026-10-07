"""public/data/charts.<기준일>.json을 만든다 — ④ 차트 중 출발일 점 그래프(차트 1)과 구간별 분포 벌떼(차트 2)의 데이터.
(설계 2026-09-25 §3.4·§5, 2026-09-27 개정)

- depart: 출발일마다 노선·등급 평균 대비 %(지형과 같은 정의, export_terrain 재사용)와 공휴일 코드(±3일).
- labels: 점 그래프의 봉우리 위에 이름을 붙일 공휴일. 공휴일(코드)마다 가장 비싼 출발일을 고르고, 그 값이 큰 순으로 4개.
- curve: 출발이 지난 편의 예약 곡선 8구간 평균·행 수(model_metrics.json의 bookingCurve와 같아야 한다)와
  관측 표본 4,000개(구간 번호, 같은 편 평균 대비 %). 점 개수는 데이터가 늘어도 고정이고, 재추출 때 새로 뽑는다(설계 §4).
- shap: ③ 와플 펼치기(계획 5-3c) — 서비스 모델 XGBoost의 피처별 SHAP(×1000 정수)과 피처 값 순위(0~100), 표본 150개.
- model: ③ 모델 구조 점(계획 7-2) — 인천→나리타 LCC 관측 표본(출발일마다 12개, 노선·등급 평균 대비 %×10)과
  서비스 모델의 NeuralProphet 기준 가격(같은 평균 대비 %×10, 출발일별). 잔차는 사이트가 두 값으로 계산한다.
- filter: ② 걸러내기(계획 8-1) — 기준일까지의 원본 행 표본 4,000개(실제 비율 그대로)의 소요 분, 정상 행의 노선·등급
  평균 대비 %×10, 걸린 규칙 번호(0 통과, 1 단위·소요, 2 시각 불일치, 3 직항 확인).
- split: ⑤ 검증 설계(계획 8-1) — 정상 행을 수집 시각 순으로 정렬해 K-Fold·GroupKFold·TimeSeriesSplit(각 5겹) 폴드를 전체에서
  배정한 뒤 표본 4,000개의 수집일 번호·출발일 번호·폴드 번호. 모델 재학습은 없다.
- 개별 행의 가격은 내보내지 않는다(원본 비공개 원칙). 표본에도 %만 담는다.

실행: npm run charts  (npm run terrain 뒤 — 출발일 목록이 지형과 같아야 3D 점 그래프가 지형 점을 출발일로 묶을 수 있다)
"""
from __future__ import annotations

import functools
import gzip
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
import export_terrain as et  # noqa: E402  (export_facts를 거쳐 항공권 저장소를 sys.path에 넣는다)
from export_demo import holiday_codes, load_holidays, quiet  # noqa: E402
from export_facts import (  # noqa: E402
    AIRFARE_ROOT, DURATION_MAX, METRICS_PATH, PRICE_FLOOR, drop_implausible_direct_flights, drop_inconsistent_flight_times,
    refresh_derived,
)

ROOT = Path(__file__).resolve().parents[1]
MAX_GZIP_BYTES = 150 * 1024   # 설계 §4 charts.json 예산
SAMPLE_SIZE = 16000           # 차트 2 관측 점 개수(고정) — 배경 표본 밀도(설계 2026-10-07): 점을 작게 해 칸 모양이 남는다
SAMPLE_CLIP = 40.0            # 표본 %는 ±40에서 자른다(화면은 ±22만 그린다 — 값이 큰 몇 개가 파일만 키우지 않게)
TOP_LABELS = 4                # 점 그래프에서 봉우리 바로 위에 이름을 붙이므로 한글날까지(설계 2026-09-29 §2)
SEED = 7
CURVE_TOLERANCE = 0.1         # 지표는 소수 첫째 자리, 사이트 값은 %×10 정수라 반올림 차이만 허용
SHAP_SAMPLE = 150             # ③ SHAP 벌떼 표본 수(계획 5-3c) — 피처 33개 × 150점
CATEGORICAL = ["origin", "destination", "route", "airline", "airline_class"]
MODEL_ROUTE = "ICN_NRT"       # ③ 모델 구조 점(계획 7-2) — ⑤ 불확실성 구름과 같은 조합
MODEL_CABIN = "LCC"
MODEL_PER_DATE = 48           # 출발일마다 관측 점 개수 — 배경 표본 밀도(설계 2026-10-07, 이전 12에서 4배)
MODEL_RESID_HOT = 50.0        # 큰 잔차(|%|) — 사이트 src/charts/model.ts MODEL.residHot과 같은 값(출력 확인용)
FILTER_SAMPLE = 8000          # ② 걸러내기 점 개수(계획 8-1, 설계 2026-10-07에서 두 배) — 실제 비율 그대로라 규칙 ②는 20여 개뿐이다(부풀리지 않는다)
SPLIT_SAMPLE = 8000           # ⑤ 검증 설계 점 개수(설계 2026-10-07에서 두 배)
N_FOLDS = 5                   # 항공권 저장소 tscv_eval_v2.py와 같은 5겹


def depart_pct10(kept: pd.DataFrame, dates: list[str]) -> list[int]:
    """출발일별 평균 pct(%×10 정수). kept에는 add_route_class_pct가 붙인 pct 열이 있어야 한다."""
    mean = kept.groupby("departure_date")["pct"].mean()
    return [int(round(float(mean[d]) * 10)) for d in dates]


def holiday_labels(dates: list[str], pct10: list[int], codes: dict[str, str], top: int = TOP_LABELS) -> list[dict]:
    """공휴일(코드)마다 가장 비싼 출발일 하나 → 값이 큰 순으로 top개 → 날짜순.
    왜 코드별로 묶나: 한 연휴의 출발일 여러 개가 이름표를 나눠 가지면 가장 큰 봉우리들을 다 못 보여 준다."""
    best: dict[str, tuple[int, str]] = {}
    for d, p in zip(dates, pct10):
        c = codes.get(d)
        if c is not None and (c not in best or p > best[c][0]):
            best[c] = (p, d)
    picked = sorted(best.items(), key=lambda kv: -kv[1][0])[:top]
    return sorted(({"date": d, "code": c} for c, (_, d) in picked), key=lambda x: x["date"])


def curve_bins(daily: pd.DataFrame) -> dict:
    """예약 곡선 8구간(export_terrain.CURVE_BINS)의 경계·평균(%×10)·행 수."""
    cur = et.booking_curve_buckets(daily)
    edges = et.CURVE_BINS
    return {
        "bins": [[edges[i] + 1, edges[i + 1]] for i in range(len(edges) - 1)],
        "mean": [int(round(float(v) * 10)) for v in cur["pct"]],
        "n": [int(v) for v in cur["n"]],
    }


def curve_sample(daily: pd.DataFrame, size: int = SAMPLE_SIZE, seed: int = SEED) -> dict:
    """관측 표본: 행을 무작위로 뽑아 구간 번호와 %×10을 담는다. 가까운 출발일은 매일 수집이라 행이 많으므로
    무작위로 뽑으면 점 밀도가 실제 관측 밀도를 그대로 따른다."""
    x = et._centre_log_price(daily)
    x["bin"] = pd.cut(x["dtd"], et.CURVE_BINS, labels=False)
    x = x.dropna(subset=["bin"])
    take = x.sample(n=min(size, len(x)), random_state=seed)
    pct = (np.expm1(take["lp_c"]) * 100).clip(-SAMPLE_CLIP, SAMPLE_CLIP)
    return {"bin": take["bin"].astype(int).tolist(), "pct": (pct * 10).round().astype(int).tolist()}


def check_curve(curve: dict, metrics: dict) -> None:
    """사이트의 구간 평균이 사이트 문구가 쓰는 지표(model_metrics.json bookingCurve)와 같은지 확인한다."""
    want = [b["pct"] for b in metrics["bookingCurve"]]
    got = [m / 10 for m in curve["mean"]]
    if len(got) != len(want) or any(abs(g - w) > CURVE_TOLERANCE for g, w in zip(got, want)):
        raise SystemExit(f"예약 곡선 구간 평균이 model_metrics.json과 다르다 — 사이트 {got}, 지표 {want}")


def value_rank(col: pd.Series) -> list[int]:
    """피처 값 → 표본 안 조밀 순위를 0~100으로 편 값. 같은 값은 같은 순위, 서로 다른 값 사이를 고르게 —
    0/1 피처가 파랑/호박으로 갈리게(평균 순위면 다수 값이 중간 회색에 앉는다). 원값 대신 순위를 내보내
    원본을 공개하지 않고, 치우친 분포도 색이 고르게 퍼진다(설계 2026-09-30 §2).
    NaN은 가장 작은 값으로 둔다(순위 0, 나머지는 한 칸씩 위로) — 모델 입력의 NaN은 days_bucket_num의
    D-0(당일 출발)뿐으로, pd.cut 첫 구간 (0, 7]보다 작아서 생긴다(XGBoost는 결측으로 그대로 받는다).
    표본 안에서 값이 하나뿐인 피처(예: global_med)는 크고 작음이 없으므로 범주형처럼 모두 50(중간색)."""
    if col.nunique(dropna=False) <= 1:
        return [50] * len(col)
    dense = col.rank(method="dense", na_option="top")
    n_distinct = int(dense.max()) if len(dense) else 1
    r = (dense - 1) / max(n_distinct - 1, 1) * 100
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


@functools.lru_cache(maxsize=1)
def service_model():
    """서비스 모델(v2_predictor.pkl) → (xgb_model, 피처 이름, predictor). 로드가 약 17초라 SHAP과 기준 가격이 한 번만 부른다."""
    from src.models.feature_importance import load_pkl_model
    with quiet():
        return load_pkl_model()


def compute_shap(kept: pd.DataFrame, size: int = SHAP_SAMPLE, seed: int = SEED) -> dict:
    """기준일까지의 정상 행에 학습 때와 같은 피처 함수를 붙이고 표본을 뽑아, 서비스 모델(v2_predictor.pkl)의
    XGBoost로 TreeSHAP을 계산한다(재학습 없음). 항공권 저장소 src/models/shap_analysis.py와 같은 경로:
    lookup → 전처리 → booster.predict(pred_contribs=True). shap.TreeExplainer는 XGBoost 2.x base_score
    파싱 버그가 있어 쓰지 않는다(그쪽 주석). 모델 로드는 약 17초, NeuralProphet 로그는 quiet()로 막는다."""
    import xgboost as xgb
    from src.models.tscv_eval_v2 import (add_days_features, add_jp_holiday_features,
                                         add_kr_holiday_features, add_market_features)

    df = kept.copy()
    for step in (add_market_features, add_jp_holiday_features, add_kr_holiday_features, add_days_features):
        df = step(df)
    df["route"] = df["origin"].astype(str) + "_" + df["destination"].astype(str)
    df["departure_date"] = pd.to_datetime(df["departure_date"])
    take = df.sample(n=min(size, len(df)), random_state=seed).reset_index(drop=True)
    model, names, predictor = service_model()
    with quiet():
        enc = pd.DataFrame(predictor.preprocessor.transform(predictor._apply_lookup(take)), columns=names)
    contribs = model.get_booster().predict(xgb.DMatrix(enc.values), pred_contribs=True)
    # 기여의 합 = 모델 출력(log 잔차)이어야 한다 — 인코딩 경로가 서비스와 어긋나면 여기서 멈춘다
    pred = model.predict(enc.values)
    if not np.allclose(contribs.sum(axis=1), pred, atol=1e-3):
        raise SystemExit("SHAP 합이 모델 출력과 다르다 — 인코딩 경로를 확인한다")
    return shap_block(contribs, enc, CATEGORICAL)


def route_rows(kept: pd.DataFrame, route: str, cabin: str) -> pd.DataFrame:
    """한 노선("ICN_NRT")·등급의 행."""
    origin, dest = route.split("_")
    return kept[(kept["origin"] == origin) & (kept["destination"] == dest) & (kept["airline_class"] == cabin)]


def model_obs(sub: pd.DataFrame, dates: list[str], per_date: int = MODEL_PER_DATE, seed: int = SEED) -> dict:
    """한 노선·등급 행(pct 열 있음) → 출발일마다 최대 per_date개 관측(charts.dates 번호, %×10), 출발일 순.
    섞은 뒤 출발일마다 앞에서 자른다 — groupby().sample(n)은 행이 n보다 적은 날에 실패한다."""
    index = {d: i for i, d in enumerate(dates)}
    take = sub.sample(frac=1, random_state=seed).groupby("departure_date", sort=False).head(per_date)
    take = take.assign(di=take["departure_date"].map(index)).sort_values("di", kind="stable")
    return {"date": take["di"].astype(int).tolist(), "pct": (take["pct"] * 10).round().astype(int).tolist()}


def baseline_pct10(base_price: dict[str, float], mean_price: float, dates: list[str]) -> list[int | None]:
    """출발일별 기준 가격(원) → 노선·등급 평균 대비 %×10. 기준이 없거나 0 이하인 출발일은 None.
    원 단위 값은 내보내지 않는다(데이터 공개 원칙) — 관측 %와 같은 평균으로 나눈 %만."""
    out: list[int | None] = []
    for d in dates:
        b = base_price.get(d)
        ok = b is not None and bool(np.isfinite(b)) and b > 0
        out.append(int(round((b / mean_price - 1) * 1000)) if ok else None)
    return out


def model_block(sub: pd.DataFrame, dates: list[str], base_price: dict[str, float], route: str, cabin: str) -> dict:
    """charts.json의 model. 평균은 add_route_class_pct가 붙인 base 열(그 노선·등급 정상 행의 평균) —
    관측 %·지형 높이와 같은 기준이라 사이트가 두 %로 잔차를 바로 만든다."""
    mean = float(sub["base"].iloc[0])
    return {"route": route, "cabin": cabin, "base": baseline_pct10(base_price, mean, dates), "obs": model_obs(sub, dates)}


def build_charts(raw: pd.DataFrame, as_of: str) -> dict:
    kept, removed = et.split_rows(raw, as_of)
    daily = et.load_completed_daily(kept, as_of)  # 원가 기준(노선·등급 pct를 붙이기 전) — export_terrain과 같은 순서
    kept, _ = et.add_route_class_pct(kept, removed)
    dates = sorted(kept["departure_date"].unique().tolist())
    pct10 = depart_pct10(kept, dates)
    codes = holiday_codes(dates, load_holidays(dates))
    curve = curve_bins(daily)
    curve["sample"] = curve_sample(daily)
    return {
        "asOf": as_of,
        "dates": dates,
        "depart": {"pct": pct10, "holiday": [codes.get(d) for d in dates]},
        "labels": holiday_labels(dates, pct10, codes),
        "curve": curve,
    }


def compute_model_baseline(route: str, cabin: str, dates: list[str]) -> dict[str, float]:
    """서비스 모델의 NeuralProphet 기준 가격(원)을 출발일별로. V2Predictor.predict_optimal_timing의 3단계와 같은 계산 —
    노선 NP 추세(np_baseline_for_route) × (노선, 등급) 수준 비율, 값이 없거나 0 이하면 유효 값의 중앙값. 재학습 없음."""
    from src.models.np_baseline import np_baseline_for_route
    _, _, p = service_model()
    with quiet():
        base = np_baseline_for_route(p.np_models, p.np_dailies, route, pd.Series(pd.to_datetime(dates)))
    base = np.asarray(base, dtype=float) * p.class_level_ratio.get((route, cabin), 1.0)
    ok = np.isfinite(base) & (base > 0)
    if not ok.any():
        raise SystemExit(f"{route}/{cabin} NeuralProphet 기준 가격이 하나도 없다")
    base = np.where(ok, base, float(np.median(base[ok])))
    return dict(zip(dates, base.tolist()))


def compute_model(kept: pd.DataFrame, removed: pd.DataFrame, dates: list[str]) -> dict:
    """③ 모델 구조 점: 노선·등급 평균 대비 %를 붙이고(지형과 같은 정의) 인천→나리타 LCC만 골라 표본과 기준 %를 만든다."""
    kept, _ = et.add_route_class_pct(kept, removed)
    sub = route_rows(kept, MODEL_ROUTE, MODEL_CABIN)
    base = compute_model_baseline(MODEL_ROUTE, MODEL_CABIN, sorted(sub["departure_date"].unique().tolist()))
    return model_block(sub, dates, base, MODEL_ROUTE, MODEL_CABIN)


def rule_codes(cut: pd.DataFrame) -> pd.Series:
    """기준일까지 자른 원본 행마다 걸린 규칙 번호(0 통과, 1 단위·소요, 2 시각 불일치, 3 직항 확인).
    export_facts.filter_steps·export_terrain.split_rows와 같은 순서 — 앞 규칙에 걸린 행은 뒤 규칙으로 세지 않는다."""
    code = pd.Series(0, index=cut.index)
    r1 = ~(cut["duration_minutes"].notna() & (cut["duration_minutes"] <= DURATION_MAX)) | ~(cut["price"] >= PRICE_FLOOR)
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


def main() -> None:
    metrics = json.loads(METRICS_PATH.read_text(encoding="utf-8"))
    as_of = metrics["_meta"]["asOf"]
    raw = pd.read_csv(AIRFARE_ROOT / "data" / "raw" / "flight_prices.csv")
    charts = build_charts(raw, as_of)
    kept, removed = et.split_rows(raw, as_of)
    charts["shap"] = compute_shap(kept)
    charts["model"] = compute_model(kept, removed, charts["dates"])
    charts["filter"] = filter_block(raw, as_of)
    charts["split"] = split_block(kept, charts["dates"])
    check_shap_features(charts["shap"]["features"], json.loads((ROOT / "data" / "facts.json").read_text(encoding="utf-8")))
    check_curve(charts["curve"], metrics)
    terrain = json.loads((ROOT / "public" / "data" / f"terrain.{as_of}.json").read_text(encoding="utf-8"))
    if terrain["dates"] != charts["dates"]:
        raise SystemExit("출발일 목록이 terrain.json과 다르다 — npm run terrain을 먼저 돌린다")
    body = json.dumps(charts, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    size = len(gzip.compress(body))
    if size > MAX_GZIP_BYTES:
        raise SystemExit(f"charts.json gzip {size:,}B > 목표 {MAX_GZIP_BYTES:,}B — SAMPLE_SIZE를 줄인다")
    out = ROOT / "public" / "data" / f"charts.{as_of}.json"
    out.write_bytes(body)
    # facts.json의 insight(④ 제목 수치)는 이 출발일 %에서 계산한다 — 갱신 순서가 facts → charts라 여기서 한 번 더 맞춘다
    refresh_derived(charts)
    print(f"{out.name}: 출발일 {len(charts['dates'])}개, 이름표 {[l['code'] for l in charts['labels']]}, "
          f"표본 {len(charts['curve']['sample']['pct'])}개, gzip {size:,}B"
          f", SHAP {len(charts['shap']['features'])}×{charts['shap']['n']}")
    m = charts["model"]
    # 기준이 없는 출발일의 관측은 잔차를 만들 수 없으니 요약에서 뺀다(None이면 계산이 TypeError)
    resid = [((1 + o / 1000) / (1 + m["base"][d] / 1000) - 1) * 100
             for d, o in zip(m["obs"]["date"], m["obs"]["pct"]) if m["base"][d] is not None]
    hot = sum(abs(r) >= MODEL_RESID_HOT for r in resid) / len(resid)
    print(f"model {m['route']}/{m['cabin']}: 관측 {len(resid)}개, 기준 {sum(b is not None for b in m['base'])}일, "
          f"|잔차| ≥ {MODEL_RESID_HOT:.0f}% {hot:.1%}")

    f, sp = charts["filter"], charts["split"]
    print(f"filter: 표본 {len(f['rule'])}개, 규칙별 {[f['rule'].count(r) for r in range(4)]}, "
          f"960분 초과 {sum(d > 960 for d in f['dur'])}개 / split: 표본 {len(sp['tss'])}개, 수집 {sp['fetchDays']}일, "
          f"TSS 첫 학습 구간 {sp['tss'].count(-1)}개")


if __name__ == "__main__":
    main()
