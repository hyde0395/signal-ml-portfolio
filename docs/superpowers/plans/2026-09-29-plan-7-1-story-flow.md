# 계획 7-1: 이야기 흐름 — ③ 모델 문단, ④ 발견 / ⑤ 검증 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ③을 "모델과 피처"로 바꿔 맨 앞에 모델 구조 문단(노선별 NeuralProphet 기준 가격 + XGBoost 로그 잔차, Optuna, 분위수 구간, SHAP)을 두고, ④ CHARTS를 ④ FINDINGS(출발일·U자)와 ⑤ VALIDATION(R² 거품·평가 방식 표·예측 구간·한계)으로 나눈다.

**Architecture:** 섹션 순서·번호·옆 목차는 `src/lib/sections.ts` 한 곳에서 나오므로 `charts` 한 줄을 `findings`·`validation` 두 줄로 바꾸고, `Charts.tsx`는 블록 그리기를 공유하는 두 섹션 부품(`Findings`·`Validation`)을 내보낸다. 3D 장면은 섹션이 아니라 블록의 `data-scene`으로 고르므로 블록을 옮겨도 장면 대응은 그대로다. ③에는 `.chapter` 모델 카드(새 지형 장면 키 `model`, 카메라 자리 하나 — 새 점 연출 없음)를 와플 블록 앞에 둔다. 문구는 `content/{ko,en,ja}.json`, 수치는 이미 있는 `facts.json` 값만 쓴다.

**Tech Stack:** Next.js 정적 export(서버 부품) · React Three Fiber 장면 표 · Vitest · Playwright(+axe)

**설계:** `docs/superpowers/specs/2026-09-29-story-flow-design.md`

## 공통 규칙

- **작업 폴더**: git worktree `~/dev/untitled folder/signal-ml-portfolio-7-1`, 브랜치 `plan-7-1-story`(origin/main에서). `node_modules`는 원래 폴더에서 APFS 복제(`cp -c -R`) — 심볼릭 링크는 Turbopack이 거부한다. main에 직접 커밋하지 않는다.
- **코드 주석은 한국어**: 새 파일 맨 위 한두 줄, 이유가 드러나지 않는 로직에 "왜". 코드를 한 줄씩 옮겨 적는 주석은 달지 않는다. 구현 에이전트 지시에도 이 규칙을 넣는다.
- 커밋 이메일은 저장소 설정(noreply) 그대로, 메시지 끝에 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **문구 규칙**: 숫자 직접 기입 금지(`{model.…}`·`{data.…}` 자리표시만 — `tests/unit/content.test.ts`가 3개 언어 검사), 세 언어 키 동일. 톤은 담백하게, 슬로건·광고조·설명조 금지. 한국어를 사용자가 확인한 뒤에 영·일을 확정한다(Task 4).
- **데모·연락처는 건드리지 않는다**(사용자가 나중에 다시 만든다).
- **포트**: e2e는 `out/`을 `npx serve out -l 4173`으로 띄우고 CI가 아니면 **이미 떠 있는 서버를 재사용**한다(`playwright.config.ts`). 다른 worktree(6-5 등)가 4173을 쓰고 있으면 그 폴더의 `out/`을 테스트하게 되므로 e2e 전에 `lsof -ti :4173`으로 확인하고 비어 있지 않으면 그 서버를 끈다. 눈 확인용 개발 서버는 다른 작업과 겹치지 않게 `npx next dev -p 3071`.
- **용량 예산**: 초기 JS gzip ≤ 150KB, 3D 청크 ≤ 280KB(`npm run size`, CI). 무거운 라이브러리는 `import()`로만(`tests/unit/client-imports.test.ts`).
- **3D 눈 확인**: 헤드리스 swiftshader는 몇 초 뒤 3D를 끄므로 헤드 있는 크로미움을 화면 밖에 띄워(`chromium.launch({ headless: false, args: ['--window-position=-2400,0'] })`) 실제 GPU로 본다. 임시 스크립트는 세션 스크래치 폴더에 두고 `NODE_PATH="$PWD/node_modules" node …`로 돌린다(커밋하지 않음).
- e2e 전에 `npm run build`. 흔들리는 e2e 두 개(`board.spec` "화면에 들어오면 넘어가고…", `terrain.spec` 화소 대비 — 전체를 한꺼번에 돌릴 때 드물게)는 실패하면 따로 한 번 더 돌려 본다.

