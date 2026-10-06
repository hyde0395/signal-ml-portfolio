---
name: new-device-setup
description: 맥미니·맥북 등 새 기기에서 이 저장소를 처음 준비할 때(clone, 커밋 이메일, Node·Playwright, 파이썬 venv, impeccable 엔진·훅, Playwright MCP, Figma 로그인). 기기별 한 번만.
---

# 기기별 처음 한 번

1. 받기: `git clone git@github.com:hyde0395/signal-ml-portfolio.git ~/dev/signal-ml-portfolio`
2. **커밋 이메일**(clone으로 안 따라온다, 훅이 확인함): `git config user.email "55799748+hyde0395@users.noreply.github.com"` · `git config user.name hyde0395`. 개인 이메일이 git 기록에 남으면 사이트의 이메일 숨김이 무의미해진다
3. **push는 SSH 원격으로**(`git remote -v`가 `git@github.com:…`). HTTPS(gh 토큰)는 `workflow` 권한이 없어 `.github/workflows/`를 바꾸는 push가 거절된다(`gh auth refresh -s workflow`). 맥미니는 SSH 키가 GitHub에 없어 HTTPS로 push했었다 — workflow 파일을 바꿀 일이 생기면 먼저 키를 등록한다
4. Node 24(`.nvmrc`) → `npm ci` → `npx playwright install chromium` → `npm test` · `npm run build` · `npm run size` · `npm run e2e`(출력이 길면 `test-runner` 에이전트)
5. 데이터 스크립트(`npm run facts|terrain|map|demo|charts|pytest`)만 항공권 저장소가 필요하다
   - 항공권 저장소 `.venv`는 **지우거나 다시 만들지 않는다**(iCloud 동기화)
   - 기기마다 iCloud 밖에 venv: `brew install python@3.11` → `"$(brew --prefix python@3.11)/bin/python3.11" -m venv ~/.venvs/airfare-py311` → `~/.venvs/airfare-py311/bin/pip install -r ~/Documents/airfare-forecasting-ml/requirements.txt pytest`
   - 맥북에는 있음. 맥미니는 없고(2026-10-01) `scripts/py.sh`가 저장소 `.venv`로 넘어가 잘 돌았다
6. **디자인 스킬·연결 도구**: 스킬 3개(`emil-design-eng`·`design-taste-frontend`·`impeccable`, 출처 `skills-lock.json`·각 `LICENSE`)는 커밋돼 있다. 기기마다:
   - `npx --yes impeccable@latest install --providers=claude --scope=project` — 엔진 실행 파일(`.claude/skills/impeccable/scripts/bin/`, git 제외)과 훅(`.claude/settings.local.json`, git 제외)을 넣는다. 스킬 파일이 새 판으로 바뀌면 diff를 보고 커밋할지 정한다
   - `claude mcp add playwright npx @playwright/mcp@latest`
   - Figma: Claude Code에서 `/mcp`로 로그인 승인
   - Claude Code를 껐다 켜야 새 스킬을 읽는다
   - 상태: 맥미니 완료(2026-10-04), 맥북 아직
7. `.superpowers/`(시안)·`.lighthouse/`는 git에 없다
8. 이 프로젝트는 iCloud 밖(`~/dev/…`)에 둔다
