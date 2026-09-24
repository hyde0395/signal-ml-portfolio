"""public/data/demo.<기준일>.json과 band.<기준일>.json을 만들고 data/facts.json의 demoDefault를 고른다.

- demo: 6개 노선 × LCC/FSC × 출발일 D+3~90마다, 기준일에 샀다면의 예측가·80% 구간·추천을 담는다.
  추천 이유는 문장이 아니라 코드와 값이다. 사이트가 3개 언어 문구 틀로 문장을 조립한다(스펙 §6.2).
- 대표 편: 모델은 "어느 편인지"(항공사·출발 시각·경유)를 받아야 예측하므로, 노선·등급마다 최근 21일
  동안 50행 이상 관측된 편 중 가장 많이 관측된 편을 쓴다(항공권 저장소 추천 시뮬레이션과 같은 기준).
- band: 3-5 챕터의 3D 지형에 얹는 예측 구간 띠. 지형과 같은 "노선·등급 평균 대비 %"로 바꿔
  출발일마다 12개 조합을 평균한다. 원가는 내보내지 않는다(데이터 공개 원칙 §11.4).

실행: npm run demo   (모델을 1,056번 돌려 몇 분 걸린다)
"""
from __future__ import annotations

import contextlib
import gzip
import io
import json
import re
import sys
from collections import Counter
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from export_facts import AIRFARE_ROOT, FACTS_PATH, METRICS_PATH  # noqa: E402  (AIRFARE_ROOT를 sys.path에 넣는 부수효과 포함)
from export_terrain import ROUTE_CLASS, split_rows  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
ROUTES = ["ICN_NRT", "NRT_ICN", "ICN_KIX", "KIX_ICN", "ICN_HND", "HND_ICN"]
CABINS = ["LCC", "FSC"]
FIRST_DAY, LAST_DAY = 3, 90          # 모델 V2Predictor.MAX_DTD = 90
REP_WINDOW_DAYS = 21                 # 대표 편: 최근 3주
REP_MIN_ROWS = 50                    # 대표 편: 그동안 50행 이상
FLIGHT = ["airline", "departure_hour", "stops"]
TAU = 8.0                            # recommend_action의 "오차 범위" 기준(%)과 같다
HOLIDAY_WINDOW = 3                   # 공휴일 ±3일(항공권 저장소 is_*_near_holiday와 같다)
MAX_GZIP_BYTES = 500 * 1024          # 스펙 §6.2
BAND_MAX_GZIP_BYTES = 50 * 1024
CONFIDENCE = {"높음": "high", "보통": "medium"}
BUY_WHY = {"IMMINENT", "PAST_OPTIMAL", "AT_LOW", "SMALL_SAVING"}
PREFERENCE = ["DROP_EXPECTED", "WAIT", "BUY_NOW"]
ACTIONS = {"BUY_NOW", "DROP_EXPECTED", "WAIT"}   # recommend_action이 돌려줄 수 있는 값(4번째 상태 방지)
# 데모 기본 조합의 출발까지 남은 일수(D-day) 범위. savingPct는 구조상 출발일이 멀수록 커져서, 그대로
# 최댓값을 고르면 choose_default가 거의 항상 마지막 날(D+90)만 고른다 — 이 범위로 먼저 찾는다
DEFAULT_DAY_RANGE = (14, 75)


def depart_dates(as_of: str) -> list[str]:
    start = pd.Timestamp(as_of)
    return [(start + pd.Timedelta(days=k)).strftime("%Y-%m-%d") for k in range(FIRST_DAY, LAST_DAY + 1)]