## 파일 지도

| 파일 | 할 일 |
|---|---|
| `src/lib/sections.ts` · `tests/unit/sections.test.ts` | `features` 머리표 `MODEL & FEATURES`, `charts` → `findings`(`FINDINGS`)·`validation`(`VALIDATION`) |
| `src/components/HomePage.tsx` | `SECTION_VIEWS`에 `findings`·`validation` |
| `src/components/sections/Charts.tsx` | 블록 목록 둘로, `renderBlock` 공유, `Findings`·`Validation` 내보내기, 블록 머리표 `VALIDATION` → `EVALUATION`(사용자 확인 뒤) |
| `src/styles/globals.css` | `.charts-head` 규칙이 두 머리에 그대로 맞는지(필요하면 선택자만) |
| `src/three/scenes.ts` · `tests/unit/three-scenes.test.ts` | 새 지형 장면 키 `model`(+ 세로 화면 값) |
| `src/components/sections/Features.tsx` | 모델 카드(`.chapter`, `data-scene="model"`) + 와플 블록(`h3`, 도구 줄 정리) |
| `src/lib/facts.ts` · `data/facts.json` | 코드 링크 장 `model`(`blob/main/src/models/v2_predictor.py`) |
| `content/{ko,en,ja}.json` | `features.structure.*`, `charts.validationHeading` 추가, `features.model` 삭제 |
| `tests/e2e/site.spec.ts` · `terrain.spec.ts` · `board.spec.ts` | 섹션 id·블록 개수·대비 검사 자리·옆 목차 링크 이름 |
| 설계 문서 · `CLAUDE.md` · `README.md` | 구현 결과, 상태 표, 페이지 구성, 옛 주소 고침 |

---

### Task 1: 섹션 목록 — ③ 머리표, ④ FINDINGS / ⑤ VALIDATION

**Files:** Modify `src/lib/sections.ts`, `src/components/HomePage.tsx`, `src/components/sections/Charts.tsx`, `content/{ko,en,ja}.json`, `src/styles/globals.css`(필요하면) · Test `tests/unit/sections.test.ts`, `tests/e2e/site.spec.ts`, `tests/e2e/terrain.spec.ts`, `tests/e2e/board.spec.ts`

- [ ] **Step 1: 실패하는 단위 테스트** — `tests/unit/sections.test.ts`의 기대값을 바꾼다:

```ts
expect(SECTIONS.map((s) => s.id)).toEqual(['project', 'data', 'features', 'findings', 'validation']);
expect(SECTIONS.map((s) => sectionNumber(s.id))).toEqual(['01', '02', '03', '04', '05']);
expect(eyebrow('features')).toBe('03 — MODEL & FEATURES');
expect(eyebrow('findings')).toBe('04 — FINDINGS');
expect(eyebrow('validation')).toBe('05 — VALIDATION');
```

`eyebrow('charts')` 줄은 지운다. `npx vitest run tests/unit/sections.test.ts` → 실패 확인.

- [ ] **Step 2: 섹션 목록** — `src/lib/sections.ts`:

```ts
export const SECTIONS = [
  { id: 'project', label: 'PROJECT' },
  { id: 'data', label: 'DATA COLLECTION' },
  { id: 'features', label: 'MODEL & FEATURES' },
  { id: 'findings', label: 'FINDINGS' },
  { id: 'validation', label: 'VALIDATION' },
] as const;
```

파일 맨 위 주석의 "섹션 추가 예정" 류 문장이 있으면 지금 상태에 맞게 고친다. 단위 테스트 통과 확인.

- [ ] **Step 3: `Charts.tsx`를 두 섹션으로** — 한 파일에 둔다(블록 그리기·공휴일 표·표시 상자 틀을 공유). 모양:

