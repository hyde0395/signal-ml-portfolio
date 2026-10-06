---
name: ship-pr
description: 작업 브랜치를 PR로 올리고 CI·Vercel 미리보기 확인, 사용자 확인 뒤 main에 fast-forward 병합·운영 확인까지 하는 절차. PR을 만들거나 병합·배포할 때 쓴다.
---

# PR → 병합 → 배포

main에 올리면 곧바로 운영(https://signal-ml.vercel.app) 배포된다. main에 직접 코드 커밋 금지(훅이 막음, 문서만 예외).

1. 브랜치(가능하면 git worktree `../signal-ml-portfolio-<이름>`)에서 커밋. 여러 에이전트가 같은 폴더에서 돌면 `git add <경로>`로만(`git add -A` 금지 — 훅이 막음)
2. push → `gh pr create`(본문 끝에 attribution 줄)
3. CI 확인: `gh pr checks <번호>`. 일시 오류(Google Fonts `Can't resolve '@vercel/turbopack-next/internal/font/google/font'`, 휴대폰 3D 저프레임)는 `gh run rerun <id> --failed`. 실패 로그가 길면 `test-runner` 에이전트로 요약
4. **사용자에게 확인을 부탁할 때는 반드시 볼 수 있는 링크를 함께 준다**:
   - PR 주소 + **Vercel 미리보기 주소**(`gh pr checks <번호>`의 Vercel 줄, 또는 PR 댓글 Preview 링크) + "어디를 눌러/스크롤해 보면 되는지"
   - 비주얼 컴패니언 시안이면 `http://localhost:<포트>` — 서버는 30분 쉬면 꺼지므로 보여 주기 직전 `state/server-info` 확인, 꺼졌으면 다시 켜고 새 주소(또는 `open <html>`)
5. 사용자 확인 뒤: `git switch main && git merge --ff-only <브랜치> && git push`
6. 운영 확인: https://signal-ml.vercel.app + 해당 섹션 링크를 사용자에게. 설계서 끝 "구현 결과"에 실제로 바뀐 점을 적고 CLAUDE.md "현재 상태" 갱신