def pick_representatives(kept: pd.DataFrame, as_of: str) -> dict[tuple[str, str], dict | None]:
    """(노선, 등급) → 모델에 넘길 대표 편 속성. 조건을 채우는 편이 없으면 None."""
    end = pd.Timestamp(as_of)
    start = end - pd.Timedelta(days=REP_WINDOW_DAYS - 1)
    day = pd.to_datetime(kept["fetch_timestamp"]).dt.normalize()
    recent = kept[(day >= start) & (day <= end)]
    out: dict[tuple[str, str], dict | None] = {}
    for route in ROUTES:
        origin, dest = route.split("_")
        for cabin in CABINS:
            g = recent[(recent["origin"] == origin) & (recent["destination"] == dest) & (recent["airline_class"] == cabin)]
            counts = g.groupby(FLIGHT).size()
            counts = counts[counts >= REP_MIN_ROWS]
            if counts.empty:
                out[(route, cabin)] = None
                continue
            # 동률이면 키 순서(항공사·시각·경유)로 첫 번째 → 다시 돌려도 같은 편을 고른다
            airline, hour, stops = counts.sort_index().idxmax()
            rows = g[(g["airline"] == airline) & (g["departure_hour"] == hour) & (g["stops"] == stops)]
            out[(route, cabin)] = {"airline": airline, "departure_hour": int(hour), "stops": int(stops),
                                   "duration_minutes": float(rows["duration_minutes"].median())}
    return out


def route_class_base(kept: pd.DataFrame) -> dict[tuple[str, str], float]:
    """노선·등급 평균가. export_terrain.add_route_class_pct와 같은 기준이라 띠가 지형 높이와 맞는다."""
    mean = kept.groupby(ROUTE_CLASS)["price"].mean()
    return {(f"{o}_{d}", c): float(v) for (o, d, c), v in mean.items()}


def won(x: float) -> int:
    """100원 단위로 반올림한다. 모델의 MAE가 ~4.8만 원이라 원 단위(₩248,386)까지 보이면 실제보다
    정밀해 보인다(거짓 정밀도) — 화면에 보여 줄 가격은 여기를 거친다."""
    return int(round(x / 100) * 100)


def encode_reco(res: dict) -> dict:
    """recommend_action() 반환값 → 이유 코드와 값. 분기 순서는 recommend_action과 같다.

    FALLING/LATER_LOW는 모델이 trend를 돌려주지 않아 action으로 가른다 — 그래서 아래 대조는
    BUY_NOW 규칙 변경만 잡는다."""
    if res["action"] not in ACTIONS:
        raise ValueError(f"모르는 action: {res['action']!r} — recommend_action에 새 상태가 생겼는지 확인한다")
    if res["d_now"] <= 1:
        why = "IMMINENT"
    elif res["past_optimal"]:
        why = "PAST_OPTIMAL"
    elif res["best_day"] == res["d_now"]:
        why = "AT_LOW"
    elif res["saving_pct"] < TAU:
        why = "SMALL_SAVING"
    elif res["action"] == "DROP_EXPECTED":
        why = "FALLING"
    else:
        why = "LATER_LOW"
    expected = "BUY_NOW" if why in BUY_WHY else ("DROP_EXPECTED" if why == "FALLING" else "WAIT")
    if expected != res["action"]:
        raise ValueError(f"이유 {why}는 {expected}인데 모델은 {res['action']} — recommend_action 규칙이 바뀌었는지 확인한다")
    action = res["action"]
    return {
        "action": action,
        "why": why,
        "bestDay": int(res["best_day"]),
        "bestPrice": won(res["best_price"]),
        "waitDays": int(res["wait_days"]),
        "saving": won(res["saving"]),
        "savingPct": round(float(res["saving_pct"]), 1),
        "globalBestDay": int(res["global_best_day"]),
        "confidence": None if action == "BUY_NOW" else CONFIDENCE[res["confidence"]],
    }


def slug(name: str) -> str:
    """공휴일 영어 이름 → 코드 조각(소문자, 영숫자 밖은 밑줄)."""
    return re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")


def holiday_codes(dates: list[str], holidays: list[tuple[pd.Timestamp, str]]) -> dict[str, str]:
    """출발일 → 가장 가까운(±3일 안) 공휴일 코드. 거리가 같으면 목록 앞쪽(한국 먼저)."""
    out: dict[str, str] = {}
    for d in dates:
        t = pd.Timestamp(d)
        near = [(abs((t - h).days), i, code) for i, (h, code) in enumerate(holidays) if abs((t - h).days) <= HOLIDAY_WINDOW]
        if near:
            out[d] = min(near)[2]
    return out


