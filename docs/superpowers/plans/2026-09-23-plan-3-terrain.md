# SIGNAL 계획 3/4 — 3D 가격 지형 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 실제 항공권 데이터로 만든 점 지형(신호 + 잡음 두 겹)을 화면 뒤 고정 캔버스에 그린다. 스크롤에 따라 카메라가 챕터별로 움직이고, 3-1에서는 한·일 해안선과 노선 궤적 모양이 되며, 3-3에서는 잘못 매칭된 점들이 떨어져 나간다. 3D를 쓸 수 없는 환경에서는 챕터별 정적 이미지로 대신한다.

**Architecture:** Python 스크립트 두 개가 `public/data/terrain.<기준일>.json`(신호·잡음·제거 레이어)과 `public/data/map.v1.json`(해안선·노선)을 만든다. 사이트는 순수 함수(`src/three/data.ts`, `scenes.ts`, `activeScene.ts`, `capability.ts`)로 JSON을 점 좌표 배열로 바꾸고, 장면 상태를 정하고, 활성 챕터를 고른다. React Three Fiber 캔버스(`TerrainScene`)는 점 하나당 목표 좌표 세 개(흩어짐·지형·지도)를 속성으로 받는 `Points` 하나를 그리고, 셰이더 uniform을 목표 장면 상태로 부드럽게 옮긴다. `Backdrop`이 기기 능력을 판단해 첫 화면 텍스트가 뜬 뒤 캔버스를 지연 로딩하고, 준비되면 `<html data-3d="on">`을 켜서 정적 대체 이미지를 숨긴다.

**Tech Stack:** three 0.186, @react-three/fiber 9.8, Next.js 16.3 (static export), zod 4, Vitest 5, Playwright 1.63, sharp(대체 이미지 WebP 변환), Python 3.11(항공권 저장소 `.venv`, pandas, pytest)

**Spec:** `docs/superpowers/specs/2026-09-23-portfolio-design.md` (§5.2 지형 데이터 · §5.2.1 지도 장면 · §5.3 3D 구조 · §8.3 기기 조절 · §9.1 대체 화면)

**선행 계획:** 계획 1(기반)이 main에 병합·배포되어 있다. 계획 2(데모)보다 먼저 한다(사용자 결정 2026-09-23).

## Global Constraints

- 색: 배경 `#070B16`, 그라데이션 `#13203A`, 데이터 점 `#8FB8FF`, 텍스트 `#EEF3FF`, 포인트 호박색 `#FFB547`. 다른 색을 새로 만들지 않는다(제거 레이어는 `#EEF3FF`)
- **지형 높이 = 노선·등급 평균 대비 %** (같은 편 평균 아님). 신호 = 칸(예약 시점 × 출발일) 평균, 잡음 = 칸 × 노선 × 등급 평균. **빈 칸 보간 금지**, 모든 점은 실제 평균값
- 공휴일 = 한·일 공휴일 ±3일 출발일(항공권 저장소 `add_kr_holiday_features`/`add_jp_holiday_features`의 `is_*_near_holiday`), 호박색
- 기준일 `2026-09-22`까지의 행만 쓴다(`fetch_timestamp` < 2026-09-23). 필터는 `scripts/export_facts.py`의 `apply_filters`와 같은 순서
- `terrain.json` gzip ≤ 300KB. 파일 이름에 기준일(`terrain.2026-09-22.json`), 사이트는 `facts.dataVersion`으로 찾는다
- 3D는 첫 화면 텍스트가 뜬 뒤 지연 로딩(`next/dynamic`, `ssr: false`). 초기 JS에 three가 들어가면 안 된다
- 대체 화면 조건: `prefers-reduced-motion`, WebGL 없음, `deviceMemory ≤ 2`, 30fps 미만 2초 지속(1단계: DPR 1·잡음 숨김 → 2단계: 대체 화면)
- 모바일(세로 화면): 잡음 점 절반, DPR ≤ 1.5, 카메라는 세로용 지점
- 탭이 숨겨졌거나 연락처 섹션이 보이면 렌더를 멈춘다
- 캔버스는 `aria-hidden`, 대체 이미지는 3개 언어 대체 텍스트. 문구 파일에 숫자 직접 기입 금지(계획 1 테스트가 강제)
- 원본 CSV와 개별 행은 공개하지 않는다(평균값만 JSON에)
- **코드에 한국어 주석**: 파일 머리에 역할 한두 줄, 이유가 안 보이는 로직에 "왜"(사용자 요청)
- 커밋 작성자는 noreply 주소(이미 설정됨). 평문 이메일을 어디에도 쓰지 않는다
- 사용자와의 대화는 한국어

## Review Focus

1. **WebGL이 없거나 움직임 줄이기를 켠 방문자**: 캔버스 없이 챕터별 대체 이미지와 모든 본문이 보여야 한다 → Task 9 e2e(`reducedMotion: 'reduce'`)
2. **JS가 꺼진 방문자**: 서버 HTML만으로 대체 이미지가 보여야 한다(기본값이 "3D 꺼짐") → Task 9 e2e(`javaScriptEnabled: false`)
3. **데이터 JSON을 못 받아 온 경우**(네트워크 오류·404): 빈 캔버스로 텍스트를 가리지 말고 대체 화면으로 돌아가야 한다 → Task 6 단위 테스트(`loadSceneData` 실패 경로) + Task 9 e2e(요청 차단)
4. **첫 화면 텍스트가 3D 때문에 늦게 뜨는 것**: 초기 JS 청크에 three가 없어야 한다 → Task 9 빌드 산출물 검사
5. **본문 가독성**: 캔버스 위 텍스트가 WCAG AA 대비를 유지해야 한다 → Task 9 axe(3D 켜진 상태)

---

## File Structure

```
scripts/
  export_terrain.py            terrain.<기준일>.json 생성 (신호·잡음·제거 레이어, 공휴일)
  export_map.py                map.v1.json 생성 (한·일 해안선 재샘플링, 노선 궤적)
  tests/test_export_terrain.py
  tests/test_export_map.py
  capture-fallbacks.mjs        캡처 모드로 장면을 찍어 public/fallback/*.webp 생성
  .cache/                      (git 무시) Natural Earth 원본 캐시
public/data/terrain.2026-09-22.json, public/data/map.v1.json
public/fallback/{hero,problem,insight,bubble,interval}.webp
src/three/
  data.ts            JSON 스키마(zod) + 점 좌표 배열 만들기(순수)
  scenes.ts          장면 키 → 카메라·uniform 목표값 표(순수)
  activeScene.ts     뷰포트 중앙에 걸린 섹션/챕터 고르기(순수)
  capability.ts      3D 가능 여부 판단(순수 + 브라우저 감지)
  shaders.ts         정점·조각 셰이더 문자열
  TerrainPoints.tsx  Points 하나 + ShaderMaterial, uniform 감쇠
  CameraRig.tsx      카메라 감쇠 이동 + 첫 화면 마우스 시차
  TerrainScene.tsx   Canvas, 데이터 로딩, 프레임 감시·단계적 하향, 렌더 멈춤, 캡처 모드
src/components/
  Backdrop.tsx       (client) 능력 판단 → 지연 로딩 → <html data-3d> 전환
  sections/ChapterFigure.tsx   대체 이미지 figure
tests/unit/three-data.test.ts, three-scenes.test.ts, three-active.test.ts, three-capability.test.ts
tests/e2e/terrain.spec.ts
```

수정: `src/components/HomePage.tsx`, `sections/Hero.tsx`, `sections/CaseStudy.tsx`, `src/styles/globals.css`, `content/{ko,en,ja}.json`(`figure.*`), `.gitignore`, `package.json`, `CLAUDE.md`, `README.md`

### 좌표계 (모든 Task가 공유)

- 지형 상자: x ∈ [−8, 8] 예약 시점(왼쪽 = 147일 전, 오른쪽 = 출발 당일), z ∈ [−10, 10] 출발일(앞 = 늦은 출발일), y = pct / 100 × 4 (예: +50% → 2.0)
- 지도: 경도 124.5~146, 위도 30~45.6을 등장방형으로 투영. 중심(135.25°, 37.8°), 배율 0.75, 경도에 cos(37.8°) 곱. 북쪽 = −z, y = 0(노선 궤적만 호 모양으로 y > 0)
- 흩어짐: 반지름 14 구 안의 결정적(시드 고정) 난수 좌표

---

### Task 1: `export_terrain.py` — 지형 JSON 생성 (Python)

**Files:**
- Create: `scripts/export_terrain.py`, `scripts/tests/test_export_terrain.py`, `public/data/terrain.2026-09-22.json`
- Modify: `package.json` (스크립트 `terrain`)

**Interfaces:**
- Consumes: `scripts/export_facts.py`의 `AIRFARE_ROOT`, 항공권 저장소 `src.processing.constants.{DURATION_MAX, PRICE_FLOOR}`, `src.processing.features.{drop_inconsistent_flight_times, drop_implausible_direct_flights, add_kr_holiday_features, add_jp_holiday_features}`
- Produces: `public/data/terrain.2026-09-22.json` — 형식:
  ```json
  { "asOf": "2026-09-22", "maxDtd": 147, "clip": { "min": -60, "max": 200 },
    "dates": ["2026-05-15", "..."], "holiday": [0, 1, 2],
    "signal":  { "dtd": [..], "date": [..], "pct": [..] },
    "noise":   { "dtd": [..], "date": [..], "pct": [..] },
    "removed": { "dtd": [..], "date": [..], "pct": [..] } }
  ```
  `date`는 `dates` 배열의 인덱스, `pct`는 (%×10)을 반올림한 정수이며 `clip` 범위(−600~2000)로 자른 값.

