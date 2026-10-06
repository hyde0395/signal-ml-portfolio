# export_facts.py의 필터·기준일 자르기·행 수 스냅샷 검사(check_snapshot)를 검증한다.
import sys
from pathlib import Path

import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import export_facts as ef  # noqa: E402

COLS = ["fetch_timestamp", "origin", "destination", "departure_date", "price", "stops",
        "duration_minutes", "departure_time_raw", "arrival_time_raw", "days_to_departure"]


def row(ts, price=150_000, stops=0, dur=150, dep="08:00", arr="10:30", dtd=20, o="ICN", d="NRT", day="2026-10-10"):
    return [ts, o, d, day, price, stops, dur, f"{day} {dep}", f"{day} {arr}", dtd]


def frame(rows):
    return pd.DataFrame(rows, columns=COLS)


def test_counts_filters_and_cutoff():
    raw = frame([
        row("2026-09-22 10:00:00"),                                   # 정상
        row("2026-09-22 23:59:59", dtd=147, day="2027-02-14"),        # 정상, 기준일 마지막 순간
        row("2026-09-22 11:00:00", price=150),                        # 가격 floor 미만 → 제거
        row("2026-09-22 12:00:00", dur=360, arr="14:00"),              # 직항인데 6시간 → 타당성 필터
        row("2026-09-23 06:54:06"),                                   # 기준일 이후 → 아예 제외
    ])
    stats = ef.compute_data_stats(raw, "2026-09-22")
    assert stats["rawRows"] == 4
    assert stats["filteredRows"] == 2
    assert stats["removedImplausible"] == 1
    assert stats["collectStart"] == "2026-09-22"
    assert stats["collectEnd"] == "2026-09-22"
    assert stats["departStart"] == "2026-10-10"
    assert stats["departEnd"] == "2027-02-14"
    assert stats["uniqueDepartures"] == 2
    assert stats["maxDtd"] == 147
    assert stats["routes"] == 1
    # 왕복을 한 줄로 합친 노선별 행 수(ICN이 앞). 합은 filteredRows와 같다
    assert stats["byRoute"] == [{"pair": "ICN_NRT", "rows": 2}]
    # ② 보드는 걸러내기 전 모은 행(기준일까지 자른 원본)을 노선별로 센다
    assert stats["rawByRoute"] == [{"pair": "ICN_NRT", "rows": 4}]
    assert stats["collectDays"] == 1
    assert stats["collectMonths"] == 0


def test_filter_counts_by_rule_in_pipeline_order():
    raw = frame([
        row("2026-09-22 10:00:00"),                                # 통과
        row("2026-09-22 10:01:00", dur=500, arr="16:20"),          # ① 400분 초과
        row("2026-09-22 10:02:00", price=150),                     # ① 가격 단위 누락
        row("2026-09-22 10:03:00", arr="14:00"),                   # ② 시각차 360분 ≠ 소요 150분
        row("2026-09-22 10:04:00", dur=360, arr="14:00"),          # ③ 직항인데 6시간(시각과는 맞는다)
    ])
    stats = ef.compute_data_stats(raw, "2026-09-22")
    assert stats["filter"] == {"unit": 2, "mismatch": 1, "direct": 1, "durationMax": 400}
    f = stats["filter"]
    assert stats["rawRows"] - f["unit"] - f["mismatch"] - f["direct"] == stats["filteredRows"]
    assert stats["removedImplausible"] == f["direct"]


def test_merge_keeps_site_config():
    # contact.ticket(연락처 탑승권, 2026-10-01)도 손으로 쓰는 값이라 재학습 뒤에도 그대로 남아야 한다
    contact = {"linkedin": "", "ticket": {"flight": "SIG 0395", "gate": "03", "fromCity": "SEOUL INCHEON", "toCity": "TOKYO · OSAKA"}}
    existing = {"dataVersion": "old", "contact": contact, "data": {"rawRows": 1}}
    merged = ef.merge_facts(existing, "2026-09-22", {"rawRows": 2}, {"tss": {"r2": 0.637}})
    assert merged["contact"] == contact
    assert merged["dataVersion"] == "2026-09-22"
    assert merged["data"] == {"rawRows": 2}
    assert merged["model"] == {"tss": {"r2": 0.637}}


def test_row_count_mismatch_fails():
    with pytest.raises(SystemExit, match="242,874"):
        ef.check_snapshot({"filteredRows": 242_000}, {"trainedRows": 242_874})


def test_by_route_merges_both_directions_and_sorts_by_rows():
    raw = frame([
        row("2026-04-23 10:00:00"),
        row("2026-04-23 11:00:00", o="NRT", d="ICN"),
        row("2026-09-22 12:00:00", o="ICN", d="KIX"),
    ])
    stats = ef.compute_data_stats(raw, "2026-09-22")
    assert stats["byRoute"] == [{"pair": "ICN_NRT", "rows": 2}, {"pair": "ICN_KIX", "rows": 1}]
    assert sum(r["rows"] for r in stats["byRoute"]) == stats["filteredRows"]
    assert stats["collectDays"] == 153
    assert stats["collectMonths"] == 5


def test_raw_by_route_sums_to_raw_rows_in_by_route_order():
    # 원본에서는 KIX가 더 많지만(걸러질 행 둘) 줄 순서는 걸러낸 뒤 순서(byRoute)를 따른다
    raw = frame([
        row("2026-09-22 10:00:00"),
        row("2026-09-22 10:01:00", o="NRT", d="ICN"),
        row("2026-09-22 10:02:00", o="ICN", d="KIX"),
        row("2026-09-22 10:03:00", o="ICN", d="KIX", price=150),
        row("2026-09-22 10:04:00", o="KIX", d="ICN", price=150),
        row("2026-09-23 10:00:00", o="ICN", d="HND"),  # 기준일 이후 → 원본에서도 제외
    ])
    stats = ef.compute_data_stats(raw, "2026-09-22")
    assert stats["rawByRoute"] == [{"pair": "ICN_NRT", "rows": 2}, {"pair": "ICN_KIX", "rows": 3}]
    assert sum(r["rows"] for r in stats["rawByRoute"]) == stats["rawRows"]
    assert [r["pair"] for r in stats["rawByRoute"]] == [r["pair"] for r in stats["byRoute"]]


def test_feature_groups_must_cover_model_features_exactly():
    model_features = ["a", "b", "c"]
    good = [{"id": "x", "gain": 60.0, "features": ["a", "b"]}, {"id": "y", "gain": 40.0, "features": ["c"]}]
    assert ef.check_feature_groups(good, model_features) == 3
    with pytest.raises(SystemExit, match="c"):
        ef.check_feature_groups([{"id": "x", "gain": 100.0, "features": ["a", "b"]}], model_features)
    with pytest.raises(SystemExit, match="z"):
        ef.check_feature_groups(good + [{"id": "z", "gain": 0.0, "features": ["z"]}], model_features)


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
