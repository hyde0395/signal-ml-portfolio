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
# 예약 곡선(curve) 레이어 전용: "같은 편"을 식별하는 키. 노선·등급 평균이 아니라 편(항공권) 평균을
# 기준으로 삼아야 출발일 간 가격차(−37~+63%p)가 예약 곡선(±8%p 안팎)을 덮어 가리지 않는다.
FLIGHT_KEY = ["origin", "destination", "airline", "airline_class", "stops", "departure_time_raw", "departure_date"]
# 항공권 저장소 모델(V2Predictor.MAX_DTD = 90)과 CLAUDE.md 실측 예약 곡선 표가 D-61~90에서 끝나는 것과
# 같은 범위. 그보다 먼 dtd는 주 1회 수집이라 편당 관측이 한두 번뿐이라 편 평균 대비 %가 표본이 너무
# 적어 요동친다(dtd=101에서 +25%까지 튐) — U자를 가리는 잡음이라 curve 계산에서 제외한다.
CURVE_MAX_DTD = 90
# dtd=84는 표본이 42건뿐이라(다른 dtd는 대부분 250건 이상) 편 평균이 요동쳐 −8.7%p로 튀며 U자
# 한가운데 가짜 봉우리를 만든다(1차 계산 후 실측 확인). 표본이 이 미만인 dtd는 점을 아예 빼서
# "적은 관측을 믿을 만한 값처럼 보이지 않게" 한다(보간이 아니라 제외).
CURVE_MIN_ROWS = 50


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


def build_curve(kept: pd.DataFrame, min_rows: int = CURVE_MIN_ROWS) -> pd.DataFrame:
    """예약 곡선(3-2 인사이트 장면 전용): 행마다 같은 편(FLIGHT_KEY) 평균 대비 %를 구한 뒤
    예약 시점(dtd)별로 평균한다. 칸(dtd×출발일) 평균이 아니라 이 값을 쓰는 이유는, 출발일마다
    가격대가 크게 달라(−37~+63%) 칸 평균 그래프로는 U자 예약 곡선(±8%p 안팎)이 안 보이기
    때문이다(Task 7 라운드 3 결함 B). 보간이 아니라 실측 평균이고, 표본이 min_rows 미만인 dtd는
    빼서 요동치는 값이 U자를 가리지 않게 한다."""
    kept = kept[kept["days_to_departure"] <= CURVE_MAX_DTD]
    if len(kept) == 0:
        return pd.DataFrame(columns=["days_to_departure", "pct"])
    flight_mean = kept.groupby(FLIGHT_KEY)["price"].transform("mean")
    flight_pct = (kept["price"] / flight_mean - 1) * 100
    curve = (
        kept.assign(flight_pct=flight_pct)
        .groupby("days_to_departure")["flight_pct"]
        .agg(pct="mean", n="size")
        .reset_index()
    )
    return curve[curve["n"] >= min_rows][["days_to_departure", "pct"]]


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
    curve = build_curve(kept)  # 노선·등급 pct를 붙이기 전(원가 기준)에 계산한다
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
