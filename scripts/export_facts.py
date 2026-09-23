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


def apply_filters(df: pd.DataFrame) -> tuple[pd.DataFrame, int]:
    """tscv_eval_v2.load_data()와 같은 순서의 필터. (필터 후 df, 직항 타당성 필터로 제거된 행 수)."""
    df = df[df["duration_minutes"].notna() & (df["duration_minutes"] <= DURATION_MAX)]
    df = df[df["price"] >= PRICE_FLOOR]
    df = drop_inconsistent_flight_times(df)
    n_before = len(df)
    df = drop_implausible_direct_flights(df)
    return df, n_before - len(df)


def compute_data_stats(raw: pd.DataFrame, as_of: str) -> dict:
    # as_of 자정 다음날 자정 이전까지만(= as_of 당일 끝까지 포함) 남긴다. 수집이 계속 진행 중인
    # 원본 CSV에서 이후에 더 쌓인 행이 섞이면 model_metrics.json이 학습했던 시점과 어긋난다.
    cutoff = pd.Timestamp(as_of) + pd.Timedelta(days=1)
    raw = raw[pd.to_datetime(raw["fetch_timestamp"]) < cutoff]
    df, removed = apply_filters(raw)
    fetch = pd.to_datetime(df["fetch_timestamp"])
    dep = pd.to_datetime(df["departure_date"])
    routes = (df["origin"].astype(str) + "_" + df["destination"].astype(str)).nunique()
    return {
        "rawRows": int(len(raw)),
        "filteredRows": int(len(df)),
        "removedImplausible": int(removed),
        "collectStart": fetch.min().strftime("%Y-%m-%d"),
        "collectEnd": fetch.max().strftime("%Y-%m-%d"),
        "departStart": dep.min().strftime("%Y-%m-%d"),
        "departEnd": dep.max().strftime("%Y-%m-%d"),
        "uniqueDepartures": int(dep.nunique()),
        "maxDtd": int(df["days_to_departure"].max()),
        "routes": int(routes),
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
    existing = json.loads(FACTS_PATH.read_text(encoding="utf-8")) if FACTS_PATH.exists() else {}
    merged = merge_facts(existing, as_of, data, metrics)
    FACTS_PATH.write_text(json.dumps(merged, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"facts.json 갱신: {as_of}, {data['filteredRows']:,}행")


if __name__ == "__main__":
    main()