```tsx
// ④ 발견·⑤ 검증(설계 2026-09-29 이야기 흐름 §2·§3.1). 두 섹션이 블록 그리기를 공유한다 — 차트 1·2·4는 그림 판
// (ChartStage) 블록, 차트 3·평가 방식 표·한계는 글 카드(.chapter). 장면은 블록의 data-scene으로 고르므로
// 블록을 어느 섹션에 두든 3D 장면 대응은 같다(three/activeScene.ts).
const FINDINGS_BLOCKS: Block[] = [ /* depart, curve — 지금 값 그대로 */ ];
const VALIDATION_BLOCKS: Block[] = [ /* bubble, validation, band, limits — 지금 값 그대로 */ ];

function ChartSection({ locale, id, headingKey, blocks }: { locale: Locale; id: 'findings' | 'validation'; headingKey: string; blocks: Block[] }) {
  // 지금 Charts 본문 그대로, 섹션 id·머리표·제목 키·블록 목록만 인자로
  return (
    <section id={id} className="wrap" aria-labelledby={`${id}-h`}>
      <div className="charts-head">
        <p className="eyebrow" data-flip-on-enter>{eyebrow(id)}</p>
        <h2 id={`${id}-h`} className="display" data-reveal>{t(headingKey)}</h2>
      </div>
      {blocks.map(renderBlock)}
    </section>
  );
}
export const Findings = ({ locale }: { locale: Locale }) => <ChartSection locale={locale} id="findings" headingKey="charts.heading" blocks={FINDINGS_BLOCKS} />;
export const Validation = ({ locale }: { locale: Locale }) => <ChartSection locale={locale} id="validation" headingKey="charts.validationHeading" blocks={VALIDATION_BLOCKS} />;
```

블록 `id`·`tag`·`chart`/`scene`·`code`·`paras`는 **바꾸지 않는다**(블록 머리표 `VALIDATION` → `EVALUATION`은 Task 4에서 사용자 확인 뒤). `HomePage.tsx`의 `SECTION_VIEWS`를 `{ project, data, features, findings: Findings, validation: Validation }`로, import도 고친다. 파일 맨 위 주석의 "④ 차트" 설명을 새 구조로.

- [ ] **Step 4: 문구** — `content/{ko,en,ja}.json`의 `charts`에 `validationHeading`을 더한다(ko "모델 검증", en "Checking the model", ja "モデルの検証" — 설계 §5.4, Task 4에서 확정).
- [ ] **Step 5: CSS** — `.charts-head` 규칙(`globals.css` 268·272행 근처)은 클래스 선택자라 두 머리에 그대로 적용된다. `#charts` id 선택자가 남아 있지 않은지 `grep -n "#charts" src` 로 확인.
- [ ] **Step 6: e2e 기대값** —
  - `site.spec.ts`: 섹션 id 목록을 `['project', 'data', 'features', 'findings', 'validation', 'demo', 'contact']`로, `#charts [data-scene]` 6개 → `#findings [data-scene]` 2개 + `#validation [data-scene]` 4개, JS 없이 `#charts table` → `#validation table`. 순서 검사 한 줄 추가: `main` 안 `#features, #findings, #validation, #demo` 순서.
  - `terrain.spec.ts`: `?capture=bogus` 테스트의 `#charts-h` → `#findings-h`. 화소 대비 목록의 `['#charts-h', 1]` → `['#findings-h', 1]`, `['#validation-h', 1]` 추가(⑤ 머리는 U자 판이 빠져나가는 자리 위에 뜬다 — 설계 §3.4).
  - `board.spec.ts`: 옆 목차 링크 이름 `'03 FEATURES'` → `'03 MODEL & FEATURES'`(두 곳).
- [ ] **Step 7: 확인** — `npm run typecheck && npm test`. 커밋 `feat(sections): split ④ into findings and ⑤ validation; ③ label MODEL & FEATURES`.

### Task 2: 모델 카드 장면 키 `model`

**Files:** Modify `src/three/scenes.ts` · Test `tests/unit/three-scenes.test.ts`

- [ ] **Step 1: 실패하는 테스트** — `KEYS`에 `'model'`을 더한다(`'dataBoard'` 뒤). 새 검사 하나:

```ts
it('model은 지형 장면이다(지도·제거 레이어·차트·흐림 없음) — 설계 2026-09-29 이야기 흐름 §3.4', () => {
  const s = SCENES.model;
  expect([s.map, s.removed, s.chart, s.rows, s.airport]).toEqual([0, 0, 0, 0, 0]);
  expect(s.dim).toBe(1);
});
```