- [ ] **Step 1: 실패하는 테스트 `scripts/tests/test_export_terrain.py`**

```python
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
```

- [ ] **Step 2: 실패 확인**

Run: `~/Documents/airfare-forecasting-ml/.venv/bin/python -m pytest scripts/tests/test_export_terrain.py -q`
Expected: FAIL — `ModuleNotFoundError: No module named 'export_terrain'`
(항공권 저장소 import가 멈추면 그쪽 CLAUDE.md "iCloud 동기화 I/O 병목"의 워밍 명령을 먼저 실행한다.)

- [ ] **Step 3: `scripts/export_terrain.py`**

```python
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
```

- [ ] **Step 4: 통과 확인**

Run: `~/Documents/airfare-forecasting-ml/.venv/bin/python -m pytest scripts/tests -q`
Expected: 8 passed (계획 1의 3개 + 새 5개). `holiday_indices` 기대값이 워크캘린더 결과와 다르면(예: 10/2가 한국 공휴일 ±3일에 안 걸림) 실제 한국 공휴일로 날짜를 바꿔 같은 의도를 검사한다.

- [ ] **Step 5: `package.json` 스크립트 추가**

```json
"terrain": "${AIRFARE_ROOT:-$HOME/Documents/airfare-forecasting-ml}/.venv/bin/python scripts/export_terrain.py"
```

- [ ] **Step 6: 실제 데이터로 실행**

Run: `npm run terrain`
Expected: `terrain.2026-09-22.json: {'signal': 약 2070, 'noise': 약 24500, 'removed': 약 1600}, 공휴일 출발일 68개, gzip …B`(300KB 미만). 수치가 크게 다르면(예: signal이 1,000 미만) 멈추고 보고한다.

- [ ] **Step 7: Commit**

```bash
git add scripts/export_terrain.py scripts/tests/test_export_terrain.py public/data/terrain.2026-09-22.json package.json
git commit -m "feat: export terrain layers (signal, noise, removed)"
```

---

### Task 2: `export_map.py` — 한·일 해안선과 노선 궤적 (Python)

**Files:**
- Create: `scripts/export_map.py`, `scripts/tests/test_export_map.py`, `public/data/map.v1.json`
- Modify: `.gitignore` (`scripts/.cache/`), `package.json` (스크립트 `map`)

**Interfaces:**
- Produces: `public/data/map.v1.json` — 형식:
  ```json
  { "bbox": [124.5, 30, 146, 45.6],
    "coast": [12645, 3746, "..."],
    "routes": [ { "from": "ICN", "to": "NRT", "pts": [12645, 3746, "..."] } ],
    "airports": [ { "code": "ICN", "lon": 126.45, "lat": 37.46 } ] }
  ```
  `coast`, `pts`는 (경도×100, 위도×100) 정수 쌍을 이어 붙인 배열.

- [ ] **Step 1: 실패하는 테스트 `scripts/tests/test_export_map.py`**

```python
# export_map의 순수 함수 검사: 범위 자르기, 고른 간격 재샘플링, 노선 곡선, 정수 인코딩.
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import export_map as em  # noqa: E402


def test_resample_even_spacing():
    pts = em.resample([(0.0, 0.0), (1.0, 0.0)], step=0.25)
    assert pts == [(0.0, 0.0), (0.25, 0.0), (0.5, 0.0), (0.75, 0.0), (1.0, 0.0)]


def test_clip_splits_lines_leaving_bbox():
    line = [(125.0, 35.0), (126.0, 35.0), (150.0, 35.0), (127.0, 36.0), (128.0, 36.0)]
    parts = em.clip_line(line, (124.5, 30.0, 146.0, 45.6))
    assert parts == [[(125.0, 35.0), (126.0, 35.0)], [(127.0, 36.0), (128.0, 36.0)]]


def test_route_curve_endpoints_and_count():
    pts = em.route_curve((126.45, 37.46), (140.39, 35.77), n=5)
    assert len(pts) == 5
    assert pts[0] == (126.45, 37.46) and pts[-1] == (140.39, 35.77)
    assert pts[2][1] > (37.46 + 35.77) / 2        # 곡선은 북쪽으로 휜다


def test_encode_pairs():
    assert em.encode_pairs([(126.456, 37.461), (140.0, 35.0)]) == [12646, 3746, 14000, 3500]
```

- [ ] **Step 2: 실패 확인** — Run: `~/Documents/airfare-forecasting-ml/.venv/bin/python -m pytest scripts/tests/test_export_map.py -q` / Expected: FAIL `No module named 'export_map'`

- [ ] **Step 3: `scripts/export_map.py`**

```python
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
STEP = 0.05                                # 재샘플링 간격(도). 약 5~6천 점이 나오는 값
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
```

- [ ] **Step 4: 통과 확인** — Run: `~/Documents/airfare-forecasting-ml/.venv/bin/python -m pytest scripts/tests -q` / Expected: 12 passed

- [ ] **Step 5: `.gitignore`에 `scripts/.cache/` 추가, `package.json`에 스크립트 추가**

```json
"map": "${AIRFARE_ROOT:-$HOME/Documents/airfare-forecasting-ml}/.venv/bin/python scripts/export_map.py"
```

- [ ] **Step 6: 실행** — Run: `npm run map` / Expected: `map.v1.json: 해안선 4000~8000점, 노선 3개`. 범위를 벗어나면 `STEP`을 조정해 그 범위에 넣고 이유를 보고서에 적는다.

- [ ] **Step 7: Commit**

```bash
git add scripts/export_map.py scripts/tests/test_export_map.py public/data/map.v1.json .gitignore package.json
git commit -m "feat: export Korea-Japan coastline and route arcs for map scene"
```

---

### Task 3: 3D 의존성 + `src/three/data.ts` (JSON → 점 좌표)

**Files:**
- Create: `src/three/data.ts`, `tests/unit/three-data.test.ts`
- Modify: `package.json` (의존성)

**Interfaces:**
- Consumes: Task 1·2의 JSON 형식
- Produces:
  - `terrainSchema`, `mapSchema` (zod), `type Terrain`, `type MapData`
  - `WORLD = { width: 16, depth: 20, heightPerPct: 0.04 }`
  - `terrainPosition(dtd: number, dateIdx: number, pct10: number, maxDtd: number, nDates: number): [number, number, number]`
  - `mapPosition(lon: number, lat: number): [number, number]` → `[x, z]`
  - `type PointCloud = { count: number; terrain: Float32Array; map: Float32Array; scatter: Float32Array; kind: Float32Array; holiday: Float32Array; route: Float32Array }` (kind: 0 신호, 1 잡음, 2 제거)
  - `buildPointCloud(t: Terrain, m: MapData, opts: { noiseStride: number; seed?: number }): PointCloud` — 순서: 신호 → 잡음(`noiseStride`마다 하나) → 제거
  - `loadSceneData(dataVersion: string, fetcher?: typeof fetch): Promise<{ terrain: Terrain; map: MapData }>` — 경로 `/data/terrain.<dataVersion>.json`, `/data/map.v1.json`. HTTP 오류나 스키마 불일치면 reject

- [ ] **Step 1: 의존성 설치**

```bash
npm install three@0.186.0 @react-three/fiber@9.8.0
npm install -D @types/three@0.186.0 sharp@0.35.4
```

- [ ] **Step 2: 실패하는 테스트 `tests/unit/three-data.test.ts`**

