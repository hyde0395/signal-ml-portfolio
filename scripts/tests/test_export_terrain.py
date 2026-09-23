# export_terrain의 순수 함수 검사: 노선·등급 평균 대비 %, 두 겹 집계, 제거 레이어, 공휴일, 정수 인코딩,
# 실측 예약 곡선(항공권 저장소 realized_wait_analysis.py와 같은 정의).
import json
import sys
from pathlib import Path

import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import export_terrain as et  # noqa: E402

COLS = ["fetch_timestamp", "origin", "destination", "airline", "airline_class", "departure_date", "price",
        "stops", "duration_minutes", "departure_time_raw", "arrival_time_raw", "days_to_departure"]


def row(price, dtd=10, day="2026-10-10", o="ICN", d="NRT", cls="LCC", ts="2026-09-01 10:00:00",
        stops=0, dur=150, dep="08:00", arr="10:30", airline="JL"):
    return [ts, o, d, airline, cls, day, price, stops, dur, f"{day} {dep}", f"{day} {arr}", dtd]


def frame(rows):
    return pd.DataFrame(rows, columns=COLS)


def test_split_rows_separates_implausible_and_cuts_off():
    raw = frame([
        row(100_000),
        row(120_000, ts="2026-09-22 23:59:59"),
        row(900_000, dur=360, arr="14:00"),          # 직항인데 6시간 → 제거 레이어
        row(100_000, ts="2026-09-23 06:00:00"),      # 기준일 이후 → 제외
        row(150),                                    # 가격 floor 미만 → 둘 다 아님
    ])
    kept, removed = et.split_rows(raw, "2026-09-22")
    assert len(kept) == 2
    assert len(removed) == 1


def test_route_class_pct_uses_kept_mean_for_both():
    kept = frame([row(100_000), row(300_000)])            # 평균 200,000
    removed = frame([row(500_000, dur=360, arr="14:00")])
    k, r = et.add_route_class_pct(kept, removed)
    assert sorted(k["pct"].round(1)) == [-50.0, 50.0]
    assert r["pct"].round(1).tolist() == [150.0]


def test_layers_signal_noise_removed():
    kept = frame([
        row(100_000, dtd=10, o="ICN", d="NRT"),
        row(300_000, dtd=10, o="ICN", d="NRT"),
        row(200_000, dtd=10, o="ICN", d="KIX"),
    ])
    k, r = et.add_route_class_pct(kept, frame([]))
    layers = et.build_layers(k, r)
    # 신호: 칸(dtd=10, 2026-10-10) 하나, 평균 pct = (-50 + 50 + 0) / 3 = 0
    assert len(layers["signal"]) == 1
    assert round(float(layers["signal"]["pct"].iloc[0]), 6) == 0.0
    # 잡음: 칸 × 노선 × 등급 → ICN-NRT(0), ICN-KIX(0) 두 개
    assert len(layers["noise"]) == 2
    assert len(layers["removed"]) == 0


def test_encode_layer_quantizes_and_clips():
    dates = ["2026-10-10", "2026-10-11"]
    layer = pd.DataFrame({"days_to_departure": [5, 7], "departure_date": ["2026-10-11", "2026-10-10"],
                          "pct": [12.34, 999.0]})
    enc = et.encode_layer(layer, dates)
    assert enc == {"dtd": [5, 7], "date": [1, 0], "pct": [123, 2000]}


def test_holiday_indices_marks_near_holidays():
    dates = ["2026-10-02", "2026-10-20"]   # 10/3 개천절 ±3일 → 첫 날짜만
    assert et.holiday_indices(dates) == [0]


def test_load_completed_daily_keeps_only_completed_flights_and_takes_daily_min():
    kept = frame([
        row(100_000, day="2026-09-20", ts="2026-09-15 09:00:00", o="ICN", d="NRT", airline="JL"),
        row(90_000, day="2026-09-20", ts="2026-09-15 21:00:00", o="ICN", d="NRT", airline="JL"),   # 같은 날 재수집, 더 쌈
        row(120_000, day="2026-09-20", ts="2026-09-10 09:00:00", o="ICN", d="NRT", airline="JL"),
        row(500_000, day="2026-09-25", ts="2026-09-15 09:00:00", o="ICN", d="HND", airline="JL"),  # 출발일이 기준일 이후 → 미완결
    ])
    daily = et.load_completed_daily(kept, "2026-09-22")
    assert len(daily) == 2  # 미완결 편 제외, 같은 (편, 수집일)은 최저가 1행으로 합쳐짐
    by_dtd = {int(r["dtd"]): r["price"] for _, r in daily.iterrows()}
    assert by_dtd[5] == 90_000   # 09-15에 두 번 수집 중 최저가
    assert by_dtd[10] == 120_000


