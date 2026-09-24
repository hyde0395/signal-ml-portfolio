# export_demo의 순수 함수 검사: 출발일 범위, 대표 편 고르기, 노선·등급 기준가, 추천 이유 코드,
# 공휴일 코드, 3D 예측 구간 띠, 데모 기본 조합. 모델(pkl)은 쓰지 않는다.
import sys
from pathlib import Path

import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import export_demo as ed  # noqa: E402


def obs(n, airline="JL", hour=8, stops=0, o="ICN", d="NRT", cls="LCC", ts="2026-09-20 10:00:00", dur=150, price=100_000):
    row = {"fetch_timestamp": ts, "origin": o, "destination": d, "airline_class": cls, "airline": airline,
           "departure_hour": hour, "stops": stops, "duration_minutes": dur, "price": price}
    return [dict(row) for _ in range(n)]


def test_depart_dates_cover_d3_to_d90():
    dates = ed.depart_dates("2026-09-22")
    assert dates[0] == "2026-09-25"
    assert dates[-1] == "2026-12-21"
    assert len(dates) == 88


def test_representative_is_most_observed_recent_flight_with_min_rows():
    kept = pd.DataFrame(
        obs(60, airline="A", hour=8)
        + obs(70, airline="B", hour=9, dur=140)
        + obs(200, airline="C", ts="2026-08-01 10:00:00")   # 최근 21일 밖 → 세지 않는다
        + obs(49, airline="D", cls="FSC")                   # 50행 미만 → 대표 편 없음
    )
    reps = ed.pick_representatives(kept, "2026-09-22")
    assert reps[("ICN_NRT", "LCC")] == {"airline": "B", "departure_hour": 9, "stops": 0, "duration_minutes": 140.0}
    assert reps[("ICN_NRT", "FSC")] is None
    assert reps[("HND_ICN", "LCC")] is None
    assert len(reps) == 12


def test_route_class_base_is_mean_price():
    kept = pd.DataFrame(obs(1, price=100_000) + obs(1, price=300_000) + obs(1, o="KIX", d="ICN", cls="FSC", price=50_000))
    assert ed.route_class_base(kept) == {("ICN_NRT", "LCC"): 200_000.0, ("KIX_ICN", "FSC"): 50_000.0}


def test_representative_tie_breaks_by_key_order():
    # 항공사 B(9시)와 A(8시)가 동률(60행씩) → 키 정렬(항공사·시각·경유) 순으로 첫 번째인 A를 고른다
    kept = pd.DataFrame(obs(60, airline="B", hour=9) + obs(60, airline="A", hour=8))
    reps = ed.pick_representatives(kept, "2026-09-22")
    assert reps[("ICN_NRT", "LCC")]["airline"] == "A"


def test_representative_window_edge_is_inclusive_of_21_days_ago():
    # as_of=2026-09-22 기준 21일 전 시작은 09-02(포함), 09-01은 창 밖(제외)
    kept = pd.DataFrame(
        obs(50, airline="E", cls="FSC", ts="2026-09-02 10:00:00")
        + obs(50, airline="F", o="KIX", d="ICN", ts="2026-09-01 23:00:00")
    )
    reps = ed.pick_representatives(kept, "2026-09-22")
    assert reps[("ICN_NRT", "FSC")] is not None
    assert reps[("ICN_NRT", "FSC")]["airline"] == "E"
    assert reps[("KIX_ICN", "LCC")] is None


def res(**kw):
    base = dict(action="BUY_NOW", d_now=40, past_optimal=False, best_day=30, saving_pct=3.2, best_price=171_000,
                wait_days=10, saving=5_000, global_best_day=30, confidence=None)
    base.update(kw)
    return base


@pytest.mark.parametrize("kw, why", [
    (dict(d_now=1, best_day=1), "IMMINENT"),
    (dict(past_optimal=True, global_best_day=55), "PAST_OPTIMAL"),
    (dict(best_day=40), "AT_LOW"),
    (dict(saving_pct=3.2), "SMALL_SAVING"),
    (dict(action="DROP_EXPECTED", saving_pct=9.0, confidence="보통"), "FALLING"),
    (dict(action="WAIT", saving_pct=17.0, confidence="높음"), "LATER_LOW"),
])
def test_encode_reco_why(kw, why):
    assert ed.encode_reco(res(**kw))["why"] == why


