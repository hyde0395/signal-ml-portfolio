#!/bin/sh
# 데이터 추출 스크립트(export_*.py)와 pytest를 돌릴 파이썬을 고른다.
# 항공권 저장소의 .venv는 iCloud로 기기 간에 lib만 넘어와 자주 깨진다(그쪽 CLAUDE.md "머신 이동").
# 거기서 venv를 지우고 다시 만들면 삭제가 다른 기기로 동기화되므로, 기기마다 iCloud 밖
# ~/.venvs/airfare-py311을 두고 그것을 먼저 쓴다. AIRFARE_PYTHON을 주면 그것이 최우선이다.
ROOT="${AIRFARE_ROOT:-$HOME/Documents/airfare-forecasting-ml}"
for PY in "$AIRFARE_PYTHON" "$HOME/.venvs/airfare-py311/bin/python" "$ROOT/.venv/bin/python"; do
  if [ -n "$PY" ] && [ -x "$PY" ]; then exec "$PY" "$@"; fi
done
echo "파이썬을 찾지 못했다: AIRFARE_PYTHON, ~/.venvs/airfare-py311, $ROOT/.venv 중 하나를 준비한다 (CLAUDE.md 참고)" >&2
exit 1
