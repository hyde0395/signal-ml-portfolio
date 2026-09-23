"""public/data/terrain.<기준일>.json을 만든다 — 사이트 3D 지형의 데이터.

- 높이는 노선·등급 평균 대비 %다. 같은 편 평균으로 나누면 출발일 효과까지 지워져
  공휴일 봉우리가 사라지기 때문이다(스펙 §5.2, 2026-09-23 사용자 승인).
- 신호 = 칸(예약 시점 × 출발일) 평균, 잡음 = 칸 × 노선 × 등급 평균. 빈 칸은 만들지 않는다.
- 제거 레이어 = 직항 타당성 필터가 걸러낸 행(9,387행)의 칸 평균. 정상 행의 노선·등급
  평균을 기준으로 재므로 높이 떠 있고, 3-3 챕터에서 떨어져 나가는 연출에 쓴다.
- 개별 행은 내보내지 않는다(원본 비공개 원칙). 평균값만 정수로 양자화해 저장한다.

실행: npm run terrain
"""
from __future__ import annotations

import gzip
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from export_facts import AIRFARE_ROOT, METRICS_PATH  # noqa: E402  (AIRFARE_ROOT를 sys.path에 넣는 부수효과 포함)
from src.processing.constants import DURATION_MAX, PRICE_FLOOR  # noqa: E402
from src.processing.features import (  # noqa: E402
    add_jp_holiday_features,
    add_kr_holiday_features,
    drop_implausible_direct_flights,
    drop_inconsistent_flight_times,
)

ROOT = Path(__file__).resolve().parents[1]
CLIP_MIN, CLIP_MAX = -60, 200          # 화면에 그릴 % 범위. 넘는 값은 잘라서 저장한다
MAX_GZIP_BYTES = 300 * 1024            # 스펙 §5.2 용량 목표
CELL = ["days_to_departure", "departure_date"]
ROUTE_CLASS = ["origin", "destination", "airline_class"]
# 예약 곡선(curve) 레이어 전용: "같은 편"을 식별하는 키. 항공권 저장소
# realized_wait_analysis.py의 FLIGHT_KEY와 같다(그쪽은 파싱된 날짜 열 이름이 "dep").
# 노선·등급 평균이 아니라 편(항공권) 평균을 기준으로 삼아야 출발일 간 가격차(−37~+63%p)가
# 예약 곡선(±8%p 안팎)을 덮어 가리지 않는다.
FLIGHT_KEY = ["origin", "destination", "airline", "airline_class", "stops", "departure_time_raw", "departure_date"]
# 항공권 저장소 모델(V2Predictor.MAX_DTD = 90)과 CLAUDE.md 실측 예약 곡선 표(model_metrics.json의
# bookingCurve)가 D-61~90에서 끝나는 것과 같은 범위.
CURVE_MAX_DTD = 90
# model_metrics.json bookingCurve와 같은 8구간 경계(realized_wait_analysis.booking_curve의
# pd.cut([0, 3, 7, 14, 21, 30, 45, 60, MAX_DTD])와 동일)
CURVE_BINS = [0, 3, 7, 14, 21, 30, 45, 60, CURVE_MAX_DTD]


def split_rows(raw: pd.DataFrame, as_of: str) -> tuple[pd.DataFrame, pd.DataFrame]:
    """기준일까지 자르고 export_facts.apply_filters와 같은 순서로 거른다.
    (정상 행, 직항 타당성 필터로 제거된 행)을 돌려준다."""
    cutoff = pd.Timestamp(as_of) + pd.Timedelta(days=1)
    df = raw[pd.to_datetime(raw["fetch_timestamp"]) < cutoff]
    df = df[df["duration_minutes"].notna() & (df["duration_minutes"] <= DURATION_MAX)]
    df = df[df["price"] >= PRICE_FLOOR]
    df = drop_inconsistent_flight_times(df)
    kept = drop_implausible_direct_flights(df)
    removed = df.loc[~df.index.isin(kept.index)]
    return kept.copy(), removed.copy()


