# signal-ml-portfolio

ML 엔지니어 포트폴리오 사이트. 사이트 브랜드는 **SIGNAL**.

Awwwards / FWA 수준의 인터랙티브 디자인을 가진 **취업·이직용 개발자 포트폴리오**. 목표 포지션은 **ML 엔지니어**.

## 이 저장소의 Claude 설정 (`.claude/`)

- `rules/` — 주제별 규칙. 파일 위 `paths`에 적힌 경로를 만질 때만 읽힌다
  - `content-i18n`(문구·3개 언어·수치·개인 정보) · `airfare-facts`(대표 프로젝트 수치·스토리·주의점) · `visual-system`(색·글꼴·모션·페이지 구성·데모·접근성) · `three-d`(3D 지형) · `data-pipeline`(추출 스크립트·데모 데이터·항공권 저장소) · `testing` · `performance` · `code-style`(한국어 주석)
- `skills/` — 절차. `session-handoff`(세션 시작·끝, 기기 이동) · `new-device-setup`(기기별 처음 한 번) · `ship-pr`(PR → 병합 → 운영 확인, 미리보기 링크) · `refresh-data`(재학습 뒤 갱신 순서) + 디자인 스킬 `impeccable`·`design-taste-frontend`·`emil-design-eng`
- `hooks/` + `settings.json` — 절대 규칙은 훅이 막는다: `git add -A/./--all`, noreply 아닌 커밋 이메일, main에 문서 외 파일 커밋, 항공권 저장소 `.venv` 삭제·재생성, `public/data/*.json` 손 편집
- `agents/` — `test-runner`(테스트·빌드·e2e·CI 로그처럼 출력이 긴 실행을 맡기고 요약만 받는다) + impeccable 보조 에이전트 4개
- 기기마다 따로: `.claude/settings.local.json`(impeccable 훅), git worktree, `.superpowers/`, Claude 메모리

## 새 세션 시작할 때 (맥미니·맥북을 오가며 작업한다)

사용자는 **맥미니와 맥북을 번갈아** 쓴다 — **한 기기에만 남는 것은 없어야 한다**. 시작·끝 절차는 `session-handoff` 스킬, 새 기기 준비는 `new-device-setup` 스킬.

- 요약: `git switch main && git pull --ff-only` → `git fetch --prune` → `gh pr list` → `npm ci` → 아래 "현재 상태"·"다음 할 일"을 읽고, 이미 정한 결정은 다시 묻지 않는다
- 저장소 위치: 맥북 `~/dev/untitled folder/signal-ml-portfolio`, 맥미니 `~/dev/signal-ml-portfolio`
- **기기를 떠나기 전**: 작업 브랜치 모두 push, 열린 PR 번호·남은 일을 "현재 상태"에 적고 main에 올린다

## 작업 방식

- 새 기능: `superpowers:brainstorming`(시각 결정은 시안) → `superpowers:writing-plans` → 실행(subagent-driven-development). 브랜치(가능하면 worktree `../signal-ml-portfolio-<이름>`) → PR → CI → 사용자 확인 → main에 fast-forward 병합 → 운영 확인(`ship-pr` 스킬)
- **동시에 할 수 있는 일은 에이전트를 병렬로 돌리는 것을 먼저 권한다**(2026-09-30). 파일이 겹치지 않는 묶음(파이썬 추출 / 배치 코드 / 3D 셰이더 / 문구)이나 서로 다른 worktree의 일
  - 같은 폴더의 에이전트는 각자 자기 파일만, `git add <경로>`로만 올린다
  - 무거운 브라우저 테스트는 **동시에 한두 개까지만**(`testing` 규칙)
  - 에이전트 결과는 보고만 믿지 않고 스크린샷을 직접 보고, 명세·품질 검토 에이전트(읽기 전용)를 따로 돌린다
- **사용자에게 확인을 부탁할 때는 반드시 볼 수 있는 링크를 함께 준다**: PR 주소 + Vercel 미리보기 + 어디를 보면 되는지 / 시안은 `http://localhost:<포트>`(30분 쉬면 꺼짐 — 보여 주기 직전 확인) / 운영은 https://signal-ml.vercel.app + 섹션
- 이미 정해진 결정은 다시 묻지 않는다. 질문은 한 번에 하나, 선택지와 추천을 준다
- **문구는 디자인을 모두 정한 뒤에 한꺼번에 바꾼다**(2026-10-01). 그 전까지 문구·꾸밈 값은 임시값으로 데이터(`facts.json`·`content/*.json`)에