def test_encode_reco_values_and_confidence():
    r = ed.encode_reco(res(action="DROP_EXPECTED", saving_pct=8.66, confidence="보통"))
    assert r == {"action": "DROP_EXPECTED", "why": "FALLING", "bestDay": 30, "bestPrice": 171_000, "waitDays": 10,
                 "saving": 5_000, "savingPct": 8.7, "globalBestDay": 30, "confidence": "medium"}
    # 지금 구매는 확신도를 보이지 않는다(스펙 §6.1)
    assert ed.encode_reco(res(confidence="보통"))["confidence"] is None


def test_encode_reco_rejects_mismatched_action():
    # saving 3%인데 모델이 WAIT라고 하면 모델 쪽 규칙이 바뀐 것 → 조용히 틀린 이유를 쓰지 않고 멈춘다
    with pytest.raises(ValueError):
        ed.encode_reco(res(action="WAIT", saving_pct=3.0))


def test_encode_reco_rejects_unknown_action():
    # recommend_action에 4번째 상태(예: HOLD)가 생기면 조용히 넘어가지 않고 멈춘다
    with pytest.raises(ValueError):
        ed.encode_reco(res(action="HOLD"))


def test_slug():
    assert ed.slug("Korean Thanksgiving Day") == "korean_thanksgiving_day"
    assert ed.slug("Respect-for-the-Aged Day") == "respect_for_the_aged_day"
    assert ed.slug("New year's Day") == "new_year_s_day"


def test_holiday_codes_nearest_within_three_days():
    hol = [(pd.Timestamp("2026-10-09"), "kr_hangul_day"), (pd.Timestamp("2026-10-12"), "jp_sports_day")]
    got = ed.holiday_codes(["2026-10-05", "2026-10-06", "2026-10-10", "2026-10-11", "2026-10-16"], hol)
    assert got == {"2026-10-06": "kr_hangul_day", "2026-10-10": "kr_hangul_day", "2026-10-11": "jp_sports_day"}


def test_holiday_codes_tie_prefers_first_listed():
    hol = [(pd.Timestamp("2026-10-09"), "kr_a"), (pd.Timestamp("2026-10-09"), "jp_b")]
    assert ed.holiday_codes(["2026-10-08"], hol) == {"2026-10-08": "kr_a"}


def test_band_averages_pct_of_route_class_base_and_skips_missing():
    series = {
        ("ICN_NRT", "LCC"): {"price": [110, None, None], "lo": [90, None, None], "hi": [150, None, None]},
        ("ICN_KIX", "LCC"): {"price": [100, 200, None], "lo": [80, 150, None], "hi": [120, 260, None]},
        ("ICN_HND", "FSC"): None,
    }
    base = {("ICN_NRT", "LCC"): 100.0, ("ICN_KIX", "LCC"): 100.0, ("ICN_HND", "FSC"): 300.0}
    band = ed.build_band(series, base, ["2026-09-25", "2026-09-26", "2026-09-27"], "2026-09-22")
    # 25일: lo (-10, -20) → -15% → ×10 = -150, hi (50, 20) → 35% → 350. 26일: KIX만. 27일: 값 없음 → 뺀다
    assert band == {"asOf": "2026-09-22", "dates": ["2026-09-25", "2026-09-26"], "lo": [-150, 500], "hi": [350, 1600]}


def reco(action, pct):
    return {"action": action, "savingPct": pct}


def test_choose_default_prefers_biggest_drop():
    series = {
        "ICN_NRT/LCC": {"reco": [reco("BUY_NOW", 1.0), reco("DROP_EXPECTED", 9.1)]},
        "ICN_KIX/FSC": {"reco": [reco("DROP_EXPECTED", 12.5), None]},
        "HND_ICN/LCC": None,
    }
    assert ed.choose_default(series, ["2026-09-25", "2026-09-26"]) == {"route": "ICN_KIX", "cabin": "FSC", "date": "2026-09-25"}


def test_choose_default_falls_back_to_wait_then_buy_now():
    wait = {"ICN_NRT/LCC": {"reco": [reco("BUY_NOW", 5.0), reco("WAIT", 16.0)]}}
    assert ed.choose_default(wait, ["2026-09-25", "2026-09-26"])["date"] == "2026-09-26"
    buy = {"ICN_NRT/LCC": {"reco": [reco("BUY_NOW", 1.0), reco("BUY_NOW", 4.0)]}}
    assert ed.choose_default(buy, ["2026-09-25", "2026-09-26"])["date"] == "2026-09-26"