def add_route_class_pct(kept: pd.DataFrame, removed: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    """정상 행의 노선·등급 평균을 기준으로 두 표에 pct 열을 붙인다."""
    base = kept.groupby(ROUTE_CLASS)["price"].mean().rename("base")
    out = []
    for df in (kept, removed):
        df = df.join(base, on=ROUTE_CLASS) if len(df) else df.assign(base=pd.Series(dtype=float))
        df["pct"] = (df["price"] / df["base"] - 1) * 100
        out.append(df)
    return out[0], out[1]


def load_completed_daily(kept: pd.DataFrame, as_of: str) -> pd.DataFrame:
    """예약 곡선 전용 원본 행: 항공권 저장소 realized_wait_analysis.load_daily()와 같은 방식으로
    (항공편, 수집일) 당 최저가 1행을 만들고, 출발일이 기준일(as_of) 이전인(경로가 완결된) 편만
    남긴다. kept(= split_rows의 필터·기준일 컷오프를 이미 거친 행)에서 시작하므로 사이트와
    항공권 저장소가 같은 필터를 쓴다. load_daily()는 raw 전체의 마지막 수집일을 컷오프로 쓰지만,
    여기서는 kept가 이미 as_of까지만 있으므로 as_of 자체를 컷오프로 쓴다(라운드 4 컨트롤러 지시)."""
    df = kept.copy()
    df["fetch_date"] = pd.to_datetime(df["fetch_timestamp"]).dt.normalize()
    df["dep"] = pd.to_datetime(df["departure_date"])
    df["dtd"] = (df["dep"] - df["fetch_date"]).dt.days
    daily = (
        df.groupby(FLIGHT_KEY + ["fetch_date"], as_index=False)
        .agg(price=("price", "min"), dtd=("dtd", "first"), dep=("dep", "first"))
    )
    cutoff = pd.Timestamp(as_of)
    return daily[daily["dep"] <= cutoff].reset_index(drop=True)


def _centre_log_price(daily: pd.DataFrame) -> pd.DataFrame:
    """dtd 1~CURVE_MAX_DTD로 자른 뒤, 편(FLIGHT_KEY) 평균 로그가격 대비로 중심화한 로그가격(lp_c)을
    붙인다. realized_wait_analysis.booking_curve()와 같은 순서(자르고 나서 그 부분집합으로 편 평균을
    구함)라야 같은 값이 나온다."""
    x = daily[daily["dtd"].between(1, CURVE_MAX_DTD)].copy()
    lp = np.log(x["price"])
    x["lp_c"] = lp - lp.groupby([x[k] for k in FLIGHT_KEY]).transform("mean")
    return x


def build_curve(daily: pd.DataFrame) -> pd.DataFrame:
    """예약 곡선(3-2 인사이트 장면 전용): realized_wait_analysis.booking_curve()와 같은 정의를
    dtd 하나 단위로 푼 것 — 편 평균 로그가격 대비로 중심화한 값을 dtd별로 평균하고 expm1로 %로
    되돌린다. 8구간 집계(booking_curve_buckets)는 model_metrics.json의 bookingCurve와 값이 같아야
    하고, 이 함수는 3D 시각화를 위해 그 평균을 dtd 91개로 더 잘게 쪼갠 것뿐이라 같은 정의를 쓴다.
    임의의 표본 수 임계값으로 점을 빼지 않는다(라운드 4: ad-hoc 이상치 제외 금지)."""
    x = _centre_log_price(daily)
    curve = x.groupby("dtd", as_index=False)["lp_c"].mean()
    curve["pct"] = np.expm1(curve["lp_c"]) * 100
    return curve.rename(columns={"dtd": "days_to_departure"})[["days_to_departure", "pct"]]


def booking_curve_buckets(daily: pd.DataFrame) -> pd.DataFrame:
    """model_metrics.json의 bookingCurve와 같은 8구간 집계(검증용). realized_wait_analysis.
    booking_curve()를 그대로 옮긴 것: 구간 평균은 dtd별 평균이 아니라 구간 안 모든 행의 중심화
    로그가격을 직접 평균한다(가중치가 dtd별로 균등하지 않고 행 수를 따른다)."""
    x = _centre_log_price(daily)
    x["bin"] = pd.cut(x["dtd"], CURVE_BINS)
    cur = x.groupby("bin", observed=True)["lp_c"].agg(mean="mean", n="count")
    cur["pct"] = np.expm1(cur["mean"]) * 100
    return cur


def encode_curve(curve: pd.DataFrame) -> dict[str, list[int]]:
    """curve는 칸이 아니라 예약 시점(dtd) 하나짜리 값이라 date 열이 없다."""
    pct = (curve["pct"].clip(CLIP_MIN, CLIP_MAX) * 10).round().astype(int)
    return {"dtd": curve["days_to_departure"].astype(int).tolist(), "pct": pct.tolist()}


def build_layers(kept: pd.DataFrame, removed: pd.DataFrame) -> dict[str, pd.DataFrame]:
    """세 레이어를 칸 단위 평균으로 집계한다."""
    def agg(df: pd.DataFrame, keys: list[str]) -> pd.DataFrame:
        if len(df) == 0:
            return pd.DataFrame(columns=CELL + ["pct"])
        return df.groupby(keys, as_index=False)["pct"].mean()[CELL + ["pct"]]
    return {
        "signal": agg(kept, CELL),
        "noise": agg(kept, CELL + ROUTE_CLASS),
        "removed": agg(removed, CELL),
    }


def encode_layer(layer: pd.DataFrame, dates: list[str]) -> dict[str, list[int]]:
    """열 방향 정수 배열로 바꾼다. pct는 %×10, CLIP 범위로 자른다."""
    index = {d: i for i, d in enumerate(dates)}
    pct = (layer["pct"].clip(CLIP_MIN, CLIP_MAX) * 10).round().astype(int)
    return {
        "dtd": layer["days_to_departure"].astype(int).tolist(),
        "date": layer["departure_date"].map(index).astype(int).tolist(),
        "pct": pct.tolist(),
    }


def holiday_indices(dates: list[str]) -> list[int]:
    """한·일 공휴일 ±3일에 해당하는 출발일의 인덱스(항공권 저장소 피처와 같은 정의)."""
    df = pd.DataFrame({"departure_date": dates})
    df = add_jp_holiday_features(add_kr_holiday_features(df))
    near = (df["is_kr_near_holiday"] == 1) | (df["is_jp_near_holiday"] == 1)
    return [i for i, flag in enumerate(near.tolist()) if flag]


def build_terrain(raw: pd.DataFrame, as_of: str) -> dict:
    kept, removed = split_rows(raw, as_of)
    curve = build_curve(load_completed_daily(kept, as_of))  # 노선·등급 pct를 붙이기 전(원가 기준)에 계산한다
    kept, removed = add_route_class_pct(kept, removed)
    layers = build_layers(kept, removed)
    dates = sorted(kept["departure_date"].unique().tolist())
    # 제거 레이어의 출발일이 정상 행에 없으면 그 칸은 버린다(좌표를 둘 곳이 없음)
    layers["removed"] = layers["removed"][layers["removed"]["departure_date"].isin(dates)]
    return {
        "asOf": as_of,
        "maxDtd": int(kept["days_to_departure"].max()),
        "clip": {"min": CLIP_MIN, "max": CLIP_MAX},
        "dates": dates,
        "holiday": holiday_indices(dates),
        "curve": encode_curve(curve),
        **{name: encode_layer(layer, dates) for name, layer in layers.items()},
    }


def main() -> None:
    as_of = json.loads(METRICS_PATH.read_text(encoding="utf-8"))["_meta"]["asOf"]
    raw = pd.read_csv(AIRFARE_ROOT / "data" / "raw" / "flight_prices.csv")
    terrain = build_terrain(raw, as_of)
    body = json.dumps(terrain, separators=(",", ":")).encode("utf-8")
    size = len(gzip.compress(body))
    if size > MAX_GZIP_BYTES:
        raise SystemExit(f"terrain.json gzip {size:,}B > 목표 {MAX_GZIP_BYTES:,}B — 잡음 레이어를 줄여야 한다")
    out = ROOT / "public" / "data" / f"terrain.{as_of}.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_bytes(body)
    counts = {k: len(terrain[k]["pct"]) for k in ("signal", "noise", "removed", "curve")}
    print(f"{out.name}: {counts}, 공휴일 출발일 {len(terrain['holiday'])}개, gzip {size:,}B")
    curve_pct = [v / 10 for v in terrain["curve"]["pct"]]
    curve_dtd = terrain["curve"]["dtd"]
    lo_i, hi_i = curve_pct.index(min(curve_pct)), curve_pct.index(max(curve_pct))
    print(f"curve pct: min {curve_pct[lo_i]:+.1f}% at dtd={curve_dtd[lo_i]}, max {curve_pct[hi_i]:+.1f}% at dtd={curve_dtd[hi_i]}")


if __name__ == "__main__":
    main()
