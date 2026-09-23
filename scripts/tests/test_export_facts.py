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


def test_merge_keeps_site_config():
    existing = {"dataVersion": "old", "contact": {"linkedin": ""}, "data": {"rawRows": 1}}
    merged = ef.merge_facts(existing, "2026-09-22", {"rawRows": 2}, {"tss": {"r2": 0.637}})
    assert merged["contact"] == {"linkedin": ""}
    assert merged["dataVersion"] == "2026-09-22"
    assert merged["data"] == {"rawRows": 2}
    assert merged["model"] == {"tss": {"r2": 0.637}}


def test_row_count_mismatch_fails():
    with pytest.raises(SystemExit, match="242,874"):
        ef.check_snapshot({"filteredRows": 242_000}, {"trainedRows": 242_874})