```ts
// JSON → 점 좌표 변환 검사: 좌표계, 레이어 순서, 잡음 솎아내기, 공휴일·노선 표시, 로딩 실패.
import { describe, expect, it, vi } from 'vitest';
import { buildPointCloud, loadSceneData, mapPosition, terrainPosition, type MapData, type Terrain } from '@/three/data';

const terrain: Terrain = {
  asOf: '2026-09-22', maxDtd: 100, clip: { min: -60, max: 200 },
  dates: ['2026-10-01', '2026-10-02', '2026-10-03'], holiday: [2],
  signal: { dtd: [100, 0], date: [0, 2], pct: [0, 500] },
  noise: { dtd: [50, 50, 50, 50], date: [1, 1, 1, 1], pct: [10, 20, 30, 40] },
  removed: { dtd: [10], date: [1], pct: [2000] },
};
const map: MapData = {
  bbox: [124.5, 30, 146, 45.6],
  coast: [13525, 3780, 13600, 3700],
  routes: [{ from: 'ICN', to: 'NRT', pts: [12645, 3746, 14039, 3577] }],
  airports: [{ code: 'ICN', lon: 126.45, lat: 37.46 }],
};

describe('terrainPosition', () => {
  it('147일 전은 왼쪽 끝, 출발 당일은 오른쪽 끝, +50%는 높이 2', () => {
    expect(terrainPosition(100, 0, 0, 100, 3)).toEqual([-8, 0, -10]);
    expect(terrainPosition(0, 2, 500, 100, 3)).toEqual([8, 2, 10]);
  });
});

describe('mapPosition', () => {
  it('지도 중심은 원점, 북쪽은 -z', () => {
    expect(mapPosition(135.25, 37.8)).toEqual([0, 0]);
    expect(mapPosition(135.25, 38.8)[1]).toBeLessThan(0);
  });
});

describe('buildPointCloud', () => {
  it('신호 → 잡음 → 제거 순서, 잡음은 stride로 솎는다', () => {
    const pc = buildPointCloud(terrain, map, { noiseStride: 2 });
    expect(pc.count).toBe(2 + 2 + 1);
    expect(Array.from(pc.kind)).toEqual([0, 0, 1, 1, 2]);
  });
  it('공휴일 출발일 점만 holiday = 1', () => {
    const pc = buildPointCloud(terrain, map, { noiseStride: 1 });
    expect(pc.holiday[0]).toBe(0);
    expect(pc.holiday[1]).toBe(1);
  });
  it('모든 점이 지도 목표 좌표를 받고, 일부는 노선 궤적 점이다', () => {
    const pc = buildPointCloud(terrain, map, { noiseStride: 1 });
    expect(pc.map.length).toBe(pc.count * 3);
    expect(Array.from(pc.route).some((v) => v === 1)).toBe(true);
    expect(Array.from(pc.map).every(Number.isFinite)).toBe(true);
  });
  it('시드가 같으면 흩어짐 좌표도 같다', () => {
    const a = buildPointCloud(terrain, map, { noiseStride: 1, seed: 7 });
    const b = buildPointCloud(terrain, map, { noiseStride: 1, seed: 7 });
    expect(Array.from(a.scatter)).toEqual(Array.from(b.scatter));
  });
});

describe('loadSceneData', () => {
  const ok = (body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
  it('기준일로 파일을 찾아 두 JSON을 검사해 돌려준다', async () => {
    const fetcher = vi.fn((url: string) => ok(url.includes('terrain') ? terrain : map));
    const data = await loadSceneData('2026-09-22', fetcher as unknown as typeof fetch);
    expect(fetcher).toHaveBeenCalledWith('/data/terrain.2026-09-22.json');
    expect(data.terrain.dates).toHaveLength(3);
  });
  it('404면 reject (빈 캔버스로 텍스트를 가리지 않도록 호출 측이 대체 화면으로 간다)', async () => {
    const fetcher = vi.fn(() => Promise.resolve(new Response('no', { status: 404 })));
    await expect(loadSceneData('2026-09-22', fetcher as unknown as typeof fetch)).rejects.toThrow();
  });
  it('형식이 틀리면 reject', async () => {
    const fetcher = vi.fn(() => ok({ nope: true }));
    await expect(loadSceneData('2026-09-22', fetcher as unknown as typeof fetch)).rejects.toThrow();
  });
});
```

- [ ] **Step 3: 실패 확인** — Run: `npx vitest run tests/unit/three-data.test.ts` / Expected: FAIL `Cannot find module '@/three/data'`

- [ ] **Step 4: `src/three/data.ts`**

```ts
// 3D 장면 데이터: terrain/map JSON을 zod로 검사하고, 점 하나당 목표 좌표(지형·지도·흩어짐)를
// 담은 Float32Array로 바꾼다. React·three에 의존하지 않는 순수 모듈이라 단위 테스트가 쉽다.
import { z } from 'zod';

const ints = z.array(z.number().int());
const layer = z.object({ dtd: ints, date: ints, pct: ints });

export const terrainSchema = z.object({
  asOf: z.string(),
  maxDtd: z.number().int().positive(),
  clip: z.object({ min: z.number(), max: z.number() }),
  dates: z.array(z.string()).min(2),
  holiday: ints,
  signal: layer,
  noise: layer,
  removed: layer,
});
export const mapSchema = z.object({
  bbox: z.array(z.number()).length(4),
  coast: ints,
  routes: z.array(z.object({ from: z.string(), to: z.string(), pts: ints })),
  airports: z.array(z.object({ code: z.string(), lon: z.number(), lat: z.number() })),
});
export type Terrain = z.infer<typeof terrainSchema>;
export type MapData = z.infer<typeof mapSchema>;

// 좌표계는 계획서 "좌표계" 절과 같다. 바꾸면 scenes.ts의 카메라 지점도 함께 바꿔야 한다.
export const WORLD = { width: 16, depth: 20, heightPerPct: 0.04 } as const;
const MAP_CENTER = { lon: 135.25, lat: 37.8 };
const MAP_SCALE = 0.75;
const MAP_COS = Math.cos((MAP_CENTER.lat * Math.PI) / 180);
const ROUTE_ARC_HEIGHT = 1.5;   // 지도 장면에서 노선 궤적이 떠오르는 높이
const ROUTE_SHARE = 5;          // 다섯 점 중 하나를 노선 궤적에 배정한다

export function terrainPosition(dtd: number, dateIdx: number, pct10: number, maxDtd: number, nDates: number): [number, number, number] {
  // 왼쪽 = 먼 예약 시점, 오른쪽 = 출발 당일. 시간이 흐르는 방향을 왼쪽→오른쪽으로 읽게 한다.
  const x = ((maxDtd - dtd) / maxDtd - 0.5) * WORLD.width;
  const y = (pct10 / 10) * WORLD.heightPerPct;
  const z = (dateIdx / (nDates - 1) - 0.5) * WORLD.depth;
  return [round(x), round(y), round(z)];
}

export function mapPosition(lon: number, lat: number): [number, number] {
  return [round((lon - MAP_CENTER.lon) * MAP_SCALE * MAP_COS), round(-(lat - MAP_CENTER.lat) * MAP_SCALE)];
}

export type PointCloud = {
  count: number;
  terrain: Float32Array;
  map: Float32Array;
  scatter: Float32Array;
  kind: Float32Array;
  holiday: Float32Array;
  route: Float32Array;
};

export function buildPointCloud(t: Terrain, m: MapData, opts: { noiseStride: number; seed?: number }): PointCloud {
  // 신호 → 잡음 → 제거 순서로 한 배열에 담는다(Points 하나로 그리기 위해).
  const rows: { dtd: number; date: number; pct: number; kind: number }[] = [];
  const push = (l: Terrain['signal'], kind: number, stride = 1) => {
    for (let i = 0; i < l.pct.length; i += stride) rows.push({ dtd: l.dtd[i], date: l.date[i], pct: l.pct[i], kind });
  };
  push(t.signal, 0);
  push(t.noise, 1, Math.max(1, Math.floor(opts.noiseStride)));
  push(t.removed, 2);

  const count = rows.length;
  const holidays = new Set(t.holiday);
  const out: PointCloud = {
    count,
    terrain: new Float32Array(count * 3),
    map: new Float32Array(count * 3),
    scatter: new Float32Array(count * 3),
    kind: new Float32Array(count),
    holiday: new Float32Array(count),
    route: new Float32Array(count),
  };

  const coast = pairs(m.coast);
  const routes = m.routes.map((r) => pairs(r.pts));
  const rand = mulberry32(opts.seed ?? 1);

  rows.forEach((r, i) => {
    out.terrain.set(terrainPosition(r.dtd, r.date, r.pct, t.maxDtd, t.dates.length), i * 3);
    out.kind[i] = r.kind;
    out.holiday[i] = holidays.has(r.date) ? 1 : 0;

    // 지도 목표: 점 수가 해안선 샘플보다 많으므로 순환 배정하고, 같은 자리에 겹치지 않게 살짝 흔든다.
    const jitter = () => (rand() - 0.5) * 0.06;
    if (routes.length > 0 && i % ROUTE_SHARE === 0) {
      const line = routes[(i / ROUTE_SHARE) % routes.length | 0];
      const k = Math.floor(rand() * line.length);
      const [x, zz] = mapPosition(line[k][0], line[k][1]);
      const arc = Math.sin((k / (line.length - 1)) * Math.PI) * ROUTE_ARC_HEIGHT;
      out.map.set([x + jitter(), arc, zz + jitter()], i * 3);
      out.route[i] = 1;
    } else {
      const [lon, lat] = coast[i % coast.length];
      const [x, zz] = mapPosition(lon, lat);
      out.map.set([x + jitter(), 0, zz + jitter()], i * 3);
    }

    // 흩어짐: 반지름 14 구 안 균일 분포(시드 고정 → 캡처 이미지가 매번 같다)
    const u = rand() * 2 - 1, th = rand() * Math.PI * 2, rr = 14 * Math.cbrt(rand());
    const s = Math.sqrt(1 - u * u);
    out.scatter.set([rr * s * Math.cos(th), rr * u, rr * s * Math.sin(th)], i * 3);
  });
  return out;
}

export async function loadSceneData(dataVersion: string, fetcher: typeof fetch = fetch) {
  const get = async (url: string) => {
    const res = await fetcher(url);
    if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
    return res.json();
  };
  const [terrain, map] = await Promise.all([get(`/data/terrain.${dataVersion}.json`), get('/data/map.v1.json')]);
  return { terrain: terrainSchema.parse(terrain), map: mapSchema.parse(map) };
}

function pairs(flat: number[]): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i + 1 < flat.length; i += 2) out.push([flat[i] / 100, flat[i + 1] / 100]);
  return out;
}

function round(v: number): number {
  return Math.round(v * 1e4) / 1e4 + 0; // + 0: -0을 0으로 바꿔 테스트 비교를 안정시킨다
}

// 작고 빠른 시드 난수. Math.random을 쓰면 캡처 이미지가 매번 달라진다.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
```

