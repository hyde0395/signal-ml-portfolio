"""public/data/charts.<기준일>.json을 만든다 — ④ 차트 중 출발일 점 그래프(차트 1)과 구간별 분포 벌떼(차트 2)의 데이터.
(설계 2026-09-25 §3.4·§5, 2026-09-27 개정)

- depart: 출발일마다 노선·등급 평균 대비 %(지형과 같은 정의, export_terrain 재사용)와 공휴일 코드(±3일).
- labels: 점 그래프의 봉우리 위에 이름을 붙일 공휴일. 공휴일(코드)마다 가장 비싼 출발일을 고르고, 그 값이 큰 순으로 4개.
- curve: 출발이 지난 편의 예약 곡선 8구간 평균·행 수(model_metrics.json의 bookingCurve와 같아야 한다)와
  관측 표본 4,000개(구간 번호, 같은 편 평균 대비 %). 점 개수는 데이터가 늘어도 고정이고, 재추출 때 새로 뽑는다(설계 §4).
- shap: ③ 와플 펼치기(계획 5-3c) — 서비스 모델 XGBoost의 피처별 SHAP(×1000 정수)과 피처 값 순위(0~100), 표본 150개.
- 개별 행의 가격은 내보내지 않는다(원본 비공개 원칙). 표본에도 %만 담는다.

실행: npm run charts  (npm run terrain 뒤 — 출발일 목록이 지형과 같아야 3D 점 그래프가 지형 점을 출발일로 묶을 수 있다)
"""
from __future__ import annotations

import gzip
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
import export_terrain as et  # noqa: E402  (export_facts를 거쳐 항공권 저장소를 sys.path에 넣는다)
from export_demo import holiday_codes, load_holidays  # noqa: E402
from export_facts import AIRFARE_ROOT, METRICS_PATH  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
MAX_GZIP_BYTES = 150 * 1024   # 설계 §4 charts.json 예산
SAMPLE_SIZE = 4000            # 차트 2 관측 점 개수(고정)
SAMPLE_CLIP = 40.0            # 표본 %는 ±40에서 자른다(화면은 ±22만 그린다 — 값이 큰 몇 개가 파일만 키우지 않게)
TOP_LABELS = 4                # 점 그래프에서 봉우리 바로 위에 이름을 붙이므로 한글날까지(설계 2026-09-29 §2)
SEED = 7
CURVE_TOLERANCE = 0.1         # 지표는 소수 첫째 자리, 사이트 값은 %×10 정수라 반올림 차이만 허용
SHAP_SAMPLE = 150             # ③ SHAP 벌떼 표본 수(계획 5-3c) — 피처 33개 × 150점
CATEGORICAL = ["origin", "destination", "route", "airline", "airline_class"]


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
    D-0(당일 출발)뿐으로, pd.cut 첫 구간 (0, 7]보다 작아서 생긴다(XGBoost는 결측으로 그대로 받는다)."""
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


def main() -> None:
    metrics = json.loads(METRICS_PATH.read_text(encoding="utf-8"))
    as_of = metrics["_meta"]["asOf"]
    raw = pd.read_csv(AIRFARE_ROOT / "data" / "raw" / "flight_prices.csv")
    charts = build_charts(raw, as_of)
    kept, _ = et.split_rows(raw, as_of)
    charts["shap"] = compute_shap(kept)
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
    print(f"{out.name}: 출발일 {len(charts['dates'])}개, 이름표 {[l['code'] for l in charts['labels']]}, "
          f"표본 {len(charts['curve']['sample']['pct'])}개, gzip {size:,}B"
          f", SHAP {len(charts['shap']['features'])}×{charts['shap']['n']}")


if __name__ == "__main__":
    main()
