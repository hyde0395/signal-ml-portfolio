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
