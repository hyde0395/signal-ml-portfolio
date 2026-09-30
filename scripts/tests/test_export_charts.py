# export_charts의 순수 함수 검사: 출발일별 평균 %, 공휴일 이름표 고르기, 예약 곡선 8구간·표본,
# 지표(model_metrics.json)와의 대조, 전체 모양.
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import export_charts as ec  # noqa: E402

COLS = ["fetch_timestamp", "origin", "destination", "airline", "airline_class", "departure_date", "price",
        "stops", "duration_minutes", "departure_time_raw", "arrival_time_raw", "days_to_departure"]


def row(price, dtd=10, day="2026-10-10", ts="2026-09-01 10:00:00", airline="JL"):
    return [ts, "ICN", "NRT", airline, "LCC", day, price, 0, 150, f"{day} 08:00", f"{day} 10:30", dtd]


def daily_frame():
    # 세 편 × dtd 1~90, 가격이 dtd에 따라 조금씩 오른다(구간마다 행이 있게)
    rows = []
    for f in range(3):
        for dtd in range(1, 91):
            rows.append({"origin": "ICN", "destination": "NRT", "airline": f"A{f}", "airline_class": "LCC", "stops": 0,
                         "departure_time_raw": "2026-09-01 08:00", "departure_date": "2026-09-01",
                         "price": 100_000 * (1 + 0.001 * dtd), "dtd": dtd})
    return pd.DataFrame(rows)


def test_depart_pct10_is_mean_per_date_in_given_order():
    kept = pd.DataFrame({"departure_date": ["2026-10-02", "2026-10-01", "2026-10-01"], "pct": [10.0, -5.0, 15.0]})
    assert ec.depart_pct10(kept, ["2026-10-01", "2026-10-02"]) == [50, 100]


def test_holiday_labels_one_per_code_top_by_peak_sorted_by_date():
    dates = ["2026-12-24", "2026-12-25", "2027-01-01", "2027-01-02", "2027-02-07", "2027-03-01"]
    pct10 = [300, 500, 700, 200, 400, 900]
    codes = {"2026-12-24": "xmas", "2026-12-25": "xmas", "2027-01-01": "ny", "2027-01-02": "ny", "2027-02-07": "seol"}
    assert ec.holiday_labels(dates, pct10, codes, top=2) == [
        {"date": "2026-12-25", "code": "xmas"},
        {"date": "2027-01-01", "code": "ny"},
    ]


def test_curve_bins_cover_eight_ranges():
    c = ec.curve_bins(daily_frame())
    assert c["bins"] == [[1, 3], [4, 7], [8, 14], [15, 21], [22, 30], [31, 45], [46, 60], [61, 90]]
    assert len(c["mean"]) == 8
    assert sum(c["n"]) == 270


def test_curve_sample_caps_size_keeps_bins_and_clips():
    s = ec.curve_sample(daily_frame(), size=100, seed=1)
    assert len(s["bin"]) == len(s["pct"]) == 100
    assert set(s["bin"]) <= set(range(8))
    assert all(-400 <= p <= 400 for p in s["pct"])
    assert ec.curve_sample(daily_frame(), size=100, seed=1) == s  # 시드가 같으면 같은 표본


def test_check_curve_rejects_mismatch_with_metrics():
    metrics = {"bookingCurve": [{"label": "x", "pct": 1.0}] * 8}
    ec.check_curve({"mean": [10] * 8}, metrics)  # 같으면 통과
    with pytest.raises(SystemExit):
        ec.check_curve({"mean": [30] * 8}, metrics)
    with pytest.raises(SystemExit):
        ec.check_curve({"mean": [10] * 7}, metrics)  # 비어 있는 구간이 있으면 길이가 다르다


def test_build_charts_shape():
    raw = pd.DataFrame([
        row(100_000),
        row(300_000, day="2026-10-03"),
        row(200_000, day="2026-09-10", ts="2026-09-05 10:00:00", dtd=5),
    ], columns=COLS)
    c = ec.build_charts(raw, "2026-09-22")
    assert c["asOf"] == "2026-09-22"
    assert c["dates"] == ["2026-09-10", "2026-10-03", "2026-10-10"]
    assert len(c["depart"]["pct"]) == len(c["depart"]["holiday"]) == 3
    assert c["depart"]["holiday"][1] is not None  # 10-03 개천절(±3일)
    assert c["curve"]["bins"][0] == [1, 3]
    assert set(c["curve"]["sample"]) == {"bin", "pct"}


def test_value_rank_spreads_distinct_values_evenly_0_to_100():
    assert ec.value_rank(pd.Series([10.0, 30.0, 20.0])) == [0, 100, 50]
    # 0/1 피처의 다수 값이 중간(회색)이 아니라 양 끝(파랑/호박)으로 가야 한다
    assert ec.value_rank(pd.Series([5.0, 5.0, 9.0])) == [0, 0, 100]
    assert ec.value_rank(pd.Series([0.0, 0.0, 0.0, 1.0])) == [0, 0, 0, 100]
    assert ec.value_rank(pd.Series([7.0])) == [0]


def test_value_rank_puts_missing_values_lowest():
    # days_bucket_num은 D-0(당일 출발)이 첫 구간 (0, 7] 밖이라 NaN — 가장 작은 값으로 둔다
    assert ec.value_rank(pd.Series([float("nan"), 2.0, 1.0])) == [0, 100, 50]
    assert ec.value_rank(pd.Series([float("nan"), float("nan"), 7.0, 7.0])) == [0, 0, 100, 100]


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