기존 검사(지도는 problem·dataBoard만, 차트는 네 개만, 세로 화면 1.6배 물러남 등)가 `model`에도 그대로 돈다. `npx vitest run tests/unit/three-scenes.test.ts` → `모든 키가 있다` 실패 확인.

- [ ] **Step 2: 구현** — `SceneKey`에 `'model'`, `SCENES`에:

```ts
// ③ 모델 카드(설계 2026-09-29 이야기 흐름 §3.4): 문단이 "출발일별 가격 흐름"을 말하므로 가격 지형을 조용히 보여 준다.
// 새 점 연출 없이 카메라 자리만 — 처음 값은 limits 구도, 글 대비 화소 검사를 지키는 값으로 Task 5에서 맞춘다
model: { ...base, camera: [-5, 12, 26], target: [-5, 0, 0], noise: 0.5 },
```

`PORTRAIT_OVERRIDE`에 `model: { camera: [0, 9, 26], target: [0, -3, 0] }`(글이 아래쪽인 세로 화면에서 지형을 위쪽 절반으로 — limits와 같은 이유). 테스트 통과 확인.
- [ ] **Step 3:** 커밋 `feat(3d): terrain scene key for the ③ model card`.

### Task 3: ③ 모델 카드 + 와플 정리

**Files:** Modify `src/components/sections/Features.tsx`, `src/lib/facts.ts`, `data/facts.json`, `content/{ko,en,ja}.json`, `src/styles/globals.css`(필요하면)

- [ ] **Step 1: 코드 링크 장** — `src/lib/facts.ts`의 `chapters`에 `'model'`, `data/facts.json`의 `codeLinks.paths`에 `"model": "blob/main/src/models/v2_predictor.py"`. (`export_facts.py`는 `codeLinks`를 보존하므로 스크립트 변경 없음.) `npx vitest run tests/unit/facts.test.ts` 통과 확인.
- [ ] **Step 2: 문구(ko 초안 + en/ja 임시)** — 세 언어에 같은 키를 더한다(키가 달라지면 테스트가 막으므로 en/ja도 설계 §5.2·§5.3 초안을 일단 넣는다 — Task 4 전까지 "검토 전"):
  - `features.structure.heading` · `body1` · `body2` · `flow` (설계 §5)
  - `features.model` 삭제(세 언어 모두)
- [ ] **Step 3: `Features.tsx`** — 섹션 안에 모델 카드 → 와플 블록 순서:

```tsx
<section id="features" className="wrap" aria-labelledby="features-h">
  {/* 모델 카드: 모델 구조 문단(설계 2026-09-29 이야기 흐름 §5). 섹션 머리표·h2는 여기로 옮겼다 —
      #features-h는 움직임 e2e가 쓰는 제목 리빌 대상이라 id를 그대로 둔다 */}
  <article className="chapter model-card" data-scene="model" aria-labelledby="features-h">
    <p className="eyebrow" data-flip-on-enter>{eyebrow('features')}</p>
    <h2 id="features-h" className="display" data-reveal>{t('features.structure.heading')}</h2>
    <p>{t('features.structure.body1')}</p>
    <p>{t('features.structure.body2')}</p>
    <p className="muted mono data-tools model-flow">{t('features.structure.flow')}</p>
    <a className="code-link mono" href={codeUrl('model')} target="_blank" rel="noopener noreferrer">{t('common.codeLink')} ↗</a>
  </article>
  <article className="chart-block" data-scene="features" aria-labelledby="waffle-h" style={{ '--paras': 3 } as React.CSSProperties}>
    {/* ChartStage 그대로 */}
    <div className="chart-copy">
      <h3 id="waffle-h" className="display">{t('features.heading')}</h3>
      {/* sr-only 목록 그대로 */}
      <div className="chart-paras">
        {/* 칸 1: lead + hint, 칸 2: lookupNote (그대로), 칸 3: features.serve 한 줄만 */}
      </div>
      {/* 코드 보기(features) 그대로 */}
    </div>
  </article>
</section>
```

  - 파일 맨 위 주석을 새 구조로("③ 모델과 피처: 모델 카드 → 점 와플").
  - 제목 크기: 와플 `h3.display`가 예전 `h2.display`와 같은 크기로 보이는지 확인(`.chart-copy h3`는 `margin-bottom`만 정한다 — 크기가 작아졌으면 `.chart-copy h3.display`에 예전 `h2` 크기를 준다).
  - 모델 카드는 `.chapter`라 3D 켜짐에서 `min-height: 100vh`·글 폭 560px 규칙을 그대로 받는다. `flow` 줄이 휴대폰 폭에서 넘치면 `.model-flow { overflow-wrap: anywhere; }`.