def build_band(series: dict, base: dict[tuple[str, str], float], dates: list[str], as_of: str) -> dict:
    """출발일마다 12개 조합의 lo·hi를 노선·등급 평균 대비 %로 바꿔 평균한다(%×10 정수, 지형과 같은 양자화)."""
    out = {"asOf": as_of, "dates": [], "lo": [], "hi": []}
    for i, d in enumerate(dates):
        lo, hi = [], []
        for key, s in series.items():
            if s is None or s["price"][i] is None:
                continue
            lo.append((s["lo"][i] / base[key] - 1) * 100)
            hi.append((s["hi"][i] / base[key] - 1) * 100)
        if not lo:
            continue
        out["dates"].append(d)
        out["lo"].append(round(sum(lo) / len(lo) * 10))
        out["hi"].append(round(sum(hi) / len(hi) * 10))
    return out


def choose_default(series: dict, dates: list[str]) -> dict:
    """데모를 처음 열 때 보여 줄 조합. 추천의 대부분이 '지금 구매'라 아무 조합이나 보여 주면 심심하므로
    가격 하락 예상 중 절약률이 가장 큰 것을 고른다(스펙 §6.1). 없으면 대기 추천, 그다음 지금 구매.

    같은 action 안에서는 먼저 DEFAULT_DAY_RANGE(D-day 14~75) 안에서만 찾고, 그 범위에 해당 action이
    하나도 없을 때만 전체 출발일로 넓힌다 — savingPct가 날짜가 멀수록 커지도록 설계돼 있어, 범위를
    두지 않으면 거의 항상 마지막 날(D+90)만 골라 데모 첫 화면이 매번 똑같아진다."""
    i_lo, i_hi = DEFAULT_DAY_RANGE[0] - FIRST_DAY, DEFAULT_DAY_RANGE[1] - FIRST_DAY
    for action in PREFERENCE:
        for restrict in (True, False):
            best = None
            for key, s in series.items():
                if not s:
                    continue
                for i, r in enumerate(s["reco"]):
                    if restrict and not (i_lo <= i <= i_hi):
                        continue
                    if r and r["action"] == action and (best is None or r["savingPct"] > best[0]):
                        best = (r["savingPct"], key, dates[i])
            if best:
                route, cabin = best[1].split("/")
                return {"route": route, "cabin": cabin, "date": best[2]}
    raise SystemExit("예측이 하나도 없다 — 대표 편 조건(REP_WINDOW_DAYS, REP_MIN_ROWS)을 확인한다")


def load_holidays(dates: list[str]) -> list[tuple[pd.Timestamp, str]]:
    """workalendar(항공권 저장소 공휴일 피처와 같은 라이브러리)에서 한·일 공휴일과 코드를 모은다.
    한국을 먼저 넣어, 거리가 같으면 한국 공휴일 이름을 보여 준다. 일본 오봉(8/13~16)은 항공권
    저장소가 따로 더하지만 데모 출발일 범위(9월 말~12월)에 없어 넣지 않는다."""
    from workalendar.asia import Japan, SouthKorea
    # 출발일 범위 앞뒤로도 ±3일 창이 걸칠 수 있어(연말·연초 경계) 전년·다음 해도 같이 모은다
    years = sorted({int(d[:4]) for d in dates} | {int(dates[0][:4]) - 1, int(dates[-1][:4]) + 1})
    out: list[tuple[pd.Timestamp, str]] = []
    for prefix, cal in (("kr", SouthKorea()), ("jp", Japan())):
        for y in years:
            out += [(pd.Timestamp(day), f"{prefix}_{slug(name)}") for day, name in cal.holidays(y)]
    return out


def quiet() -> contextlib.ExitStack:
    """NeuralProphet·V2Predictor가 예측마다 찍는 로그를 삼킨다(항공권 저장소 CLAUDE.md의 시뮬레이션 재현 방법)."""
    buf = io.StringIO()
    stack = contextlib.ExitStack()
    stack.enter_context(contextlib.redirect_stdout(buf))
    stack.enter_context(contextlib.redirect_stderr(buf))
    return stack


