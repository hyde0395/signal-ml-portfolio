"""public/data/map.v1.json을 만든다 — 3-1 챕터에서 점들이 이루는 한·일 지도 장면.

- 해안선: Natural Earth 50m coastline(공공 도메인)을 내려받아 한·일 범위만 자르고,
  점이 고르게 퍼지도록 일정 간격으로 다시 샘플링한다.
- 노선: 인천 → 나리타·하네다·간사이 세 노선을 북쪽으로 살짝 휜 곡선으로 만든다
  (돌아오는 노선은 같은 선이라 따로 그리지 않는다).
- 지도는 데이터 축이 아니라 "이 노선에서 모은 데이터"라는 맥락 장면이다(스펙 §5.2.1).

실행: npm run map   (원본은 scripts/.cache/에 한 번만 받아 둔다)
"""
from __future__ import annotations

import json
import math
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / "scripts" / ".cache" / "ne_50m_coastline.geojson"
SOURCE = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_coastline.geojson"
BBOX = (124.5, 30.0, 146.0, 45.6)          # 경도 최소, 위도 최소, 경도 최대, 위도 최대
STEP = 0.035                               # 재샘플링 간격(도). 약 5~6천 점이 나오는 값 (0.05→2948점이라 감소)
AIRPORTS = {"ICN": (126.45, 37.46), "NRT": (140.39, 35.77), "HND": (139.78, 35.55), "KIX": (135.24, 34.43)}
ROUTES = [("ICN", "NRT"), ("ICN", "HND"), ("ICN", "KIX")]

Point = tuple[float, float]


def inside(p: Point, bbox=BBOX) -> bool:
    return bbox[0] <= p[0] <= bbox[2] and bbox[1] <= p[1] <= bbox[3]


def clip_line(line: list[Point], bbox=BBOX) -> list[list[Point]]:
    """범위 밖으로 나가는 지점에서 선을 끊어, 범위 안 조각들만 돌려준다."""
    parts, cur = [], []
    for p in line:
        if inside(p, bbox):
            cur.append(p)
        elif cur:
            parts.append(cur)
            cur = []
    if cur:
        parts.append(cur)
    return [c for c in parts if len(c) >= 2]


def resample(line: list[Point], step: float = STEP) -> list[Point]:
    """선을 따라 step 간격으로 점을 다시 찍는다(원본 꼭짓점 밀도와 무관하게 고르게)."""
    out = [line[0]]
    carry = 0.0
    for (x0, y0), (x1, y1) in zip(line, line[1:]):
        seg = math.hypot(x1 - x0, y1 - y0)
        d = step - carry
        while d <= seg + 1e-12:
            t = d / seg
            out.append((round(x0 + (x1 - x0) * t, 6), round(y0 + (y1 - y0) * t, 6)))
            d += step
        carry = seg - (d - step)
    return out


def route_curve(a: Point, b: Point, n: int = 150) -> list[Point]:
    """두 공항을 잇는 2차 베지어 곡선. 조절점을 중점에서 북쪽으로 올려 호처럼 보이게 한다."""
    mx, my = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
    lift = math.hypot(b[0] - a[0], b[1] - a[1]) * 0.25
    c = (mx, my + lift)
    pts = []
    for i in range(n):
        t = i / (n - 1)
        x = (1 - t) ** 2 * a[0] + 2 * (1 - t) * t * c[0] + t ** 2 * b[0]
        y = (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * c[1] + t ** 2 * b[1]
        pts.append((round(x, 6), round(y, 6)))
    pts[0], pts[-1] = a, b
    return pts


def encode_pairs(pts: list[Point]) -> list[int]:
    return [v for p in pts for v in (round(p[0] * 100), round(p[1] * 100))]


def load_coastline() -> list[list[Point]]:
    if not CACHE.exists():
        CACHE.parent.mkdir(parents=True, exist_ok=True)
        urllib.request.urlretrieve(SOURCE, CACHE)
    geo = json.loads(CACHE.read_text(encoding="utf-8"))
    lines = []
    for f in geo["features"]:
        g = f["geometry"]
        for line in ([g["coordinates"]] if g["type"] == "LineString" else g["coordinates"]):
            lines.append([(float(x), float(y)) for x, y in line])
    return lines


def build_map() -> dict:
    coast: list[Point] = []
    for line in load_coastline():
        for part in clip_line(line):
            coast.extend(resample(part))
    return {
        "bbox": list(BBOX),
        "coast": encode_pairs(coast),
        "routes": [{"from": f, "to": t, "pts": encode_pairs(route_curve(AIRPORTS[f], AIRPORTS[t]))} for f, t in ROUTES],
        "airports": [{"code": c, "lon": lon, "lat": lat} for c, (lon, lat) in AIRPORTS.items()],
    }


def main() -> None:
    data = build_map()
    out = ROOT / "public" / "data" / "map.v1.json"
    out.write_text(json.dumps(data, separators=(",", ":")), encoding="utf-8")
    print(f"{out.name}: 해안선 {len(data['coast']) // 2}점, 노선 {len(data['routes'])}개")


if __name__ == "__main__":
    main()