- [ ] **Step 4: 확인** — `npm run typecheck && npm test`(키 일치·숫자 금지·자리표시 해석 포함). `npx next dev -p 3071`로 ko 페이지를 열어 ③이 "머리표 → 모델 구조 → 문단 두 개 → 흐름 줄 → 와플" 순서로 읽히는지 본다.
- [ ] **Step 5:** 커밋 `feat(features): model structure card before the feature waffle`.

### Task 4: 사용자에게 한국어 문구 확인받기 → 영·일 확정

**Files:** Modify `content/{ko,en,ja}.json`, `src/components/sections/Charts.tsx`(블록 머리표)

- [ ] **Step 1: 사용자에게 한국어 문구 확인받기** — 실제 화면(개발 서버 3071 또는 PR 미리보기)과 함께 한 번에 하나씩 묻는다:
  1. 모델 카드 제목·문단 두 개·흐름 줄(설계 §5.1)
  2. ⑤ 제목 "모델 검증"
  3. 머리표 `03 — MODEL & FEATURES`(또는 `MODEL`), ⑤ 안 블록 머리표 `VALIDATION` → `EVALUATION` 바꿀지
  사용자가 고친 문장을 그대로 반영한다. 사용자가 확인하기 전에는 en/ja를 확정하지 않는다.
- [ ] **Step 2: 영·일 확정** — 확정된 한국어에 맞춰 en/ja를 다시 쓴다(같은 톤, 담백하게, 숫자는 자리표시로). 영어는 사용자, 일본어는 사용자가 섭외한 검수자가 나중에 본다(공개 전 준비) — 이 계획에서는 Claude 초안으로 둔다.
- [ ] **Step 3:** 블록 머리표를 바꾸기로 했으면 `Charts.tsx`의 `tag: 'VALIDATION'` → `'EVALUATION'`(e2e에서 이 글자를 찾는 곳이 있는지 `grep -rn "'VALIDATION'" tests`).
- [ ] **Step 4:** `npm test` → 커밋 `content: model card and ⑤ heading copy (ko reviewed; en/ja drafts)`.

### Task 5: e2e·axe·대비·눈 확인·용량

**Files:** Modify `tests/e2e/terrain.spec.ts`(대비 자리), `src/three/scenes.ts`(모델 카메라 값 조정 시)

- [ ] **Step 1: 대비 검사 자리 추가** — `terrain.spec.ts` 화소 대비 목록에 `['[data-scene="model"] > p:not(.eyebrow)', 1]`(모델 카드 첫 문단)과 `['.model-flow', 0.72]`(작은 `--mute` 글자라 엄격하게)를 넣는다(Task 1의 `#validation-h`와 함께).
- [ ] **Step 2: 빌드·e2e** — `lsof -ti :4173` 비었는지 확인 → `npm run build && npm run e2e`(desktop·mobile, axe 포함). 실패하면 원인을 고친다 — 모델 카드 대비가 모자라면 `SCENES.model`의 `noise`를 낮추거나 목표점을 글 반대쪽으로 옮긴다(세로 화면은 목표점 y를 더 내린다). 값을 바꾸면 단위 테스트도 다시.
- [ ] **Step 3: 눈 확인(실제 GPU, 데스크톱 1440×900 + 세로 390×844)** — 스크래치 스크립트로 스크롤하며 찍는다: ② 보드 → ③ 모델 카드(지형이 글 오른쪽/위쪽에 조용히), 모델 카드 → 와플(점이 와플로 모임), 와플 → ④ 머리 → CHART 01, **CHART 02 → ⑤ 머리 → CHART 03**(U자 점이 판과 함께 위로 빠지고 ⑤ 머리 뒤가 비어 있는지, 이어서 지형으로 풀리는지), 옆 목차 5칸의 호박색 표시가 섹션을 따라가는지. 3D 꺼짐(움직임 줄이기 `reducedMotion: 'reduce'` — URL로 끄는 스위치는 없다)에서 모델 카드가 글만으로 읽히는지.
- [ ] **Step 4: 용량** — `npm run size`: 초기 JS ≤ 150KB(ko·en·ja), 3D 청크 ≤ 280KB. 숫자를 기록해 둔다(Task 6).
- [ ] **Step 5:** 고친 것이 있으면 커밋 `test(e2e): contrast checks for the model card and ⑤ head`.