def forecast_series(predictor, route: str, cabin: str, rep: dict, dates: list[str], as_of: str) -> dict:
    origin, dest = route.split("_")
    price, lo, hi, reco = [], [], [], []
    for day in dates:
        dep = pd.Timestamp(day)
        with quiet():
            res = predictor.recommend_action(
                origin=origin, destination=dest, departure_date=day, today=as_of,
                airline=rep["airline"], airline_class=cabin, stops=rep["stops"],
                duration_minutes=rep["duration_minutes"], departure_hour=rep["departure_hour"],
                # 수집기(collect_data.py)와 같은 정의: 금·토·일 출발이 주말 편
                is_weekend_flight=int(dep.weekday() >= 4), departure_month=dep.month,
            )
        if res["price_now_low"] is None or res["price_now_high"] is None:
            raise SystemExit("pkl에 예측 구간 모델(q_models)이 없다 — 항공권 저장소에서 재학습이 필요하다")
        price.append(won(res["price_now"]))
        lo.append(won(res["price_now_low"]))
        hi.append(won(res["price_now_high"]))
        reco.append(encode_reco(res))
    return {"price": price, "lo": lo, "hi": hi, "reco": reco}


def write_json(path: Path, obj: dict, limit: int) -> None:
    body = json.dumps(obj, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    size = len(gzip.compress(body))
    if size > limit:
        raise SystemExit(f"{path.name} gzip {size:,}B > 목표 {limit:,}B — 출발일을 주 단위로 줄여야 한다(스펙 §6.2)")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(body)
    print(f"{path.name}: gzip {size:,}B", flush=True)


def main() -> None:
    as_of = json.loads(METRICS_PATH.read_text(encoding="utf-8"))["_meta"]["asOf"]
    raw = pd.read_csv(AIRFARE_ROOT / "data" / "raw" / "flight_prices.csv")
    kept, _ = split_rows(raw, as_of)
    dates = depart_dates(as_of)
    reps = pick_representatives(kept, as_of)

    from src.models.v2_predictor import load_predictor  # NeuralProphet·torch를 끌고 오는 무거운 import라 여기서 한다
    from src.models.lookup_features import LOOKUP_VARIANT
    with quiet():
        predictor = load_predictor()
    # quiet()가 load_predictor의 lookup 구성 불일치 경고(stdout)를 삼키므로, 여기서 직접 다시 확인해
    # 낡은 pkl로 조용히 예측하지 않게 한다
    saved = getattr(predictor, "lookup_variant", None)
    if saved is not None and saved != LOOKUP_VARIANT:
        raise SystemExit(f"pkl lookup 구성 {saved} ≠ 코드 {LOOKUP_VARIANT} — 항공권 저장소에서 재학습이 필요하다")

    series: dict[tuple[str, str], dict | None] = {}
    for (route, cabin), rep in reps.items():
        label = "대표 편 없음" if rep is None else f"{rep['airline']} {rep['departure_hour']}시 경유{rep['stops']}"
        print(f"{route}/{cabin}: {label}", flush=True)
        series[(route, cabin)] = None if rep is None else forecast_series(predictor, route, cabin, rep, dates, as_of)

    demo = {
        "asOf": as_of,
        "precomputed": True,
        "routes": ROUTES,
        "cabins": CABINS,
        "dates": dates,
        "holidays": holiday_codes(dates, load_holidays(dates)),
        "series": {f"{r}/{c}": s for (r, c), s in series.items()},
    }
    write_json(ROOT / "public" / "data" / f"demo.{as_of}.json", demo, MAX_GZIP_BYTES)
    write_json(ROOT / "public" / "data" / f"band.{as_of}.json",
               build_band(series, route_class_base(kept), dates, as_of), BAND_MAX_GZIP_BYTES)

    default = choose_default(demo["series"], dates)
    facts = json.loads(FACTS_PATH.read_text(encoding="utf-8"))
    facts["demoDefault"] = default
    FACTS_PATH.write_text(json.dumps(facts, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    counts = Counter(r["action"] for s in series.values() if s for r in s["reco"] if r)
    print(f"추천 분포: {dict(counts)}")
    print(f"기본 조합(facts.demoDefault): {default}")
    print("공휴일 코드:", ", ".join(sorted(set(demo["holidays"].values()))))


if __name__ == "__main__":
    main()
