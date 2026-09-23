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
    counts = {k: len(terrain[k]["pct"]) for k in ("signal", "noise", "removed")}
    print(f"{out.name}: {counts}, 공휴일 출발일 {len(terrain['holiday'])}개, gzip {size:,}B")


if __name__ == "__main__":
    main()
