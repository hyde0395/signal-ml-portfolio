"""data/facts.json의 dataVersion·data·model 영역을 항공권 저장소 기준으로 갱신한다.

- data: 원본 CSV를 기준일(asOf)까지 자르고, 항공권 저장소의 학습용 필터를 그대로 적용해 센다.
- model: scripts/model_metrics.json(항공권 저장소 CLAUDE.md에서 옮긴 값)을 그대로 쓴다.
- 나머지 키(profile, contact, codeLinks 등)는 손대지 않는다.

실행: npm run facts   (AIRFARE_ROOT 기본값 ~/Documents/airfare-forecasting-ml)
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
FACTS_PATH = ROOT / "data" / "facts.json"
METRICS_PATH = ROOT / "scripts" / "model_metrics.json"
AIRFARE_ROOT = Path(os.environ.get("AIRFARE_ROOT", Path.home() / "Documents" / "airfare-forecasting-ml"))

sys.path.insert(0, str(AIRFARE_ROOT))
from src.processing.constants import DURATION_MAX, PRICE_FLOOR  # noqa: E402
from src.processing.features import (  # noqa: E402
    drop_implausible_direct_flights,
    drop_inconsistent_flight_times,
)


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


def route_pairs(df: pd.DataFrame) -> pd.Series:
    """노선별 행 수(왕복 합침). 모든 노선이 인천 출발·도착이라 인천(ICN)을 앞에 둔 이름으로 묶는다."""
    pair = [f"ICN_{d if o == 'ICN' else o}" for o, d in zip(df["origin"].astype(str), df["destination"].astype(str))]
    return pd.Series(pair, dtype=object).value_counts()


def compute_data_stats(raw: pd.DataFrame, as_of: str) -> dict:
    # as_of 자정 다음날 자정 이전까지만(= as_of 당일 끝까지 포함) 남긴다. 수집이 계속 진행 중인
    # 원본 CSV에서 이후에 더 쌓인 행이 섞이면 model_metrics.json이 학습했던 시점과 어긋난다.
    cutoff = pd.Timestamp(as_of) + pd.Timedelta(days=1)
    raw = raw[pd.to_datetime(raw["fetch_timestamp"]) < cutoff]
    df, counts = filter_steps(raw)
    fetch = pd.to_datetime(df["fetch_timestamp"])
    dep = pd.to_datetime(df["departure_date"])
    routes = (df["origin"].astype(str) + "_" + df["destination"].astype(str)).nunique()
    # 걸러낸 뒤 노선별 행 수. 행 수가 많은 노선부터
    by_route = route_pairs(df)
    # ② 플립 보드(2026-10-01 순서 변경: 지도 → 보드 → 걸러내기 판)는 걸러내기 전 "모은" 행을 보여 준다.
    # 보드 TOTAL(rawRows)에서 걸러내기 판이 242,874로 줄이므로, 노선별 수도 같은 원본(기준일까지 자른 CSV)에서 센다.
    # 줄 순서는 byRoute와 같게 두어 보드와 다른 곳의 노선 순서가 어긋나지 않게 한다(원본에만 있는 노선은 뒤에)
    raw_counts = route_pairs(raw)
    raw_order = [p for p in by_route.index if p in raw_counts.index] + [p for p in raw_counts.index if p not in by_route.index]
    days = (fetch.max().normalize() - fetch.min().normalize()).days + 1
    return {
        "rawRows": int(len(raw)),
        "filteredRows": int(len(df)),
        "removedImplausible": int(counts["direct"]),
        "collectStart": fetch.min().strftime("%Y-%m-%d"),
        "collectEnd": fetch.max().strftime("%Y-%m-%d"),
        "departStart": dep.min().strftime("%Y-%m-%d"),
        "departEnd": dep.max().strftime("%Y-%m-%d"),
        "uniqueDepartures": int(dep.nunique()),
        "maxDtd": int(df["days_to_departure"].max()),
        "routes": int(routes),
        "byRoute": [{"pair": p, "rows": int(n)} for p, n in by_route.items()],
        "rawByRoute": [{"pair": p, "rows": int(raw_counts[p])} for p in raw_order],
        "collectDays": int(days),
        # ① 숫자판의 "5개월". 30.4일(평균 한 달)로 나눠 반올림한다
        "collectMonths": int(round(days / 30.4)),
        # ② 걸러내기 판(계획 8-1): 규칙별 제거 행 수와 소요 시간 상한(문구 "…분을 넘거나")
        "filter": {**{k: int(v) for k, v in counts.items()}, "durationMax": int(DURATION_MAX)},
    }


def check_snapshot(data: dict, metrics_meta: dict) -> None:
    # 필터 후 행 수가 모델이 실제로 학습한 행 수와 다르면 여기서 멈춘다. 그 상태로 계속 진행하면
    # data 수치와 model 수치가 서로 다른 스냅샷을 가리키는 채로 facts.json에 같이 저장되어 버린다.
    expected = metrics_meta["trainedRows"]
    if data["filteredRows"] != expected:
        raise SystemExit(
            f"필터 후 행 수 {data['filteredRows']:,} ≠ 모델 스냅샷 {expected:,}. "
            "기준일이나 필터가 모델 학습 때와 다르다. 모델 수치를 갱신하기 전에는 사이트 수치를 바꾸지 않는다."
        )


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


def merge_facts(existing: dict, as_of: str, data: dict, model: dict) -> dict:
    merged = dict(existing)
    merged["dataVersion"] = as_of
    merged["data"] = data
    merged["model"] = model
    return merged


def main() -> None:
    metrics = json.loads(METRICS_PATH.read_text(encoding="utf-8"))
    meta = metrics.pop("_meta")
    as_of = meta["asOf"]
    raw = pd.read_csv(AIRFARE_ROOT / "data" / "raw" / "flight_prices.csv")
    data = compute_data_stats(raw, as_of)
    check_snapshot(data, meta)
    metrics["featureCount"] = check_feature_groups(metrics["featureGroups"], model_feature_names())
    existing = json.loads(FACTS_PATH.read_text(encoding="utf-8")) if FACTS_PATH.exists() else {}
    merged = merge_facts(existing, as_of, data, metrics)
    FACTS_PATH.write_text(json.dumps(merged, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"facts.json 갱신: {as_of}, {data['filteredRows']:,}행")


if __name__ == "__main__":
    main()
