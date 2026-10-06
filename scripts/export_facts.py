"""data/facts.json의 dataVersion·data·model 영역을 항공권 저장소 기준으로 갱신한다.

- data: 원본 CSV를 기준일(asOf)까지 자르고, 항공권 저장소의 학습용 필터를 그대로 적용해 센다.
- model: scripts/model_metrics.json(항공권 저장소 CLAUDE.md에서 옮긴 값)을 그대로 쓴다.
- 나머지 키(profile, contact, codeLinks 등)는 손대지 않는다.

실행: npm run facts   (AIRFARE_ROOT 기본값 ~/Documents/airfare-forecasting-ml)
      npm run facts:derived   (원본 CSV 없이 facts.json·charts.json에서 계산하는 값만 다시 — 정보 전달 2)
"""
from __future__ import annotations

import json
import math
import os
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
FACTS_PATH = ROOT / "data" / "facts.json"
METRICS_PATH = ROOT / "scripts" / "model_metrics.json"
CHARTS_DIR = ROOT / "public" / "data"
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


if __name__ == "__main__":
    main()
