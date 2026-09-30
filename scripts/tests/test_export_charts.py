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


def test_value_rank_gives_constant_feature_neutral_50():
    # 값이 하나뿐인 피처(예: global_med)는 크고 작음이 없다 — 범주형처럼 중간색(50). 0이면 모두 파랑으로 칠해져 뜻이 생긴다
    assert ec.value_rank(pd.Series([7.0])) == [50]
    assert ec.value_rank(pd.Series([3.0, 3.0, 3.0])) == [50, 50, 50]


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


# ③ 모델 구조 점(계획 7-2): 한 노선·등급의 관측 표본과 기준 가격 %
def model_rows():
    # 첫날 행 20개, 셋째 날 5개(표본보다 적다), 둘째 날은 다른 노선만. pct·base는 add_route_class_pct가 붙이는 열
    rows = []
    for i in range(20):
        rows.append({"origin": "ICN", "destination": "NRT", "airline_class": "LCC", "departure_date": "2026-10-01",
                     "pct": float(i), "base": 100_000.0})
    for i in range(5):
        rows.append({"origin": "ICN", "destination": "NRT", "airline_class": "LCC", "departure_date": "2026-10-03",
                     "pct": -float(i), "base": 100_000.0})
    for _ in range(3):
        rows.append({"origin": "ICN", "destination": "KIX", "airline_class": "LCC", "departure_date": "2026-10-02",
                     "pct": 0.0, "base": 90_000.0})
    return pd.DataFrame(rows)


MODEL_DATES = ["2026-10-01", "2026-10-02", "2026-10-03"]


def test_route_rows_picks_one_route_and_cabin():
    assert len(ec.route_rows(model_rows(), "ICN_NRT", "LCC")) == 25


def test_model_obs_caps_per_date_sorted_by_date_index_and_is_seeded():
    sub = ec.route_rows(model_rows(), "ICN_NRT", "LCC")
    o = ec.model_obs(sub, MODEL_DATES, per_date=12, seed=3)
    assert o["date"] == [0] * 12 + [2] * 5  # 날짜 번호는 charts.dates 안, 행이 적은 날은 있는 만큼
    assert set(o["pct"][:12]) <= {i * 10 for i in range(20)}
    assert sorted(o["pct"][12:]) == [-40, -30, -20, -10, 0]
    assert ec.model_obs(sub, MODEL_DATES, per_date=12, seed=3) == o  # 시드가 같으면 같은 표본


def test_baseline_pct10_is_pct_of_mean_and_none_when_missing():
    got = ec.baseline_pct10({"a": 110_000.0, "b": float("nan"), "c": 0.0}, 100_000.0, ["a", "b", "c", "d"])
    assert got == [100, None, None, None]


def test_model_block_has_percent_only():
    sub = ec.route_rows(model_rows(), "ICN_NRT", "LCC")
    b = ec.model_block(sub, MODEL_DATES, {"2026-10-01": 95_000.0, "2026-10-03": 120_000.0}, "ICN_NRT", "LCC")
    assert set(b) == {"route", "cabin", "base", "obs"} and set(b["obs"]) == {"date", "pct"}
    assert (b["route"], b["cabin"]) == ("ICN_NRT", "LCC")
    assert b["base"] == [-50, None, 200]
    assert len(b["obs"]["date"]) == len(b["obs"]["pct"]) == 17
    # 원 단위 값이 섞이지 않았는지: 모든 정수가 현실적인 %×10 범위(±500%) 안이고, 입력 가격(반올림)과 같은 값이 없다
    vals = b["obs"]["pct"] + [x for x in b["base"] if x is not None]
    assert all(isinstance(v, int) and abs(v) <= 5000 for v in vals)
    prices = {round(p) for p in (100_000.0, 95_000.0, 120_000.0, 90_000.0)}
    assert not prices & set(vals)


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


def test_rule_codes_nan_price_gets_rule_1():
    # 가격이 비어 있는 행은 통과가 아니라 규칙 1(export_facts의 >= 기준과 같게)
    raw = filter_raw()
    cut = raw[pd.to_datetime(raw["fetch_timestamp"]) < pd.Timestamp("2026-09-23")].copy()
    cut.loc[cut.index[0], "price"] = np.nan
    assert ec.rule_codes(cut).tolist()[0] == 1


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
