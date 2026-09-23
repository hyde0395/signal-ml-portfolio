# export_terrain의 순수 함수 검사: 노선·등급 평균 대비 %, 두 겹 집계, 제거 레이어, 공휴일, 정수 인코딩.
import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import export_terrain as et  # noqa: E402

COLS = ["fetch_timestamp", "origin", "destination", "airline_class", "departure_date", "price",
        "stops", "duration_minutes", "departure_time_raw", "arrival_time_raw", "days_to_departure"]


def row(price, dtd=10, day="2026-10-10", o="ICN", d="NRT", cls="LCC", ts="2026-09-01 10:00:00",
        stops=0, dur=150, dep="08:00", arr="10:30"):
    return [ts, o, d, cls, day, price, stops, dur, f"{day} {dep}", f"{day} {arr}", dtd]


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