def test_build_curve_centres_log_price_by_flight_like_realized_wait_analysis():
    # 편 A(ICN-NRT, JL)와 편 B(ICN-KIX, OZ)는 가격대가 다르지만(11만/22만) 같은 비율로 움직인다.
    # realized_wait_analysis.booking_curve()와 같은 정의(편 평균 로그가격 대비로 중심화 → dtd별 평균
    # → expm1로 %)라면 dtd=5는 -8.71%, dtd=10은 +9.54%가 나와야 한다(원가 비율의 단순 평균인
    # -9.09%/+9.09%가 아니라 로그 평균이라 비대칭).
    kept = frame([
        row(100_000, day="2026-09-20", ts="2026-09-15 09:00:00", o="ICN", d="NRT", airline="JL"),
        row(120_000, day="2026-09-20", ts="2026-09-10 09:00:00", o="ICN", d="NRT", airline="JL"),
        row(200_000, day="2026-09-21", ts="2026-09-16 09:00:00", o="ICN", d="KIX", cls="FSC", airline="OZ", dep="09:00"),
        row(240_000, day="2026-09-21", ts="2026-09-11 09:00:00", o="ICN", d="KIX", cls="FSC", airline="OZ", dep="09:00"),
    ])
    daily = et.load_completed_daily(kept, "2026-09-22")
    curve = et.build_curve(daily)
    by_dtd = dict(zip(curve["days_to_departure"], curve["pct"]))
    assert by_dtd[5] == pytest.approx(-8.7129, abs=1e-3)
    assert by_dtd[10] == pytest.approx(9.5445, abs=1e-3)


def test_encode_curve_quantizes_and_clips():
    curve = pd.DataFrame({"days_to_departure": [5, 10], "pct": [12.34, 999.0]})
    assert et.encode_curve(curve) == {"dtd": [5, 10], "pct": [123, 2000]}


def test_booking_curve_buckets_matches_model_metrics_on_real_data():
    # 항공권 저장소 원본 CSV가 있을 때만 실행(없으면 스킵) — 사이트가 계산한 8구간 실측 예약 곡선이
    # model_metrics.json(= 항공권 저장소 realized_wait_analysis.booking_curve()의 결과, CLAUDE.md에
    # 옮겨 적은 값)과 ±0.5%p 안에서 같아야 한다. "같은 방법으로 계산했다"는 라운드 4 요구의 실측 증거.
    csv_path = et.AIRFARE_ROOT / "data" / "raw" / "flight_prices.csv"
    if not csv_path.exists():
        pytest.skip(f"{csv_path} 없음 — 항공권 저장소 원본 CSV가 있어야 실행되는 테스트")
    metrics = json.loads(et.METRICS_PATH.read_text(encoding="utf-8"))
    as_of = metrics["_meta"]["asOf"]
    expected = {b["label"]: b["pct"] for b in metrics["bookingCurve"]}

    raw = pd.read_csv(csv_path)
    kept, _ = et.split_rows(raw, as_of)
    daily = et.load_completed_daily(kept, as_of)
    buckets = et.booking_curve_buckets(daily)

    seen = set()
    for interval, r in buckets.iterrows():
        label = f"D-{int(interval.left) + 1}~{int(interval.right)}"
        assert label in expected, f"model_metrics.json에 없는 구간: {label}"
        assert r["pct"] == pytest.approx(expected[label], abs=0.5), (
            f"{label}: 계산값 {r['pct']:+.2f}% vs model_metrics.json {expected[label]:+.1f}%"
        )
        seen.add(label)
    assert seen == set(expected)  # 8구간 전부 나와야 한다
