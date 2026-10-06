#!/usr/bin/env bash
# 파일 편집 전에 검사하는 PreToolUse 훅: 스크립트가 만드는 데이터 JSON을 손으로 고치지 못하게 막는다.
# public/data/*.json은 scripts/export_*.py 결과물이라 손으로 고치면 다음 추출 때 사라지고 수치 출처도 끊긴다.
set -euo pipefail

path=$(jq -r '.tool_input.file_path // .tool_input.notebook_path // ""')

case "$path" in
  */public/data/*.json)
    echo "[훅 차단] public/data/*.json은 scripts/export_*.py가 만드는 파일입니다. 스크립트를 고친 뒤 npm run terrain|demo|charts|map 으로 다시 만드세요(refresh-data 스킬)." >&2
    exit 2
    ;;
esac

exit 0
