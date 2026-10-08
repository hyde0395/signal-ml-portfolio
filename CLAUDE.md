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

- 새 기능: `superpowers:brainstorming`(시각 결정은 시안) → `superpowers:writing-plans` → 실행(subagent-driven-development). 브랜치(가능하면 worktree `../signal-ml-portfolio-<이름>`) → PR → CI → 사용자 확인 → main에 fast-forward 병합 → 운영 확인(`ship-pr` 스킬). 쌓은 PR은 앞 PR 병합 전에 main이 움직이면 둘 다 main 위로 다시 쌓고 뒤 PR 하나로 함께 병합해도 된다
- **동시에 할 수 있는 일은 에이전트를 병렬로 돌리는 것을 먼저 권한다**(2026-09-30). 파일이 겹치지 않는 묶음(파이썬 추출 / 배치 코드 / 3D 셰이더 / 문구)이나 서로 다른 worktree의 일
  - 같은 폴더의 에이전트는 각자 자기 파일만, `git add <경로>`로만 올린다
  - 무거운 브라우저 테스트는 **동시에 한두 개까지만**(`testing` 규칙)
  - 에이전트 결과는 보고만 믿지 않고 스크린샷을 직접 보고, 명세·품질 검토 에이전트(읽기 전용)를 따로 돌린다
- **3D 화면 확인은 스크롤 도중도 찍는다**(2026-10-08): 장면은 화면 가운데선에 걸린 블록으로 바뀌어, 블록을 가운데 맞추고 기다린 캡처만으로는 들어오는 동안 앞 장면이 남는 것을 놓친다
- **사용자에게 확인을 부탁할 때는 반드시 볼 수 있는 링크를 함께 준다**: PR 주소 + Vercel 미리보기 + 어디를 보면 되는지 / 시안은 `http://localhost:<포트>`(30분 쉬면 꺼짐 — 보여 주기 직전 확인) / 운영은 https://signal-ml.vercel.app + 섹션
- 이미 정해진 결정은 다시 묻지 않는다. 질문은 한 번에 하나, 선택지와 추천을 준다
- **문구는 디자인을 모두 정한 뒤에 한꺼번에 바꾼다**(2026-10-01). 그 전까지 문구·꾸밈 값은 임시값으로 데이터(`facts.json`·`content/*.json`)에. 예외: 교수님이 짚은 제목은 바로 고친다(2026-10-08)

## 현재 상태 (2026-10-08, 맥북)

운영 https://signal-ml.vercel.app (아직 `noindex`) · GitHub https://github.com/hyde0395/signal-ml-portfolio (공개, main = 운영, PR = Vercel 미리보기) · CI: 타입 검사 → 단위 테스트 → 빌드 → 용량 검사 → e2e(desktop·mobile, axe).