- [ ] **Step 5: 통과 확인** — Run: `npx vitest run tests/unit/three-data.test.ts` / Expected: 모두 PASS. 그리고 실제 파일이 스키마를 통과하는지 한 번 확인: `node -e "const t=require('./public/data/terrain.2026-09-22.json');console.log(t.signal.pct.length,t.noise.pct.length,t.removed.pct.length)"`

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/three/data.ts tests/unit/three-data.test.ts
git commit -m "feat: decode terrain/map JSON into point cloud buffers"
```

---

### Task 4: 장면 표, 활성 챕터 고르기, 3D 가능 여부 (순수 함수)

**Files:**
- Create: `src/three/scenes.ts`, `src/three/activeScene.ts`, `src/three/capability.ts`, `tests/unit/three-scenes.test.ts`, `tests/unit/three-active.test.ts`, `tests/unit/three-capability.test.ts`

**Interfaces:**
- Produces:
  - `type SceneKey = 'hero' | 'about' | 'problem' | 'insight' | 'bubble' | 'validation' | 'interval' | 'limits' | 'stack' | 'contact'`
  - `type SceneState = { camera: [number, number, number]; target: [number, number, number]; assemble: number; map: number; noise: number; removed: number; drop: number }`
  - `SCENES: Record<SceneKey, SceneState>`
  - `sceneFor(key: SceneKey, progress: number, portrait: boolean): SceneState` — 3-3(`bubble`)은 챕터 진행도로 `drop`을 0→1, 세로 화면은 카메라를 목표점에서 1.6배 멀리
  - `type Candidate = { key: SceneKey; top: number; bottom: number }`, `pickActive(cands: Candidate[], viewportH: number): { key: SceneKey; progress: number } | null` — 뷰포트 세로 중앙을 포함하는 후보 중 **가장 짧은 것**(챕터가 섹션보다 우선)
  - `readCandidates(doc: Document): Candidate[]` — `[data-section]`과 `[data-chapter]`에서 키를 읽는다(`case` 섹션 자체는 키가 아니므로 제외)
  - `type Env = { reducedMotion: boolean; webgl: boolean; deviceMemory: number | undefined; forced: boolean }`, `canRender3D(env: Env): boolean`, `detectEnv(win: Window): Env` (`?capture=`가 있으면 forced)

- [ ] **Step 1: 실패하는 테스트 세 개**

`tests/unit/three-scenes.test.ts`:
```ts
// 장면 표 검사: 모든 키 존재, 3-1은 지도, 3-3은 진행도에 따라 떨어짐, 세로 화면은 카메라가 더 멀다.
import { describe, expect, it } from 'vitest';
import { SCENES, sceneFor, type SceneKey } from '@/three/scenes';

const KEYS: SceneKey[] = ['hero', 'about', 'problem', 'insight', 'bubble', 'validation', 'interval', 'limits', 'stack', 'contact'];

describe('SCENES', () => {
  it('모든 섹션·챕터 키가 있다', () => expect(Object.keys(SCENES).sort()).toEqual([...KEYS].sort()));
  it('3-1(problem)만 지도 장면', () => {
    for (const k of KEYS) expect(SCENES[k].map).toBe(k === 'problem' ? 1 : 0);
  });
  it('제거 레이어는 3-3(bubble)에서만 보인다', () => {
    for (const k of KEYS) expect(SCENES[k].removed).toBe(k === 'bubble' ? 1 : 0);
  });
});

describe('sceneFor', () => {
  it('bubble은 챕터 진행도로 drop이 0→1', () => {
    expect(sceneFor('bubble', 0, false).drop).toBe(0);
    expect(sceneFor('bubble', 1, false).drop).toBe(1);
    expect(sceneFor('bubble', 0.5, false).drop).toBeGreaterThan(0);
  });
  it('다른 장면은 drop 0', () => expect(sceneFor('insight', 0.9, false).drop).toBe(0));
  it('세로 화면은 카메라가 목표점에서 1.6배 멀다', () => {
    const land = sceneFor('insight', 0, false), port = sceneFor('insight', 0, true);
    const dist = (s: typeof land) => Math.hypot(...s.camera.map((v, i) => v - s.target[i]));
    expect(dist(port) / dist(land)).toBeCloseTo(1.6, 5);
  });
});
```

`tests/unit/three-active.test.ts`:
```ts
// 활성 장면 고르기 검사: 뷰포트 중앙을 포함하는 가장 짧은 요소, 진행도, 해당 없음.
import { describe, expect, it } from 'vitest';
import { pickActive } from '@/three/activeScene';

describe('pickActive', () => {
  it('챕터가 섹션 안에 있으면 챕터가 이긴다', () => {
    const r = pickActive([
      { key: 'about', top: -2000, bottom: 2000 },
      { key: 'insight', top: 0, bottom: 800 },
    ], 800);
    expect(r).toEqual({ key: 'insight', progress: 0.5 });
  });
  it('진행도는 0~1로 자른다', () => {
    expect(pickActive([{ key: 'hero', top: 390, bottom: 1400 }], 800)?.progress).toBeCloseTo(10 / 1010, 5);
  });
  it('중앙을 포함하는 요소가 없으면 null', () => {
    expect(pickActive([{ key: 'hero', top: 500, bottom: 900 }], 800)).toBeNull();
  });
});
```

`tests/unit/three-capability.test.ts`:
```ts
// 3D 가능 여부 검사: 스펙 §9.1의 대체 화면 조건.
import { describe, expect, it } from 'vitest';
import { canRender3D } from '@/three/capability';

const base = { reducedMotion: false, webgl: true, deviceMemory: 8, forced: false };

describe('canRender3D', () => {
  it('기본 환경은 3D', () => expect(canRender3D(base)).toBe(true));
  it('움직임 줄이기 → 대체 화면', () => expect(canRender3D({ ...base, reducedMotion: true })).toBe(false));
  it('WebGL 없음 → 대체 화면', () => expect(canRender3D({ ...base, webgl: false })).toBe(false));
  it('메모리 2GB 이하 → 대체 화면', () => expect(canRender3D({ ...base, deviceMemory: 2 })).toBe(false));
  it('deviceMemory를 모르면(사파리 등) 3D', () => expect(canRender3D({ ...base, deviceMemory: undefined })).toBe(true));
  it('캡처 모드는 움직임 줄이기여도 3D (WebGL은 있어야 함)', () => {
    expect(canRender3D({ ...base, reducedMotion: true, forced: true })).toBe(true);
    expect(canRender3D({ ...base, webgl: false, forced: true })).toBe(false);
  });
});
```

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run tests/unit/three-scenes.test.ts tests/unit/three-active.test.ts tests/unit/three-capability.test.ts` / Expected: FAIL (모듈 없음)

- [ ] **Step 3: `src/three/scenes.ts`**

```ts
// 장면 표: 섹션·챕터마다 카메라 위치와 셰이더 uniform 목표값을 정한다.
// 캔버스는 이 값으로 "부드럽게 다가가기"만 하므로, 연출을 바꾸려면 이 표만 고치면 된다.
export type SceneKey = 'hero' | 'about' | 'problem' | 'insight' | 'bubble' | 'validation' | 'interval' | 'limits' | 'stack' | 'contact';

export type SceneState = {
  camera: [number, number, number];
  target: [number, number, number];
  assemble: number; // 0 = 흩어짐, 1 = 목표 모양
  map: number;      // 0 = 지형, 1 = 한·일 지도
  noise: number;    // 흐린 잡음 점의 불투명도 배율
  removed: number;  // 제거 레이어(9,387행) 보이기
  drop: number;     // 제거 레이어가 떨어진 정도
};

const base = { assemble: 1, map: 0, noise: 1, removed: 0, drop: 0 };

export const SCENES: Record<SceneKey, SceneState> = {
  // 첫 화면: 비스듬히 내려다본 전경. 처음엔 assemble이 0에서 시작해 신호가 떠오른다(TerrainPoints 초기값).
  hero: { ...base, camera: [6, 9, 20], target: [0, 0.5, 0] },
  about: { ...base, camera: [-14, 7, 16], target: [0, 0.5, 0], noise: 0.6 },
  // 3-1: 위에서 내려다본 한·일 지도와 노선 궤적
  problem: { ...base, camera: [0, 16, 7], target: [0, 0, 0], map: 1 },
  // 3-2: 앞쪽 낮은 시점 → 예약 시점 축(x)의 U자 골짜기와 출발일 축(z)의 공휴일 봉우리가 함께 보인다
  insight: { ...base, camera: [9, 3.5, 17], target: [0, 0.8, 0] },
  // 3-3: 제거 레이어가 높이 떠 있다가 떨어진다(drop은 sceneFor가 진행도로 채움)
  bubble: { ...base, camera: [7, 9, 17], target: [0, 2.5, 0], removed: 1 },
  validation: { ...base, camera: [0, 22, 0.1], target: [0, 0, 0], noise: 0.5 },
  interval: { ...base, camera: [-12, 5, 12], target: [0, 0.5, 0] },
  limits: { ...base, camera: [0, 12, 26], target: [0, 0, 0], noise: 0.7 },
  stack: { ...base, camera: [0, 16, 30], target: [0, 0, 0], noise: 0.3 },
  contact: { ...base, camera: [0, 16, 30], target: [0, 0, 0], noise: 0.3 },
};

const PORTRAIT_DISTANCE = 1.6; // 세로 화면은 시야가 좁아 같은 구도를 담으려면 더 물러나야 한다

export function sceneFor(key: SceneKey, progress: number, portrait: boolean): SceneState {
  const s = SCENES[key];
  const p = Math.min(1, Math.max(0, progress));
  const drop = key === 'bubble' ? smooth(clamp01((p - 0.2) / 0.6)) : 0; // 챕터 20~80% 구간에서 떨어진다
  const camera = portrait
    ? (s.camera.map((v, i) => s.target[i] + (v - s.target[i]) * PORTRAIT_DISTANCE) as SceneState['camera'])
    : s.camera;
  return { ...s, camera, drop };
}

function clamp01(v: number) { return Math.min(1, Math.max(0, v)); }
function smooth(v: number) { return v * v * (3 - 2 * v); }
```