### Task 6: 검사·기록·PR

**Files:** Modify `docs/superpowers/specs/2026-09-29-story-flow-design.md`, `CLAUDE.md`, `README.md`

- [ ] **Step 1: 전체 검사** — `npm run typecheck && npm test && npm run build && npm run size && npm run e2e`. 대체 이미지(`hero`·`problem`·`bubble`)는 이번 변경과 무관 — 다시 찍지 않는다.
- [ ] **Step 2: 설계 문서 기록** — 끝에 `## 구현 결과 (계획 7-1)`: 최종 섹션·머리표·제목, 확정된 한국어 문구(영·일은 검토 전), `SCENES.model` 최종 값, 대비 검사 수치, 용량(초기 JS·3D 청크), 테스트 개수, 알게 된 작은 것.
- [ ] **Step 3: `CLAUDE.md`** —
  - 현재 상태 문단·표: 6-5 줄을 `✅ PR #15 (2026-09-29 병합·배포)`로(이미 main에 있음 — `gh pr view 15`로 확인), 7-1 줄 추가(`7-1 이야기 흐름 | ③ 모델 카드, ④ FINDINGS / ⑤ VALIDATION | 2026-09-29-plan-7-1-story-flow.md | ✅ PR #N 대기`).
  - 페이지 구성: 3번을 `03 — MODEL & FEATURES`(모델 구조 문단 → 피처 와플), 4번을 `04 — FINDINGS`(출발일 점 그래프 + 요일 평균 · U자 벌떼), 5번 `05 — VALIDATION`(R² 거품 · 평가 방식 표 · 예측 불확실성 구름 · 한계) 추가. "섹션 추가 예정, 무엇일지는 미정" 문구 정리.
  - 다음 할 일: 1번(이야기 흐름 개선)을 완료로 정리, 5-3c 항목의 "③ 와플" 설명은 그대로(와플 블록은 `data-scene="features"` 그대로).
  - **옛 주소 고침**: `https://signal-ml-portfolio.vercel.app` → `https://signal-ml.vercel.app`(CLAUDE.md "운영:" 줄, 다음 할 일 5번 문장 정리). 먼저 `curl -sI https://signal-ml.vercel.app | head -1`로 새 주소가 응답하는지 확인하고, 아직이면 사용자에게 알린 뒤 사용자 결정(2026-09-29)대로 바꾼다.
- [ ] **Step 4: `README.md`** — 5행 `사이트:` 주소를 `https://signal-ml.vercel.app`로. 섹션 구성을 설명하는 곳이 있으면 ④/⑤로 고친다(`grep -n "CHARTS\|④" README.md`).
- [ ] **Step 5:** 커밋 `chore: record plan 7-1`.
- [ ] **Step 6: PR** — `git push -u origin plan-7-1-story` → `gh pr create --base main --title "plan 7-1: story flow — model card, ④ findings / ⑤ validation"`, 본문에 요약·확인할 것(③ 모델 카드 문구, ⑤ 머리 구간 3D, 옆 목차 5칸)·검사 결과, 끝에 `🤖 Generated with [Claude Code](https://claude.com/claude-code)`. CI 통과 → 사용자 미리보기 확인 → main에 fast-forward 병합(사용자 확인 뒤) → 운영 확인 → CLAUDE.md 표 PR 번호·병합 날짜 기록.
