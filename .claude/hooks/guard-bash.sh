#!/usr/bin/env bash
# Bash 명령을 실행 전에 검사해 이 저장소의 "절대 어기면 안 되는 규칙"을 막는 PreToolUse 훅.
# 막을 때는 exit 2 + stderr 메시지 → Claude Code가 명령을 실행하지 않고 메시지를 Claude에게 돌려준다.
set -euo pipefail

input=$(cat)
cmd=$(jq -r '.tool_input.command // ""' <<<"$input")
cwd=$(jq -r '.cwd // ""' <<<"$input")
[ -n "$cwd" ] && [ -d "$cwd" ] && cd "$cwd"

block() {
  echo "[훅 차단] $1" >&2
  exit 2
}

# 1) git add -A / --all / . — 여러 에이전트가 같은 폴더에서 돌 때 남의 변경까지 올라가는 사고를 막는다
if grep -Eq '(^|[;&|[:space:]])git[[:space:]]+add[[:space:]]+([^;&|]*[[:space:]])?(-A|--all|\.)([[:space:]]|$|[;&|])' <<<"$cmd"; then
  block "git add -A / --all / . 는 금지입니다. 'git add <경로>'로 바뀐 파일만 올리세요."
fi

# 2) 항공권 저장소 .venv 삭제·재생성 — iCloud 동기화라 삭제가 다른 기기로 퍼진다
if grep -q 'airfare-forecasting-ml' <<<"$cmd" && grep -Eq '(rm[[:space:]][^;&|]*\.venv|venv[[:space:]]+[^;&|]*\.venv|virtualenv)' <<<"$cmd"; then
  block "항공권 저장소(iCloud)의 .venv는 지우거나 다시 만들지 않습니다. ~/.venvs/airfare-py311을 쓰세요(scripts/py.sh)."
fi

# 3) git commit 검사
if grep -Eq '(^|[;&|[:space:]])git[[:space:]]+([^;&|]*[[:space:]])?commit([[:space:]]|$)' <<<"$cmd" && git rev-parse --git-dir >/dev/null 2>&1; then
  # 3-1) 커밋 이메일은 GitHub noreply만 — 개인 이메일이 기록에 남으면 사이트의 이메일 숨김이 무의미해진다
  email=$(git config user.email || true)
  case "$email" in
    *@users.noreply.github.com) ;;
    *) block "커밋 이메일이 '$email'입니다. git config user.email \"55799748+hyde0395@users.noreply.github.com\" 로 바꾼 뒤 커밋하세요." ;;
  esac

  # 3-2) main 직접 커밋은 문서(*.md, docs/)만 — main에 올라가면 곧바로 운영 배포된다
  branch=$(git branch --show-current 2>/dev/null || true)
  if [ "$branch" = "main" ]; then
    files=$(git diff --cached --name-only)
    if grep -Eq '[[:space:]](-a|--all|-[a-zA-Z]*a[a-zA-Z]*)([[:space:]]|$)' <<<"$cmd"; then
      files=$(printf '%s\n%s' "$files" "$(git diff --name-only)")
    fi
    bad=$(printf '%s\n' "$files" | grep -v '^$' | grep -Ev '(\.md$|^docs/)' || true)
    if [ -n "$bad" ]; then
      block "main에 코드 직접 커밋 금지(문서만 예외). 브랜치 → PR → CI → 사용자 확인 → fast-forward 병합으로 하세요. 문서 아닌 파일: $(echo "$bad" | tr '\n' ' ')"
    fi
  fi
fi

exit 0