- [ ] **Step 4: `src/three/activeScene.ts`**

```ts
// 활성 장면 고르기: 뷰포트 세로 중앙에 걸린 섹션/챕터를 찾는다. 챕터는 케이스 스터디 섹션 안에
// 있으므로 "중앙을 포함하는 것 중 가장 짧은 요소"를 고르면 자연스럽게 챕터가 이긴다.
import type { SceneKey } from './scenes';

export type Candidate = { key: SceneKey; top: number; bottom: number };

export function pickActive(cands: Candidate[], viewportH: number): { key: SceneKey; progress: number } | null {
  const mid = viewportH / 2;
  let best: Candidate | null = null;
  for (const c of cands) {
    if (c.top <= mid && c.bottom > mid && (!best || c.bottom - c.top < best.bottom - best.top)) best = c;
  }
  if (!best) return null;
  const progress = Math.min(1, Math.max(0, (mid - best.top) / (best.bottom - best.top)));
  return { key: best.key, progress };
}

const SECTION_KEYS = new Set(['hero', 'about', 'stack', 'contact']); // 'case'는 챕터들이 대신한다

export function readCandidates(doc: Document): Candidate[] {
  const out: Candidate[] = [];
  doc.querySelectorAll<HTMLElement>('[data-section], [data-chapter]').forEach((el) => {
    const key = el.dataset.chapter ?? el.dataset.section;
    if (!key || (el.dataset.section && !SECTION_KEYS.has(key))) return;
    const r = el.getBoundingClientRect();
    out.push({ key: key as SceneKey, top: r.top, bottom: r.bottom });
  });
  return out;
}
```

- [ ] **Step 5: `src/three/capability.ts`**

```ts
// 3D 가능 여부: 스펙 §9.1 대체 화면 조건(움직임 줄이기, WebGL 없음, 메모리 2GB 이하).
// 프레임 저하에 따른 전환은 TerrainScene이 실행 중에 따로 판단한다.
export type Env = { reducedMotion: boolean; webgl: boolean; deviceMemory: number | undefined; forced: boolean };

export function canRender3D(env: Env): boolean {
  if (!env.webgl) return false;
  if (env.forced) return true; // 캡처 스크립트: 움직임 줄이기 설정과 무관하게 장면을 찍어야 한다
  if (env.reducedMotion) return false;
  if (env.deviceMemory !== undefined && env.deviceMemory <= 2) return false;
  return true;
}

export function detectEnv(win: Window): Env {
  let webgl = false;
  try {
    const c = win.document.createElement('canvas');
    webgl = !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { /* WebGL 생성이 막힌 환경 */ }
  return {
    reducedMotion: win.matchMedia('(prefers-reduced-motion: reduce)').matches,
    webgl,
    // deviceMemory는 크롬 계열에만 있다. 없으면 undefined로 두고 3D를 허용한다.
    deviceMemory: (win.navigator as Navigator & { deviceMemory?: number }).deviceMemory,
    forced: new URLSearchParams(win.location.search).has('capture'),
  };
}
```

- [ ] **Step 6: 통과 확인** — Run: `npx vitest run tests/unit/three-scenes.test.ts tests/unit/three-active.test.ts tests/unit/three-capability.test.ts` / Expected: 모두 PASS

- [ ] **Step 7: Commit**

```bash
git add src/three/scenes.ts src/three/activeScene.ts src/three/capability.ts tests/unit/three-*.test.ts
git commit -m "feat: scene table, active-scene picking, 3D capability rules"
```

---

### Task 5: 셰이더와 캔버스 컴포넌트 (`TerrainPoints`, `CameraRig`, `TerrainScene`)

**Files:**
- Create: `src/three/shaders.ts`, `src/three/TerrainPoints.tsx`, `src/three/CameraRig.tsx`, `src/three/TerrainScene.tsx`

**Interfaces:**
- Consumes: `buildPointCloud`, `loadSceneData`, `PointCloud` (Task 3), `sceneFor`, `SceneState`, `SceneKey`, `pickActive`, `readCandidates` (Task 4)
- Produces:
  - `default export TerrainScene(props: { dataVersion: string; onReady: () => void; onFail: (reason: string) => void; capture: SceneKey | null })` — `onReady`: 데이터를 받아 첫 프레임을 그린 뒤 한 번. `onFail`: 데이터 로딩 실패 또는 2단계 성능 저하
  - 캡처 모드(`capture`가 있음): 감쇠 없이 그 장면으로 바로 가고, 두 프레임 뒤 `window.__sceneReady = true`
  - 캔버스 래퍼: `<div className="backdrop" aria-hidden="true">`

이 Task는 WebGL 화면이라 단위 테스트 대신 **빌드 + 개발 서버에서 눈으로** 확인하고, 자동 검사는 Task 9 e2e가 맡는다.

- [ ] **Step 1: `src/three/shaders.ts`**

```ts
// 점 셰이더: 점마다 흩어짐·지형·지도 세 목표 좌표를 받아 uniform 비율로 섞는다.
// 모든 움직임을 GPU에서 계산하므로 2만8천 개 점도 매 프레임 JS 작업 없이 움직인다.
export const vertexShader = /* glsl */ `
  attribute vec3 aTerrain;
  attribute vec3 aMap;
  attribute vec3 aScatter;
  attribute float aKind;     // 0 신호, 1 잡음, 2 제거
  attribute float aHoliday;
  attribute float aRoute;
  uniform float uAssemble;
  uniform float uMap;
  uniform float uNoise;
  uniform float uRemoved;
  uniform float uDrop;
  uniform float uTime;
  uniform float uSize;
  varying float vAlpha;
  varying float vHoliday;
  varying float vRoute;
  varying float vKind;

  void main() {
    vec3 target = mix(aTerrain, aMap, uMap);
    // 잡음은 신호보다 덜 모인다 → "잡음 속에서 신호가 떠오르는" 느낌
    float gather = aKind > 0.5 && aKind < 1.5 ? uAssemble * 0.9 : uAssemble;
    vec3 p = mix(aScatter, target, gather);
    // 덜 모인 점일수록 천천히 떠다닌다
    p += (1.0 - gather) * 0.35 * vec3(sin(uTime * 0.5 + aScatter.y), cos(uTime * 0.4 + aScatter.x), sin(uTime * 0.3 + aScatter.z));
    if (aKind > 1.5) p.y -= uDrop * uDrop * 14.0; // 제거 레이어는 가속하며 떨어진다

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float size = aKind < 0.5 ? 1.0 : (aKind < 1.5 ? 0.7 : 1.1);
    gl_PointSize = uSize * size * (12.0 / -mv.z);

    if (aKind < 0.5) vAlpha = 0.95;
    else if (aKind < 1.5) vAlpha = 0.18 * uNoise;
    else vAlpha = 0.9 * uRemoved * (1.0 - uDrop);
    vHoliday = aHoliday * (1.0 - uMap); // 지도 장면에서는 공휴일 색을 끈다(지도 위 호박색은 노선 전용)
    vRoute = aRoute * uMap;
    vKind = aKind;
  }
`;

export const fragmentShader = /* glsl */ `
  uniform vec3 uDot;
  uniform vec3 uAmber;
  uniform vec3 uText;
  varying float vAlpha;
  varying float vHoliday;
  varying float vRoute;
  varying float vKind;

  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    float soft = smoothstep(0.5, 0.15, d); // 가장자리가 부드러운 원
    vec3 col = vKind > 1.5 ? uText : mix(uDot, uAmber, max(vHoliday, vRoute));
    gl_FragColor = vec4(col, vAlpha * soft);
  }
`;
```

- [ ] **Step 2: `src/three/TerrainPoints.tsx`**