- **병합·배포된 것**: 계획 1~8-1, 9-2·9-3, 정보 전달 2, 점 위계·배경 밀도, 교수님 피드백 2(PR #1~#33). 계획서 `docs/superpowers/plans/`, 설계 `docs/superpowers/specs/`(각 설계 끝 "구현 결과"에 실제로 바뀐 점), PR별 내용은 `git log`·GitHub
- **진행 중**: PR #34(`feat/contact-trim`, 사용자 미리보기 확인 대기) — 아래 다음 할 일 2·3(연락처 소개 본문 삭제 + 겹치는 문장만 덜어내기)
- **맥북에서 아직 안 한 것**: impeccable 엔진·훅·Playwright MCP·Figma 로그인(`new-device-setup` 6번, 맥미니는 끝)
- **9-3 남은 확인(사용자, 운영에서)**: 머리말 230svh 스크롤 길이, ① 배경 밝기 60%·글 뒤 번짐 세기 — 맨 위부터 천천히 스크롤해 확인

## 교수님 피드백 — 지금까지 반영한 방향

- **1차(2026-10-01)** "디자인은 괜찮은데 필요한 정보가 확 들어오지 않는다, 불필요한 문구가 많다" → 결론형 제목, ① 숫자 4개를 과정 성과로, 점 위계(결론 층 크게·배경 표본 옅게), ⑤ 점수판 등. 기록 `docs/superpowers/notes/2026-10-01-professor-feedback.md`(방향 결정 7개), 정보 전달 2 질문 답은 `specs/2026-10-06-info-clarity-2-design.md`
- **2차(2026-10-08)** "제목만 봐도 숫자가 무엇의 숫자인지 알아야 한다", R² 아령은 "눈이 여러 번 간다", 성능은 "제일 중요하니 크게" → PR #32·#33
  - 제목 규칙: 숫자에 "무엇의"를, 용어는 풀어 쓰고, 앞 제목에 기대지 않는다(`content-i18n` 규칙). ② 수집·③ 와플은 제목 위·아래 작은 줄로 "언제·무엇의"를 보탬
  - ⑤는 R² 거품·성능 대표값·한계 세 곳이 **가운데 정렬 큰 숫자 카드, 뒤에 3D 점 없음**(장면 `blank`) — 점 컨셉의 예외(`visual-system` 규칙)
  - 기록 `docs/superpowers/notes/2026-10-08-professor-headline-feedback.md`, 설계 `specs/2026-10-08-big-numbers-design.md`
- 다음 상담 때 여쭤볼 후보: 대표 프로젝트로 항공권 vs trimat(Rust 삼진 행렬곱 라이브러리, github.com/hyde0395/trimat)

## 다음 할 일 (다음 세션부터)

0. **세션 시작**(`session-handoff`). 맥북이면 처음 한 번 `new-device-setup` 6번 뒤 Claude Code 재시작
1. **운영 확인(사용자)**: ⑤ 큰 숫자 카드 세 곳, ② 수집·③ 와플 제목의 작은 줄, 영어·일본어 제목 줄바꿈
2. **연락처 소개 덜어내기(작은 PR, 2026-10-07 결정)**: `contact.about.body1~3`(①·⑤와 겹침)을 빼거나 한 줄로, 신원 한 줄(이름·`ML ENGINEER`·학교·졸업 예정) + 핵심 역량 3~4줄만, 이력서 PDF는 탑승권 곁에. 페이지는 데모 → 연락처로 끝나고 소개 섹션은 따로 없다
3. **문구 덜어내기 — 겹치는 부분만**(사용자 2026-10-08): 제목·큰 숫자·다른 블록과 같은 말을 되풀이하는 문장만 뺀다(⑤ 한계 첫 문단처럼). 새로 고쳐 쓰지는 않는다. 영·일 초안 검토 대기 목록은 `content-i18n` 규칙
4. ~~평가지표 보강(MASE·구간 폭·pinball loss)~~ **보류**(사용자 2026-10-08 — 지금도 분량이 많다)
5. **점 연출**: 남은 것은 연락처 점 글자(`CHOI HALIM`)·데모 강조 — 사용자가 두 섹션을 다시 만든 뒤에
6. **공개 전 준비(사용자 작업 위주, 스펙 §14)**: 이력서 PDF 3개(`public/resume/{ko,en,ja}.pdf`), 문구 검토 전체(ja 검수자 — 학과 일본어명·데모 문구 포함), LinkedIn(`facts.json` `contact.linkedin`), 공개용 항공권 저장소(만들면 `codeLinks.baseUrl`만), Vercel Web Analytics, 옛 주소 `signal-ml-portfolio.vercel.app`(404) 리디렉트 여부
7. **공개 전환**: `src/lib/site.ts` `LAUNCHED = true`(noindex·robots Disallow 해제). 사용자가 정한다
8. **성능 최적화(맨 마지막, 별도 계획서)** — 목표·후보는 `performance` 규칙
9. 재학습으로 수치가 바뀌면 `refresh-data` 스킬

## 확정된 결정 (핵심 — 주제별 자세한 내용은 `.claude/rules/`)

- **용도**: 취업·이직용. 채용 담당자가 30초~1분 안에 "누구, 무엇을 잘함, 대표 프로젝트"를 파악할 수 있어야 한다. 연출은 정보를 가리지 않는 선에서
- **콘셉트**: B. 가격 지형(Price Landscape) + A. 플립 글자판 포인트(`three-d` 규칙). 모든 그림이 같은 점이 옮겨 가며 만들어진다(예외: ⑤ 큰 숫자 카드 세 곳)
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
- 시각적인 결정은 비주얼 컴패니언으로 보여 준다(시안 2~3개 + 추천). 서버는 `--project-dir <이 기기의 저장소 경로>`로 시작하고, **보여 줄 때마다 주소를 함께 준다**. 남길 시안은 `docs/superpowers/mockups/<날짜>/`에 복사해 커밋(`.superpowers/`는 기기마다 따로)
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