## 현재 상태 (2026-10-06, 맥미니 — 다음은 맥북)

운영 https://signal-ml.vercel.app (아직 `noindex`) · GitHub https://github.com/hyde0395/signal-ml-portfolio (공개, main = 운영, PR = Vercel 미리보기) · CI: 타입 검사 → 단위 테스트 → 빌드 → 용량 검사 → e2e(desktop·mobile, axe).

- **병합·배포된 것**: 계획 1~8-1, 9-2·9-3과 작은 문제 정리(PR #1~#28). 계획서는 `docs/superpowers/plans/`, 설계는 `docs/superpowers/specs/`(각 설계 끝 "구현 결과"에 실제로 바뀐 점)
  - 2026-10-01 맥북: PR #23 ② 순서 변경(지도 → 보드 → 걸러내기 판), #24 연락처 가로 탑승권, #25 데모 가운데 정렬·배경 없음
  - 2026-10-04 맥미니: PR #26 계획 9-3 머리말 "잡음 → 신호"(설계 `2026-10-01-noise-signal-design.md`), #27 디자인 스킬 3개 + impeccable 에이전트 4개, #28 점 위계·별자리 선·결론 이름표·⑤ 분위수 점 칸(설계 `2026-10-04-dot-hierarchy-design.md`)
- **9-3 남은 확인(사용자, 운영에서)**: (1) 머리말이 230svh로 길어져 스크롤이 약 1.3화면 늘었다 — 늘리거나 줄일지, (2) ① 배경 밝기 60%·글 뒤 어두운 번짐 세기, (3) 데스크톱에서 마지막으로 키운 번짐은 에이전트가 화면으로 못 봤다 — 맨 위부터 천천히 스크롤해 확인
- impeccable 엔진·훅·Playwright MCP·Figma 로그인: 맥미니 끝, **맥북 아직**(`new-device-setup` 6번)
- PR #29 Claude 설정 분리(rules·skills·hooks·agents) 병합(2026-10-06, 맥북). 열린 PR·작업 브랜치 없음

## ★ 교수님 피드백 (2026-10-01) — 다음 작업의 중심

자세한 기록(바꿀 것 1~3, 질문 7개 답과 근거, 거친 시안): `docs/superpowers/notes/2026-10-01-professor-feedback.md`. 점검표 `docs/superpowers/audits/2026-10-01-info-clarity.html`.

**지적**: "디자인은 괜찮은데 **필요한 정보가 확 들어오지 않는다**. 차트도 그렇고, **불필요한 문구가 많다**." + 사용자 "그래프들이 점이라 잘 안 보인다."

**방향 결정 7개(2026-10-04, 끝)**
1. 첫 화면에 이름·역할을 다시 넣지 않는다(`SIGNAL`만 유지)
2. ① 숫자 4개는 과정 성과만: `258,829` 모은 가격 · `80.2%` 예측 구간 포함률(보정 전 69%) · `0.93 → 0.71` R² 거품 바로잡음 · `6` 노선
3. 머리말 사실 문구(`intro.note`)는 사실이 아니라 뺀다 — 연출은 그대로, 문구 정리 때 키 삭제
4. ④ 순서 유지(출발일 → U자) + 결론형 제목(예: "언제 떠나느냐가 더 크다: 신정 무렵 +71%" / "언제 사느냐는 그보다 작다: 출발 한 달 전후 −5%")
5. ⑤ 예측 구간 = 시안 v6 "가운데 별자리"(`docs/superpowers/mockups/2026-10-04/interval-constellation.html`) — PR #28로 구현
6. 새 수치(요일 평균 일 +20%·화·수 −17%, 신정 +71%, 걸러 낸 행 15,955, 기준선과 MAE 차이 453원(0.9%))를 `export_facts.py`가 계산해 `facts.json`에
7. 자세한 글은 접지 않는다 — 문구 정리 때 블록마다 첫 줄을 결과로, 겹치는 문장만 덜어 낸다

**정보 전달 2 (진행 중, brainstorming — 설계서 아직 없음)**: 범위 = 점 위계 설계서 §8 목록(결론형 제목, ① 숫자 4개 성과로, 차트 3, facts 새 수치, ⑤ 검증 대표값, ③ 모델 구조 자막 2칸, ② 걸러내기 규칙 이름 한국어·개수). 시안 `docs/superpowers/mockups/2026-10-05/`
- **질문 1 답: ⑤ 검증 설계 = "점수판 쌓기"**(`validation-scoreboard.html` 1번 탭) — 순서 그대로(K-Fold → GroupKFold → TSS), 한 줄씩 쌓이고 지나간 방식은 흐리게, 마지막 ▶ TSS R² 0.637 · MAE 48,235원만 호박색 크게, 꼬리표 "운영 기준 · 대표값". 제목(임시) "미래 데이터를 쓰지 않는 검증으로 성능을 잰다"
- **질문 2 답: 차트 3 "R² 거품" = A 전·후 아령**(`bubble-dumbbell.html` 왼쪽) — R² 가로축에 두 줄(0.93 → 0.71, 0.84 → 0.64), 전 = 속 빈 점, 후 = 호박 별, 가는 선 + −0.22·−0.20, 오른쪽 작은 칸에 MAE 48,442 → 48,235원 "거의 그대로", 첫 정정 MAE는 "약 3만 원 그대로" 글자. 자막 칸마다 한 쌍씩. 3D 장면 카드(bubble)를 점 차트 판(ChartStage)으로 바꾼다
- **질문 3 답(2026-10-06): A** — ③ 모델 구조 자막 4칸 → 2칸. 1칸 = 모은 가격 → 1.2초 뒤 저절로 기준 가격(⑤ TSS와 같은 sub 타이머), 2칸 = XGBoost 잔차 + 흐름 줄 + Optuna·분위수·SHAP 한 줄. 거친 것: B 첫 단계 빼고 2칸, C 3칸
- 남은 질문: 4 나머지 섹션(②·③·⑤ 등) 결론형 제목 목록 표로, 5 ② 걸러내기 규칙 이름 한국어 + 개수(지금 `RULE 1 · DURATION · UNIT` 영어, `src/charts/filter.ts` RULES)
- 그 뒤: 설계서 → 계획 → 구현. 다음은 점 가독성 — ④ U자 곡선을 같은 규칙(가운데 핵심 점 = 크게·밝게 + 별자리 선, 바깥 표본 = 작게·옅게)으로 시안 → 규칙 확정 → 모든 차트에. 새 디자인 스킬(`impeccable` critique·audit·clarify·distill 등)을 점검·시안 단계에 쓸 수 있다 — `/impeccable init`(`PRODUCT.md`)은 아직 안 함
- 그 다음: 문구 덜어내기(한꺼번에, 블록마다 남길 글 1~2줄 — 점검표 "남길 글/뺄 글")

## 다음 할 일 (다음 세션부터)

0. **세션 시작**(`session-handoff`). 맥북이면 처음 한 번 `new-device-setup` 6번 뒤 Claude Code 재시작
   - 첫 확인(운영): 9-3 "잡음 → 신호"(위 "남은 확인"), ③ 와플 → ④ 제목, ② 보드 → 걸러내기 판, ⑤ 검증 설계 판
1. **★ 정보 전달 2 설계 — 질문 4/5부터 이어서**(위)
2. **문구 검토(사용자)** — 대기 목록은 `content-i18n` 규칙
3. **점 연출**: 남은 것은 연락처 점 글자(`CHOI HALIM`)·데모 강조 — 사용자가 두 섹션을 다시 만든 뒤에. (② 수집 커버리지 그림은 하지 않기로 함)
4. **차트 3을 예측 대 실제 산점도로**(별도 계획, 무거움 — 정보 전달 2의 아령 차트가 먼저): TSS 폴드별 예측값과 제거 행 9,387개를 포함한 옛 구성(R² 0.84)의 예측값이 필요 — NeuralProphet를 폴드마다 다시 학습(항공권 저장소 `run_tscv`는 예측값을 돌려주지 않음, 몇십 분). 8-1의 `split_block`(폴드 배정) 재사용 가능
5. **연락처·데모 섹션**: 사용자가 나중에 다시 만든다(2026-09-29) — 그 전까지 공들이지 않는다
6. **공개 전 준비(사용자 작업 위주, 스펙 §14)**: 이력서 PDF 3개(`public/resume/{ko,en,ja}.pdf`), 문구 검토 전체(ja 검수자 — 학과 일본어명·데모 문구 포함), LinkedIn(`facts.json` `contact.linkedin`), 공개용 항공권 저장소(만들면 `codeLinks.baseUrl`만 — 8-1에서 `codeLinks.paths.filter` 늘었음), Vercel Web Analytics 켜기, 옛 주소 `signal-ml-portfolio.vercel.app`(404) 리디렉트 여부
7. **공개 전환**: `src/lib/site.ts` `LAUNCHED = true`(noindex·robots Disallow 해제). 사용자가 정한다
8. **성능 최적화(맨 마지막, 별도 계획서)** — 목표·후보는 `performance` 규칙
9. 재학습으로 수치가 바뀌면 `refresh-data` 스킬

## 확정된 결정 (핵심 — 주제별 자세한 내용은 `.claude/rules/`)

- **용도**: 취업·이직용. 채용 담당자가 30초~1분 안에 "누구, 무엇을 잘함, 대표 프로젝트"를 파악할 수 있어야 한다. 연출은 정보를 가리지 않는 선에서
- **콘셉트**: B. 가격 지형(Price Landscape) + A. 플립 글자판 포인트(`three-d` 규칙). 모든 그림이 같은 점이 옮겨 가며 만들어진다
- **기술 스택**: Next.js (App Router) + React Three Fiber + GSAP ScrollTrigger + Lenis. 정적 export를 Vercel에 배포(main = 운영, PR = 미리보기). 도메인은 우선 무료 `*.vercel.app`
- **데모**: 모델 배포 전이므로 미리 계산한 예측을 JSON으로 넣어 서버 없이 동작. "미리 계산된 예측 · 2026-09-22 기준" 표기, 나중에 실제 API로 교체 가능하게
- **이름**: 저장소 `signal-ml-portfolio`(대표 프로젝트 `airfare-forecasting-ml`과 같은 형식), 브랜드 `SIGNAL` — "잡음을 걷어내고 신호를 찾는다"
- **수치 관리**: 콘텐츠와 수치는 데이터 파일 한 곳에(`facts.json`), 문구에 숫자 직접 기입 금지
- **언어**: 한국어 + 영어 + 일본어 처음부터(일본계 회사 지원 고려)
- **데스크톱으로 보는 것을 우선**(2026-09-29) — 화질은 데스크톱 기준, 휴대폰은 가볍게 동작
- **일정 목표**: 일본 新卒(2028년 4월 입사) 채용이 2027년 봄~여름에 몰리므로 **사이트는 2027년 초까지 완성**
- **대표 프로젝트**: 한·일 항공권 가격 예측(`~/Documents/airfare-forecasting-ml`, iCloud 안). 수치·스토리·주의점은 `airfare-facts` 규칙, 원본은 그 저장소 `CLAUDE.md`·`README.md`

## 작업 규칙

- 사용자와는 **한국어**로 대화한다. 설명은 쉬운 말로, 전문 용어는 풀어서
- 질문은 한 번에 하나씩, 가능하면 선택지를 준다
- 시각적인 결정은 비주얼 컴패니언으로 보여 준다. 서버는 `--project-dir <이 기기의 저장소 경로>`로 시작하고, **보여 줄 때마다 주소를 함께 준다**. 남길 시안은 `docs/superpowers/mockups/<날짜>/`에 복사해 커밋(`.superpowers/`는 기기마다 따로)
- 이 프로젝트는 iCloud 밖(`~/dev/…`)에 둔다. 항공권 저장소 스크립트를 돌리기 전에 그쪽 CLAUDE.md의 워밍 절차 확인
- **코드에 한국어 주석**(파일 맨 위 한두 줄 + "왜"). 자세한 건 `code-style` 규칙
- **커밋 이메일**: GitHub noreply(`55799748+hyde0395@users.noreply.github.com`) — 훅이 확인. 나중에 만들 공개용 항공권 저장소에도 똑같이
- **검색 노출**: 공개 전환 전까지 `noindex`(`src/lib/site.ts` `LAUNCHED`). 공개는 사용자가 정한다
- **병합**: main에 직접 커밋하지 않는다(문서만 예외 — 훅이 막음). 브랜치 → PR → CI → 사용자 확인 → fast-forward 병합. main에 올리면 곧바로 운영 배포
- **성능 예산**: 초기 JS gzip ≤150KB(CI `npm run size`), 무거운 라이브러리는 `import()`로만(`performance` 규칙)

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