```tsx
'use client';
// 점 구름 하나(Points)와 셰이더 재질. 목표 장면 상태(target)로 uniform을 매 프레임 부드럽게 옮긴다.
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { PointCloud } from './data';
import type { SceneState } from './scenes';
import { fragmentShader, vertexShader } from './shaders';

type Props = { cloud: PointCloud; target: React.RefObject<SceneState>; instant: boolean; showNoise: boolean };

const DAMP = 2.2; // 클수록 빨리 따라간다. 스펙의 expo.out 느낌(처음 빠르고 끝이 느림)에 가깝다

export function TerrainPoints({ cloud, target, instant, showNoise }: Props) {
  const material = useRef<THREE.ShaderMaterial>(null);

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    // position은 three가 경계 계산에 쓰므로 지형 좌표를 넣어 둔다(실제 위치는 셰이더가 정함)
    g.setAttribute('position', new THREE.BufferAttribute(cloud.terrain, 3));
    g.setAttribute('aTerrain', new THREE.BufferAttribute(cloud.terrain, 3));
    g.setAttribute('aMap', new THREE.BufferAttribute(cloud.map, 3));
    g.setAttribute('aScatter', new THREE.BufferAttribute(cloud.scatter, 3));
    g.setAttribute('aKind', new THREE.BufferAttribute(cloud.kind, 1));
    g.setAttribute('aHoliday', new THREE.BufferAttribute(cloud.holiday, 1));
    g.setAttribute('aRoute', new THREE.BufferAttribute(cloud.route, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 30); // 흩어짐 반경까지 포함 → 잘림 방지
    return g;
  }, [cloud]);

  const uniforms = useMemo(() => ({
    uAssemble: { value: instant ? 1 : 0 }, // 첫 화면에서 0 → 1로 모이며 등장
    uMap: { value: 0 },
    uNoise: { value: 1 },
    uRemoved: { value: 0 },
    uDrop: { value: 0 },
    uTime: { value: 0 },
    uSize: { value: 3 },
    uDot: { value: new THREE.Color('#8FB8FF') },
    uAmber: { value: new THREE.Color('#FFB547') },
    uText: { value: new THREE.Color('#EEF3FF') },
  }), [instant]);

  useFrame((state, delta) => {
    const m = material.current;
    const t = target.current;
    if (!m || !t) return;
    const u = m.uniforms;
    const step = (key: string, goal: number) => {
      u[key].value = instant ? goal : THREE.MathUtils.damp(u[key].value, goal, DAMP, delta);
    };
    step('uAssemble', t.assemble);
    step('uMap', t.map);
    step('uNoise', showNoise ? t.noise : 0);
    step('uRemoved', t.removed);
    step('uDrop', t.drop);
    u.uTime.value = state.clock.elapsedTime;
    u.uSize.value = 3 * state.viewport.dpr;
  });

  return (
    <points geometry={geometry} frustumCulled={false}>
      <shaderMaterial
        ref={material}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
```

- [ ] **Step 3: `src/three/CameraRig.tsx`**

```tsx
'use client';
// 카메라: 장면 상태의 위치·목표점으로 부드럽게 이동한다. 첫 화면에서는 마우스를 따라 살짝 기운다(시차).
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { SceneState } from './scenes';

type Props = { target: React.RefObject<SceneState>; instant: boolean; parallax: React.RefObject<boolean> };

export function CameraRig({ target, instant, parallax }: Props) {
  const camera = useThree((s) => s.camera);
  const look = useRef(new THREE.Vector3());
  const mouse = useRef({ x: 0, y: 0 });

  useEffect(() => {
    // 캔버스는 pointer-events: none이라 창 전체에서 마우스를 듣는다
    const onMove = (e: PointerEvent) => {
      mouse.current = { x: e.clientX / window.innerWidth - 0.5, y: e.clientY / window.innerHeight - 0.5 };
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, []);

  useFrame((_, delta) => {
    const t = target.current;
    if (!t) return;
    const sway = parallax.current ? 1.2 : 0;
    const goal = new THREE.Vector3(t.camera[0] + mouse.current.x * sway, t.camera[1] - mouse.current.y * sway, t.camera[2]);
    const goalLook = new THREE.Vector3(...t.target);
    if (instant) {
      camera.position.copy(goal);
      look.current.copy(goalLook);
    } else {
      camera.position.x = THREE.MathUtils.damp(camera.position.x, goal.x, 1.8, delta);
      camera.position.y = THREE.MathUtils.damp(camera.position.y, goal.y, 1.8, delta);
      camera.position.z = THREE.MathUtils.damp(camera.position.z, goal.z, 1.8, delta);
      look.current.x = THREE.MathUtils.damp(look.current.x, goalLook.x, 1.8, delta);
      look.current.y = THREE.MathUtils.damp(look.current.y, goalLook.y, 1.8, delta);
      look.current.z = THREE.MathUtils.damp(look.current.z, goalLook.z, 1.8, delta);
    }
    camera.lookAt(look.current);
  });
  return null;
}
```

- [ ] **Step 4: `src/three/TerrainScene.tsx`**

```tsx
'use client';
// 화면 뒤에 고정된 3D 캔버스. 데이터를 받아 점 구름을 만들고, 스크롤로 활성 장면을 정하고,
// 프레임이 떨어지면 단계적으로 낮추다가 대체 화면으로 넘긴다(스펙 §8.3). 캡처 모드도 여기서 처리한다.
import { Canvas, useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import { pickActive, readCandidates } from './activeScene';
import { CameraRig } from './CameraRig';
import { buildPointCloud, loadSceneData, type MapData, type Terrain } from './data';
import { sceneFor, type SceneKey, type SceneState } from './scenes';
import { TerrainPoints } from './TerrainPoints';

type Props = { dataVersion: string; onReady: () => void; onFail: (reason: string) => void; capture: SceneKey | null };

const SLOW_FPS = 30;
const SLOW_SECONDS = 2;

export default function TerrainScene({ dataVersion, onReady, onFail, capture }: Props) {
  const [data, setData] = useState<{ terrain: Terrain; map: MapData } | null>(null);
  const [level, setLevel] = useState(0);        // 0 정상, 1 낮춤(DPR 1·잡음 숨김)
  const [running, setRunning] = useState(true); // 탭 숨김·연락처 섹션에서는 멈춘다
  const portrait = useRef(false);
  const target = useRef<SceneState>(sceneFor(capture ?? 'hero', 0, false));
  const parallax = useRef(true);

  useEffect(() => {
    loadSceneData(dataVersion).then(setData).catch((e) => onFail(`data: ${e.message}`));
  }, [dataVersion, onFail]);

  // 스크롤·크기 변화 → 활성 장면 → 목표 상태. 캡처 모드에서는 고정.
  useEffect(() => {
    if (capture) {
      portrait.current = window.innerHeight > window.innerWidth;
      target.current = sceneFor(capture, capture === 'bubble' ? 0.5 : 0, portrait.current);
      return;
    }
    let raf = 0;
    const update = () => {
      raf = 0;
      portrait.current = window.innerHeight > window.innerWidth;
      const active = pickActive(readCandidates(document), window.innerHeight);
      if (!active) return;
      target.current = sceneFor(active.key, active.progress, portrait.current);
      parallax.current = active.key === 'hero';
      setRunning(active.key !== 'contact' && !document.hidden);
    };
    const schedule = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    document.addEventListener('visibilitychange', schedule);
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      document.removeEventListener('visibilitychange', schedule);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [capture]);

  const cloud = useMemo(() => {
    if (!data) return null;
    // 세로 화면(대개 휴대폰)은 잡음 점을 절반만 그린다
    const isPortrait = typeof window !== 'undefined' && window.innerHeight > window.innerWidth;
    return buildPointCloud(data.terrain, data.map, { noiseStride: isPortrait ? 2 : 1, seed: 7 });
  }, [data]);

  if (!cloud) return null;
  const maxDpr = level > 0 ? 1 : 1.5;

  return (
    <div className="backdrop" aria-hidden="true">
      <Canvas
        dpr={[1, maxDpr]}
        frameloop={running || capture ? 'always' : 'never'}
        camera={{ fov: 40, near: 0.1, far: 200, position: target.current.camera }}
        gl={{ antialias: false, alpha: true, powerPreference: 'high-performance', preserveDrawingBuffer: !!capture }}
      >
        <TerrainPoints cloud={cloud} target={target} instant={!!capture} showNoise={level === 0} />
        <CameraRig target={target} instant={!!capture} parallax={parallax} />
        <FrameWatch
          enabled={!capture}
          onFirstFrame={() => {
            onReady();
            if (capture) requestAnimationFrame(() => requestAnimationFrame(() => {
              (window as Window & { __sceneReady?: boolean }).__sceneReady = true;
            }));
          }}
          onSlow={() => (level === 0 ? setLevel(1) : onFail('fps'))}
        />
      </Canvas>
    </div>
  );
}

// 프레임 감시: 첫 프레임 알림 + 30fps 미만이 2초 이어지면 onSlow(한 번 부른 뒤 다시 2초를 잰다).
function FrameWatch({ enabled, onFirstFrame, onSlow }: { enabled: boolean; onFirstFrame: () => void; onSlow: () => void }) {
  const first = useRef(true);
  const slow = useRef(0);
  useFrame((_, delta) => {
    if (first.current) { first.current = false; onFirstFrame(); return; }
    if (!enabled || delta > 1) return; // 탭 복귀 직후의 큰 delta는 무시
    slow.current = 1 / delta < SLOW_FPS ? slow.current + delta : 0;
    if (slow.current > SLOW_SECONDS) { slow.current = 0; onSlow(); }
  });
  return null;
}
```

- [ ] **Step 5: 확인** — Run: `npm run typecheck && npm test` / Expected: 통과(이 Task의 파일은 아직 어디서도 쓰지 않으므로 빌드 산출물은 그대로). 타입 오류가 R3F JSX 요소(`points`, `shaderMaterial`)에서 나면 `@react-three/fiber`의 JSX 타입 등록 방식을 확인해 맞춘다(보고서에 기록).

