---
name: session-handoff
description: 맥미니·맥북을 오가며 작업할 때 세션 시작(최신 받기·상태 확인)과 세션 끝(push·상태 기록) 절차. 새 세션을 시작하거나 "오늘은 여기까지"·기기를 옮길 때 쓴다.
---

# 세션 시작·끝 (기기 이동)

사용자는 맥미니와 맥북을 번갈아 쓴다. **한 기기에만 남는 것은 없어야 한다.**

- 저장소 위치: 맥북 `~/dev/untitled folder/signal-ml-portfolio`, 맥미니 `~/dev/signal-ml-portfolio`(경로만 다르다)
- git worktree·`.superpowers/`(시안)·Claude 메모리·`.claude/settings.local.json`은 **기기마다 따로**라 다른 기기에서 보이지 않는다 — 필요한 내용은 CLAUDE.md나 `docs/`에 남긴다

## 세션 시작
1. `git switch main && git pull --ff-only` → `git fetch --prune` → `gh pr list`로 열린 PR 확인 → `npm ci`(의존성이 바뀌었을 수 있다)
2. 이 기기에서 처음이거나 기기별 준비(impeccable 엔진·훅, Playwright MCP, Figma 로그인)가 안 됐으면 `new-device-setup` 스킬
3. CLAUDE.md "현재 상태"·"다음 할 일"을 읽고, 이미 정한 결정은 다시 묻지 않는다
4. 운영 첫 확인이 남아 있으면 https://signal-ml.vercel.app 를 사용자에게 링크와 함께 안내

## 세션 끝 (기기를 떠나기 전)
1. 작업 브랜치는 모두 push(`git status`, `git log origin/<브랜치>..` 로 빠진 것 없는지)
2. 열린 PR 번호·남은 일·사용자에게 물을 질문을 CLAUDE.md "현재 상태"에 적는다(날짜·기기 표시). 결정 기록이 길면 `docs/superpowers/notes/`로 빼고 CLAUDE.md에는 한 줄 + 링크
3. 남길 시안은 `.superpowers/`에서 `docs/superpowers/mockups/<날짜>/`로 복사
4. 문서만 바뀐 커밋은 main에 바로 올려도 된다(훅이 문서 외 파일이 섞이면 막는다) → `git push`