- [ ] **Step 6: Commit**

```bash
git add src/three/shaders.ts src/three/TerrainPoints.tsx src/three/CameraRig.tsx src/three/TerrainScene.tsx
git commit -m "feat: terrain point shader, camera rig and scene canvas"
```

---

### Task 6: 페이지에 붙이기 — `Backdrop`, 대체 이미지, 레이아웃

**Files:**
- Create: `src/components/Backdrop.tsx`, `src/components/sections/ChapterFigure.tsx`
- Modify: `src/components/HomePage.tsx`, `src/components/sections/Hero.tsx`, `src/components/sections/CaseStudy.tsx`, `src/styles/globals.css`, `content/{ko,en,ja}.json`

**Interfaces:**
- Consumes: `TerrainScene` (Task 5), `canRender3D`, `detectEnv` (Task 4), `SceneKey`, `facts.dataVersion`
- Produces:
  - `<Backdrop dataVersion: string />` — 능력이 되면 `requestIdleCallback`(없으면 300ms) 뒤 `TerrainScene`을 동적 로딩. `onReady` → `document.documentElement.dataset.threeD = 'on'`(속성 `data-3d="on"`), `onFail` → 캔버스를 내리고 `data-3d="off"`
  - `FIGURE_KEYS = ['hero', 'problem', 'insight', 'bubble', 'interval'] as const`, `<ChapterFigure locale sceneKey />` — `<figure className="scene-figure"><img src="/fallback/<key>.webp" alt={t('figure.<key>')} width={1280} height={720} loading="lazy" decoding="async" /></figure>`
  - 문구 키 `figure.hero|problem|insight|bubble|interval` (3개 언어)

- [ ] **Step 1: 문구 추가 (`content/ko.json`에 최상위 `figure` 객체, 숫자 쓰지 않기)**

```json
"figure": {
  "hero": "흩어진 흐린 점들 사이로 밝은 점들이 모여 가격 지형을 이루는 모습",
  "problem": "한국과 일본 해안선을 이룬 점들과, 인천에서 나리타·하네다·간사이로 이어지는 노선 궤적",
  "insight": "출발이 가까워질수록 다시 오르는 U자 골짜기와, 공휴일 출발일의 호박색 봉우리가 보이는 가격 지형",
  "bubble": "지형 위에 높이 떠 있던 잘못 매칭된 점들이 아래로 떨어져 나가는 모습",
  "interval": "가격 지형을 비스듬히 내려다본 모습"
}
```
`en.json`, `ja.json`에 같은 키로 같은 뜻을 담는다(사실만, 담백하게, ja は です・ます 불필요한 체언 종결 가능 — 대체 텍스트이므로 명사형 문장 허용). Run: `npx vitest run tests/unit/content.test.ts` → PASS.

- [ ] **Step 2: `src/components/sections/ChapterFigure.tsx`**

```tsx
// 3D 대체 이미지: 3D를 쓸 수 없거나 JS가 꺼진 방문자에게 장면을 정적 이미지로 보여 준다.
// 기본은 보이고, 3D 캔버스가 준비되면 <html data-3d="on">이 CSS로 숨긴다(globals.css).
import { getT } from '@/lib/content';
import type { Locale } from '@/lib/i18n';

export const FIGURE_KEYS = ['hero', 'problem', 'insight', 'bubble', 'interval'] as const;
export type FigureKey = (typeof FIGURE_KEYS)[number];

export function ChapterFigure({ locale, sceneKey }: { locale: Locale; sceneKey: FigureKey }) {
  const t = getT(locale);
  return (
    <figure className="scene-figure">
      <img src={`/fallback/${sceneKey}.webp`} alt={t(`figure.${sceneKey}`)} width={1280} height={720} loading="lazy" decoding="async" />
    </figure>
  );
}
```

- [ ] **Step 3: `Hero.tsx`에 `<ChapterFigure locale={locale} sceneKey="hero" />`를 키워드 문단 아래에, `CaseStudy.tsx`의 각 `<article>`에서 `h3` 바로 아래에 `{(FIGURE_KEYS as readonly string[]).includes(c.id) && <ChapterFigure locale={locale} sceneKey={c.id as FigureKey} />}` 추가**

- [ ] **Step 4: `src/components/Backdrop.tsx`**

```tsx
'use client';
// 3D 배경 스위치: 기기 능력을 보고, 첫 화면이 그려진 뒤 3D 캔버스를 지연 로딩한다.
// three 코드는 dynamic import로 따로 떨어져 있어 초기 JS에 포함되지 않는다(스펙 §8.1).
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useState } from 'react';
import { canRender3D, detectEnv } from '@/three/capability';
import type { SceneKey } from '@/three/scenes';

const TerrainScene = dynamic(() => import('@/three/TerrainScene'), { ssr: false });

export function Backdrop({ dataVersion }: { dataVersion: string }) {
  const [load, setLoad] = useState(false);
  const [capture, setCapture] = useState<SceneKey | null>(null);

  useEffect(() => {
    const env = detectEnv(window);
    if (!canRender3D(env)) { setMode('off'); return; }
    setCapture((new URLSearchParams(window.location.search).get('capture') as SceneKey | null) ?? null);
    // 첫 화면 텍스트가 먼저 그려지도록 브라우저가 한가할 때 불러온다
    const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 300));
    idle(() => setLoad(true));
  }, []);

  const onReady = useCallback(() => setMode('on'), []);
  const onFail = useCallback((reason: string) => {
    console.warn(`3D 끔: ${reason}`); // 방문자에게는 대체 이미지가 보이므로 경고만 남긴다
    setMode('off');
    setLoad(false);
  }, []);

  return load ? <TerrainScene dataVersion={dataVersion} onReady={onReady} onFail={onFail} capture={capture} /> : null;
}

function setMode(mode: 'on' | 'off') {
  document.documentElement.setAttribute('data-3d', mode);
}
```

- [ ] **Step 5: `HomePage.tsx`에 `<Backdrop dataVersion={facts.dataVersion} />`를 `<Header>` 앞에 추가(`import { facts } from '@/lib/facts'`)**

- [ ] **Step 6: `globals.css` 끝에 추가**

```css
/* 3D 배경 — 캔버스는 본문 뒤에 고정. body 배경 그라데이션 위, main 아래에 오도록 z-index를 나눈다. */
.backdrop { position: fixed; inset: 0; z-index: 0; pointer-events: none; }
.backdrop canvas { display: block; }
main { position: relative; z-index: 1; }

/* 대체 이미지: 기본은 보이고, 3D가 켜지면 숨긴다(JS가 없거나 3D가 불가능해도 장면을 볼 수 있게) */
.scene-figure { margin: 24px 0; }
.scene-figure img { width: 100%; height: auto; border-radius: 12px; border: 1px solid var(--line); }
html[data-3d="on"] .scene-figure { display: none; }

/* 3D가 켜지면 챕터를 화면 높이로 늘려 카메라가 움직일 시간을 주고, 글은 반투명 카드에 담아 대비를 지킨다 */
html[data-3d="on"] .chapter { min-height: 100vh; display: flex; flex-direction: column; justify-content: center; border-top: 0; }
html[data-3d="on"] :is(.chapter, #about, #stack, #contact) > :is(p, h2, h3, ul, ol, table, a, div, dl) { max-width: 560px; }
html[data-3d="on"] :is(.chapter, #about) {
  background: linear-gradient(90deg, rgba(7, 11, 22, 0.82) 0, rgba(7, 11, 22, 0.82) 600px, rgba(7, 11, 22, 0) 760px);
}
@media (max-width: 767px) {
  /* 세로 화면: 지형은 위, 글은 아래 카드(스펙 §5.3) */
  html[data-3d="on"] .chapter { justify-content: flex-end; padding-bottom: 12vh; }
  html[data-3d="on"] :is(.chapter, #about) {
    background: linear-gradient(0deg, rgba(7, 11, 22, 0.92) 55%, rgba(7, 11, 22, 0) 100%);
  }
}
```

- [ ] **Step 7: 확인** — Run: `npm run typecheck && npm test && npm run build`, 그다음 three 청크가 초기 HTML에 직접 실리지 않는지 확인:

```bash
for f in $(grep -l "WebGLRenderer" out/_next/static/chunks/*.js); do echo "$(basename $f) $(grep -c "$(basename $f)" out/index.html)"; done
```
Expected: 한 줄 이상 나오고, 각 줄 끝 숫자가 `0`. 대체 이미지 파일은 Task 8에서 생기므로 지금은 404여도 된다.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: mount lazy 3D backdrop with fallback figures and readable text cards"
```

---

### Task 7: ⏸ 화면 확인 체크포인트 (사용자)

**Files:** 필요하면 `src/three/scenes.ts`, `src/three/shaders.ts`, `src/styles/globals.css` (값 조정만)

- [ ] **Step 1: 개발 서버 실행** — `npm run dev` (백그라운드). 데스크톱 폭으로 `http://localhost:3000/`을 열어 처음부터 끝까지 스크롤하며 Playwright로 장면마다 스크린숏을 찍는다: `?capture=<key>` 주소를 키 10개에 대해 1440×900으로, 그리고 hero·problem·insight·bubble을 390×844로. 저장 위치는 저장소 밖 스크래치 폴더.

- [ ] **Step 2: 스스로 먼저 확인** (Read 도구로 스크린숏 보기):
  - 첫 화면: 신호(밝은 점)가 지형 띠를 이루고, 잡음이 흐리게 둘러싼다. 글자와 겹쳐도 이름이 읽힌다
  - 3-1: 한반도·일본 열도 해안선이 알아볼 수 있고, 인천→도쿄·오사카 궤적이 호박색 호로 떠 있다
  - 3-2: 오른쪽(출발 임박) 끝이 솟는 U자 골짜기, 호박색 봉우리가 보인다
  - 3-3: 제거 레이어(흰 점)가 지형 위에 높이 떠 있다
  - 텍스트 카드 대비가 충분하다. 휴대폰에서 지형이 위, 글이 아래에 있다

  문제가 보이면 `scenes.ts`의 카메라 값, 셰이더의 크기·불투명도, CSS 카드 값을 조정하고 다시 찍는다.

- [ ] **Step 3: 사용자에게 보여 주고 멈춘다** — 개발 서버 주소와 스크린숏 요약을 알리고, 느낌(점 크기·밝기, 카메라 구도, 지도 장면, 떨어지는 속도)에 대한 의견을 받는다. **답을 받을 때까지 다음 Task로 가지 않는다.** 요청은 이 Task 안에서 반영하고 커밋한다(`style: tune terrain scenes after review`).

---

### Task 8: 대체 이미지 캡처 스크립트 + WebP 생성

**Files:**
- Create: `scripts/capture-fallbacks.mjs`, `public/fallback/{hero,problem,insight,bubble,interval}.webp`
- Modify: `package.json` (스크립트 `fallbacks`)

**Interfaces:**
- Consumes: 캡처 모드(`?capture=<key>` → `window.__sceneReady`) (Task 5·6), `FIGURE_KEYS` 목록과 같은 키
- Produces: `npm run fallbacks` — `out/`을 4173 포트로 띄우고 키마다 캔버스를 1280×720으로 찍어 WebP(품질 72)로 저장

- [ ] **Step 1: `scripts/capture-fallbacks.mjs`**

```js
// 3D 대체 이미지 생성: 실제 3D 장면을 캡처 모드로 열어 캔버스를 찍고 WebP로 저장한다.
// 대체 이미지가 3D와 똑같이 보이도록(스펙 §9.1) 손으로 만든 그림 대신 이 스크립트로 만든다.
// 실행 전 `npm run build`가 필요하다. 재학습으로 지형이 바뀌면 다시 실행해 커밋한다.
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import sharp from 'sharp';

const KEYS = ['hero', 'problem', 'insight', 'bubble', 'interval'];
const PORT = 4174; // e2e(4173)와 겹치지 않게
const server = spawn('npx', ['serve', 'out', '-l', String(PORT), '--no-clipboard'], { stdio: 'ignore' });

try {
  await new Promise((r) => setTimeout(r, 1500));
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  await mkdir('public/fallback', { recursive: true });
  for (const key of KEYS) {
    await page.goto(`http://localhost:${PORT}/?capture=${key}`);
    await page.waitForFunction(() => window.__sceneReady === true, null, { timeout: 30_000 });
    const png = await page.locator('.backdrop canvas').screenshot();
    // 캔버스는 투명 배경이라, 사이트 배경색을 깔고 WebP로 줄인다
    await sharp(png).flatten({ background: '#070B16' }).webp({ quality: 72 }).toFile(`public/fallback/${key}.webp`);
    console.log(`fallback/${key}.webp`);
  }
  await browser.close();
} finally {
  server.kill();
}
```

- [ ] **Step 2: `package.json`에 `"fallbacks": "node scripts/capture-fallbacks.mjs"` 추가**

- [ ] **Step 3: 실행** — Run: `npm run build && npm run fallbacks && ls -la public/fallback` / Expected: WebP 5개, 각각 20~150KB. 이미지를 Read 도구로 열어 Task 7에서 확인한 장면과 같은지 본다(검은 화면이면 WebGL이 꺼진 것 — 실행 인자를 확인).

- [ ] **Step 4: Commit**

```bash
git add scripts/capture-fallbacks.mjs public/fallback package.json
git commit -m "feat: capture 3D scenes into WebP fallback images"
```

---

### Task 9: e2e — 3D 켜짐·꺼짐, 대체 화면, 청크 분리, 접근성

**Files:**
- Create: `tests/e2e/terrain.spec.ts`
- Modify: `playwright.config.ts` (Chromium WebGL 인자), `.github/workflows/ci.yml`(필요 시)

**Interfaces:**
- Consumes: `html[data-3d]`, `.backdrop canvas`, `.scene-figure img`, `/data/terrain.*.json`

- [ ] **Step 1: `playwright.config.ts`의 두 프로젝트 `use`에 `launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }` 추가** (CI의 헤드리스 Chromium에서도 WebGL이 돌게)

- [ ] **Step 2: `tests/e2e/terrain.spec.ts`**

```ts
// 3D 배경 e2e: 켜짐(캔버스·대체 이미지 숨김), 꺼짐(움직임 줄이기·JS 없음·데이터 실패), 초기 청크 분리, 접근성.
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';

test('기본 환경: 3D가 켜지고 대체 이미지는 숨는다', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-3d', 'on', { timeout: 20_000 });
  await expect(page.locator('.backdrop canvas')).toBeVisible();
  await expect(page.locator('.backdrop')).toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('.scene-figure').first()).toBeHidden();
});

test.describe('움직임 줄이기', () => {
  test.use({ reducedMotion: 'reduce' });
  test('캔버스 없이 대체 이미지와 대체 텍스트가 보인다', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-3d', 'off');
    await expect(page.locator('.backdrop canvas')).toHaveCount(0);
    const img = page.locator('.scene-figure img').first();
    await expect(img).toBeVisible();
    expect((await img.getAttribute('alt'))?.length).toBeGreaterThan(5);
  });
});

test.describe('JS 없이', () => {
  test.use({ javaScriptEnabled: false });
  test('서버 HTML만으로 대체 이미지 다섯 장이 있다', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.scene-figure img')).toHaveCount(5);
    await expect(page.locator('.scene-figure img').first()).toBeVisible();
  });
});

test('지형 데이터를 못 받으면 대체 화면으로 돌아간다', async ({ page }) => {
  await page.route('**/data/terrain.*.json', (r) => r.fulfill({ status: 404, body: 'no' }));
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-3d', 'off', { timeout: 20_000 });
  await expect(page.locator('.scene-figure img').first()).toBeVisible();
});

test('초기 HTML은 three 청크를 직접 불러오지 않는다', async () => {
  const dir = 'out/_next/static/chunks';
  const threeChunks = readdirSync(dir).filter((f) => f.endsWith('.js') && readFileSync(`${dir}/${f}`, 'utf8').includes('WebGLRenderer'));
  expect(threeChunks.length).toBeGreaterThan(0);
  const html = readFileSync('out/index.html', 'utf8');
  for (const f of threeChunks) expect(html).not.toContain(f);
});

for (const path of ['/', '/ja/']) {
  test(`${path} 3D가 켜진 상태에서 axe 위반 없음`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator('html')).toHaveAttribute('data-3d', 'on', { timeout: 20_000 });
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(result.violations).toEqual([]);
  });
}
```

- [ ] **Step 3: 실행** — Run: `npm run build && npm run e2e` / Expected: 기존 테스트 + 새 테스트 모두 PASS(두 프로젝트). 대비 위반이 나오면 테스트가 아니라 CSS 카드 값을 고친다. CI에서 WebGL이 안 켜져 `data-3d`가 `off`로 끝나면, 로컬과 CI의 Chromium 인자 차이를 확인하고 보고서에 기록한다.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/terrain.spec.ts playwright.config.ts .github/workflows/ci.yml
git commit -m "test: e2e for 3D on/off, fallbacks, lazy chunk, a11y with canvas"
```

---

### Task 10: 문서 갱신

**Files:**
- Modify: `README.md`, `CLAUDE.md`, `docs/superpowers/specs/2026-09-23-portfolio-design.md`(§5.3에 실제 구현 요약 한 단락)

- [ ] **Step 1: README** — "구조" 표에 `scripts/export_terrain.py`·`export_map.py`·`capture-fallbacks.mjs`, `src/three/` 행을 추가하고, "실행"에 `npm run terrain`, `npm run map`, `npm run fallbacks`(재학습 후 순서: facts → terrain → build → fallbacks)를 적는다. 첫 줄의 "(계획 3에서 추가 예정)"을 지운다.

- [ ] **Step 2: CLAUDE.md** — 진행 표에서 계획 3을 완료로, 다음을 "계획 2(데모) 계획서 작성"으로 바꾼다. 계획 2에 넘길 것: 3-5 챕터의 **q10~q90 띠**는 모델 예측 구간이 필요해 `export_demo.py`와 함께 계획 2에서 지형 위에 얹는다(이 계획에서는 3-5가 비스듬한 전경만 보여 준다).

- [ ] **Step 3: Commit**

```bash
git add README.md CLAUDE.md docs/superpowers/specs/2026-09-23-portfolio-design.md
git commit -m "docs: record plan 3 terrain pipeline and hand-off to plan 2"
```
