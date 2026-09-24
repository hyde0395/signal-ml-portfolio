# SIGNAL 계획 4-1/4 — 성능·공유·마감 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 초기 JS를 스펙 목표(gzip 150KB) 안으로 줄이고 CI가 용량을 지키게 한 뒤, 링크 미리보기 이미지·방문 통계·데모 접근성 마무리를 더한다. 계획 4-2(로딩 화면·플립 글자판·스크롤 연출)가 이 용량 검사 위에서 진행된다.

**Architecture:** 초기 JS가 약 243KB(noModule 제외)인 주원인은 3D 판별 코드(`three/capability.ts`)가 `ChapterFigure`에서 상수 하나를 가져오면서 세 언어 사전·facts·zod(gzip 약 90KB)를 통째로 끌고 오는 경로다. 상수를 가벼운 모듈로 옮기고, "클라이언트 파일에서 정적 import로 서버 전용 모듈·zod에 닿지 않는다"는 단위 테스트와 빌드 산출물 용량 검사(`npm run size`, CI)로 다시 생기지 않게 막는다. 링크 미리보기(OG) 이미지는 대체 이미지처럼 실제 3D 첫 화면을 캡처해 사이트 글꼴로 이름을 얹고 커밋한다(CJK 글꼴 파일을 따로 넣지 않기 위해).

**Tech Stack:** Next.js 16.3 static export, React 19, Vitest 5, Playwright 1.63, sharp, @vercel/analytics, Lighthouse 13(npx, CI 밖)

**Spec:** `docs/superpowers/specs/2026-09-23-portfolio-design.md` §8.1·§8.2(용량·성능 목표), §12(공유·통계), §13(용량 검사·CI)

**선행:** 계획 1·2·3 main 병합(2026-09-24). **계획 4-2**(로딩 화면, 플립 글자판, 텍스트 리빌, GSAP ScrollTrigger + Lenis, 휴대폰 3-5 띠 가독성)는 이 계획 뒤에 따로 쓴다. **공개 전환(`LAUNCHED = true`)은 이 계획에 넣지 않는다** — 스펙 §14(이력서 PDF, 일본어 검수, 공개용 항공권 저장소)가 끝난 뒤 사용자가 정한다.

## Global Constraints

- 색·글꼴·이징은 기존 규칙 그대로(`--bg #070B16`, `--bg2 #13203A`, `--dot #8FB8FF`, `--tx #EEF3FF`, `--amb #FFB547`, `--ease`). 새 색을 만들지 않는다
- 용량 목표(gzip): 초기 JS ≤ 150KB(세 언어 페이지 각각, `noModule` 스크립트 제외), 3D 지연 청크 ≤ 250KB(256,000B), `terrain` ≤ 300KB, `demo` ≤ 500KB, `band` ≤ 50KB. **목표를 넘으면 한도를 올리지 말고 원인을 찾아 줄인다**(못 줄이면 멈추고 보고)
- 클라이언트 컴포넌트(`'use client'`)는 `src/lib/content.ts`, `src/lib/facts.ts`, `zod`에 정적 import로 닿으면 안 된다(`import type`과 `import()` 지연 로딩은 괜찮다)
- 문구에 숫자 직접 기입 금지(3개 언어, content.test가 강제). 데모 실행 중 값은 `{v.…}`, `SAMPLE_VALUES`에 이름을 추가
- 데이터 공개 원칙(§11.4)과 이메일 비공개(HTML 소스에 평문 주소 금지)를 지킨다
- **코드에 한국어 주석**: 파일 머리에 역할 한두 줄, 이유가 안 보이는 로직에 "왜". 코드를 그대로 옮겨 적는 주석은 쓰지 않는다
- 커밋 작성자 noreply(`55799748+hyde0395@users.noreply.github.com`), 커밋 메시지 끝에 Co-Authored-By 한 줄. main에 직접 push하지 않고 브랜치 → PR → CI → 사용자 확인 후 병합
- 사용자와의 대화는 한국어

## Review Focus

1. **초기 JS 150KB**: 세 언어 페이지 모두 → Task 2 `npm run size`(CI에서도)
2. **서버 전용 모듈이 다시 클라이언트로 새지 않음** → Task 1 import 경계 단위 테스트
3. **띠 데이터 실패가 3D 전체를 끄지 않음** → Task 3 단위 테스트
4. **스크린리더 사용자**: 한국어·일본어 페이지에서 추천이 그 언어로 읽힘 → Task 4 e2e
5. **공유 미리보기**: 언어별 `og:image`가 실제 파일을 가리킴 → Task 6 단위 테스트 + e2e

---

## File Structure

```
src/three/figureKeys.ts            (신규) 대체 이미지 장면 이름(가벼운 상수 모듈)
src/three/capability.ts            FIGURE_KEYS를 figureKeys에서
src/components/sections/ChapterFigure.tsx   figureKeys 다시 내보내기
tests/unit/client-imports.test.ts  (신규) 클라이언트 import 경계
scripts/size-budget.mjs            (신규) 용량 계산 순수 함수
scripts/check-size.mjs             (신규) npm run size
tests/unit/size-budget.test.ts     (신규)
.github/workflows/ci.yml           build 뒤 npm run size
src/three/data.ts, TerrainScene.tsx   band 선택 사항
content/{ko,en,ja}.json            demo.badges, demo 날짜 자리표시 {v.day}
src/demo/strip.ts                  dayFormat
src/demo/reason.ts                 SAMPLE_VALUES.day
src/components/demo/{DemoApp,DateStrip,DemoResult}.tsx   낭독 배지, 날짜 형식
src/components/RootDocument.tsx    <Analytics />
src/components/Header.tsx          이력서 다운로드 이벤트 자리(주석·data 속성)
scripts/capture-og.mjs             (신규) public/og/{ko,en,ja}.jpg
public/og/{ko,en,ja}.jpg           (신규, 커밋)
src/lib/site.ts                    openGraph·twitter 메타데이터
scripts/lighthouse.mjs             (신규) npm run lighthouse (CI 밖, 측정 기록용)
tests/unit/site.test.ts, tests/e2e/demo.spec.ts, tests/e2e/site.spec.ts   수정
README.md, CLAUDE.md, 스펙 §8.2·§12   문서
```

---

### Task 1: 초기 JS에서 문구·facts·zod 떼어 내기

**Files:**
- Create: `src/three/figureKeys.ts`, `tests/unit/client-imports.test.ts`
- Modify: `src/three/capability.ts`, `src/components/sections/ChapterFigure.tsx`

- [ ] **Step 1: 브랜치**

```bash
cd "$(git rev-parse --show-toplevel)"
git switch main && git pull --ff-only && git switch -c plan-4-1-performance
git config user.email   # 기대: 55799748+hyde0395@users.noreply.github.com
```

- [ ] **Step 2: 실패하는 테스트 작성** — `tests/unit/client-imports.test.ts`

```ts
// 클라이언트 번들 경계 검사: 'use client' 파일에서 정적 import로 닿는 모든 모듈을 따라가, 서버 전용 모듈
// (lib/content: 세 언어 사전, lib/facts: 수치 + zod)이나 zod가 초기 JS에 끌려오지 않는지 확인한다.
// import type과 import()(지연 로딩)는 초기 청크를 늘리지 않으므로 따라가지 않는다.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = fileURLToPath(new URL('../../src', import.meta.url));
const FORBIDDEN_FILES = ['lib/content.ts', 'lib/facts.ts'].map((f) => join(SRC, f));
const FORBIDDEN_PACKAGES = ['zod'];
// `import type …`는 빼고, `import x from '…'`·`import '…'`·`export … from '…'`의 경로를 잡는다(여러 줄 import 포함)
const STATIC_IMPORT = /^\s*(?:import|export)\s+(?!type\s)(?:[^'";]*?\sfrom\s+)?['"]([^'"]+)['"]/gm;

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

function resolveImport(from: string, spec: string): string {
  const base = spec.startsWith('@/') ? join(SRC, spec.slice(2)) : spec.startsWith('.') ? resolve(dirname(from), spec) : null;
  if (base === null) return `pkg:${spec.split('/')[0]}`;
  for (const ext of ['', '.ts', '.tsx', '/index.ts', '/index.tsx']) {
    if (existsSync(base + ext) && statSync(base + ext).isFile()) return base + ext;
  }
  return `missing:${spec}`;
}

// 진입 파일에서 정적 import로 닿는 파일·패키지 전체와, 각 항목까지의 경로(실패 메시지용)
function reachable(entry: string): Map<string, string[]> {
  const seen = new Map<string, string[]>([[entry, [entry]]]);
  const queue = [entry];
  while (queue.length) {
    const file = queue.shift()!;
    if (!/\.(ts|tsx)$/.test(file)) continue; // css 등은 따라가지 않는다
    for (const m of readFileSync(file, 'utf8').matchAll(STATIC_IMPORT)) {
      const target = resolveImport(file, m[1]);
      if (seen.has(target)) continue;
      seen.set(target, [...seen.get(file)!, target]);
      if (!target.startsWith('pkg:') && !target.startsWith('missing:')) queue.push(target);
    }
  }
  return seen;
}

const clientFiles = walk(SRC).filter((f) => /\.tsx?$/.test(f) && /^\s*['"]use client['"]/.test(readFileSync(f, 'utf8')));
const rel = (p: string) => (p.startsWith('pkg:') ? p : relative(SRC, p));

describe('클라이언트 import 경계', () => {
  it('클라이언트 파일이 있다', () => expect(clientFiles.length).toBeGreaterThan(3));

  it.each(clientFiles.map((f) => [relative(SRC, f), f]))('%s는 서버 전용 모듈·zod에 닿지 않는다', (_, file) => {
    const graph = reachable(file);
    for (const bad of [...FORBIDDEN_FILES, ...FORBIDDEN_PACKAGES.map((p) => `pkg:${p}`)]) {
      const path = graph.get(bad);
      expect(path, path && path.map(rel).join(' → ')).toBeUndefined();
    }
  });
});
```

- [ ] **Step 3: 실패 확인**

Run: `npx vitest run tests/unit/client-imports.test.ts`
Expected: `components/Backdrop.tsx` 한 건이 FAIL. 메시지에 `components/Backdrop.tsx → three/capability.ts → components/sections/ChapterFigure.tsx → lib/content.ts` 경로. 다른 파일도 실패하면 경로를 보고 원인을 기록한다(이 Task에서 함께 끊는다).

- [ ] **Step 4: 상수 모듈 분리**

`src/three/figureKeys.ts`:

```ts
// 3D 대체 이미지가 있는 장면 이름. 3D 판별 코드(capability.ts, 초기 JS)와 대체 이미지 컴포넌트(ChapterFigure, 서버)가
// 함께 쓴다. ChapterFigure에서 가져오면 그 파일이 부르는 문구 모듈(세 언어 사전·facts·zod)까지 초기 JS에 딸려 오므로 따로 둔다.
export const FIGURE_KEYS = ['hero', 'problem', 'insight', 'bubble', 'interval'] as const;
export type FigureKey = (typeof FIGURE_KEYS)[number];
```

`src/components/sections/ChapterFigure.tsx`에서 두 줄

```ts
export const FIGURE_KEYS = ['hero', 'problem', 'insight', 'bubble', 'interval'] as const;
export type FigureKey = (typeof FIGURE_KEYS)[number];
```

을 아래로 바꾼다(CaseStudy·Hero의 import는 그대로 둔다).

```ts
import type { FigureKey } from '@/three/figureKeys';
export { FIGURE_KEYS, type FigureKey } from '@/three/figureKeys';
```

`src/three/capability.ts`의 `import { FIGURE_KEYS, type FigureKey } from '@/components/sections/ChapterFigure';` → `import { FIGURE_KEYS, type FigureKey } from './figureKeys';`

- [ ] **Step 5: 통과 확인**

Run: `npx vitest run tests/unit/client-imports.test.ts && npm run typecheck && npm test`
Expected: 모두 PASS

- [ ] **Step 6: 빌드해서 초기 JS 재기**

```bash
npm run build
for f in out/index.html out/en/index.html out/ja/index.html; do
  grep -oE '<script[^>]*src="/_next/static/chunks/[^"]+\.js"[^>]*>' "$f" | grep -v noModule | grep -oE '/_next/static/chunks/[^"]+\.js' | sort -u \
  | while read c; do gzip -c "out$c" | wc -c; done | awk -v f="$f" '{t+=$1} END {printf "%s 초기 JS gzip %.1fKB\n", f, t/1024}'
done
grep -l ZodError out/_next/static/chunks/*.js
```

Expected: 세 페이지 모두 약 150KB 안팎(전에는 약 237KB). `ZodError`가 든 청크는 3D 지연 청크와 데모 데이터 청크뿐이어야 한다(초기 HTML에 없는 파일). 150KB를 넘으면 Task 2의 스크립트가 잡는다 — 여기서는 숫자만 기록한다.

- [ ] **Step 7: 커밋**

```bash
git add src/three/figureKeys.ts src/three/capability.ts src/components/sections/ChapterFigure.tsx tests/unit/client-imports.test.ts docs/superpowers/plans/2026-09-24-plan-4-1-performance.md
git commit -m "perf: keep dictionaries, facts and zod out of the initial client bundle"
```

---

### Task 2: 용량 검사 스크립트와 CI

**Files:**
- Create: `scripts/size-budget.mjs`, `scripts/check-size.mjs`, `tests/unit/size-budget.test.ts`
- Modify: `package.json`(scripts), `.github/workflows/ci.yml`

- [ ] **Step 1: 실패하는 테스트** — `tests/unit/size-budget.test.ts`

```ts
// 용량 검사의 순수 함수: 초기 HTML에서 스크립트 고르기(noModule 제외, 중복 제거)와 한도 판정.
import { describe, expect, it } from 'vitest';
import { BUDGET, check, initialScripts } from '../../scripts/size-budget.mjs';

describe('initialScripts', () => {
  it('noModule 폴리필은 빼고, 같은 파일은 한 번만', () => {
    const html = '<script src="/_next/a.js" async=""></script><script src="/_next/b.js" noModule=""></script><script src="/_next/a.js"></script><link href="/x.css">';
    expect(initialScripts(html)).toEqual(['/_next/a.js']);
  });
});

describe('check', () => {
  it('한도 이하는 ok, 넘으면 ok가 아니다', () => {
    const r = check([{ name: 'a', bytes: 100, limit: 100 }, { name: 'b', bytes: 101, limit: 100 }]);
    expect(r.map((x: { ok: boolean }) => x.ok)).toEqual([true, false]);
  });
  it('스펙 §8.2 목표', () => {
    expect(BUDGET).toEqual({ initialJs: 150 * 1024, threeChunk: 256_000, terrain: 300 * 1024, demo: 500 * 1024, band: 50 * 1024 });
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/unit/size-budget.test.ts`
Expected: FAIL (모듈 없음)

- [ ] **Step 3: `scripts/size-budget.mjs`**

```js
// 빌드 산출물(out/)의 gzip 용량을 스펙 §8.2 목표와 비교하는 순수 함수들. check-size.mjs가 파일을 읽어 넘기고, 단위 테스트가 직접 부른다.
import { gzipSync } from 'node:zlib';

// threeChunk: 스펙 "약 250KB"를 250,000B가 아니라 256,000B로 둔다(실측 244,928B가 목표 안이라는 계획 3 기록과 맞춤)
export const BUDGET = { initialJs: 150 * 1024, threeChunk: 256_000, terrain: 300 * 1024, demo: 500 * 1024, band: 50 * 1024 };

// 초기 HTML의 <script src>. noModule(옛 브라우저 전용 폴리필)은 요즘 브라우저가 받지 않으므로 초기 JS에서 뺀다
export function initialScripts(html) {
  const out = new Set();
  for (const m of html.matchAll(/<script\b[^>]*\bsrc="([^"]+\.js)"[^>]*>/g)) {
    if (!/\bnomodule\b/i.test(m[0])) out.add(m[1]);
  }
  return [...out];
}

export const gz = (buf) => gzipSync(buf).length;

export function check(items) {
  return items.map((i) => ({ ...i, ok: i.bytes <= i.limit }));
}
```

- [ ] **Step 4: `scripts/check-size.mjs`**

```js
// npm run size: out/의 초기 JS(세 언어 페이지 각각), 3D 지연 청크, 데이터 JSON의 gzip 용량이 목표 안인지 확인한다.
// 하나라도 넘으면 exit 1(CI 실패). npm run build 뒤에 돌린다.
import { readdirSync, readFileSync } from 'node:fs';
import { BUDGET, check, gz, initialScripts } from './size-budget.mjs';

const v = JSON.parse(readFileSync('data/facts.json', 'utf8')).dataVersion;
const items = [];

for (const page of ['out/index.html', 'out/en/index.html', 'out/ja/index.html']) {
  const bytes = initialScripts(readFileSync(page, 'utf8')).reduce((sum, src) => sum + gz(readFileSync(`out${src}`)), 0);
  items.push({ name: `초기 JS ${page}`, bytes, limit: BUDGET.initialJs });
}

const dir = 'out/_next/static/chunks';
const three = readdirSync(dir).filter((f) => f.endsWith('.js') && readFileSync(`${dir}/${f}`, 'utf8').includes('WebGLRenderer'));
if (three.length === 0) throw new Error('3D 청크(WebGLRenderer)를 찾지 못했다 — npm run build를 먼저 돌린다');
for (const f of three) items.push({ name: `3D 청크 ${f}`, bytes: gz(readFileSync(`${dir}/${f}`)), limit: BUDGET.threeChunk });

for (const [key, file] of [['terrain', `terrain.${v}.json`], ['demo', `demo.${v}.json`], ['band', `band.${v}.json`]]) {
  items.push({ name: `데이터 ${file}`, bytes: gz(readFileSync(`out/data/${file}`)), limit: BUDGET[key] });
}

const results = check(items);
for (const r of results) {
  console.log(`${r.ok ? 'OK  ' : 'OVER'} ${(r.bytes / 1024).toFixed(1).padStart(7)}KB / ${(r.limit / 1024).toFixed(0)}KB  ${r.name}`);
}
if (results.some((r) => !r.ok)) process.exit(1);
```

`package.json` scripts에 추가: `"size": "node scripts/check-size.mjs",`

- [ ] **Step 5: 통과 확인**

Run: `npx vitest run tests/unit/size-budget.test.ts && npm run typecheck`
Expected: PASS

Run: `npm run build && npm run size`
Expected: 모든 줄이 `OK`. **초기 JS가 `OVER`면 한도를 올리지 않는다.** `grep -l`로 초기 청크마다 무엇이 들었는지(예: `ZodError`, 사전 문장 `"예측 구간 보정"`) 확인하고, Task 1의 경계 테스트가 못 잡은 경로가 있으면 같은 방식으로 끊는다. 프레임워크(react-dom, next 런타임)만으로 넘는다면 멈추고 숫자를 보고한다.

- [ ] **Step 6: CI에 넣기** — `.github/workflows/ci.yml`의 `- run: npm run build` 다음 줄에 추가:

```yaml
      - run: npm run size
```

- [ ] **Step 7: 커밋**

```bash
git add scripts/size-budget.mjs scripts/check-size.mjs tests/unit/size-budget.test.ts package.json .github/workflows/ci.yml
git commit -m "ci: gzip size budget for initial JS, 3D chunk and data files"
```

---

### Task 3: 띠 데이터를 못 받아도 지형은 그린다

**Files:**
- Modify: `src/three/data.ts`(`loadSceneData`), `src/three/TerrainScene.tsx`
- Test: `tests/unit/three-data.test.ts`

- [ ] **Step 1: 실패하는 테스트** — `tests/unit/three-data.test.ts`의 `describe('loadSceneData', …)` 안에 추가:

```ts
  it('띠(band)만 못 받으면 지형은 살리고 band는 undefined', async () => {
    const fetcher = vi.fn((url: string) =>
      url.includes('band') ? Promise.resolve(new Response('no', { status: 404 })) : ok(url.includes('terrain') ? terrain : map));
    const data = await loadSceneData('2026-09-22', fetcher as unknown as typeof fetch);
    expect(data.terrain.dates).toHaveLength(3);
    expect(data.band).toBeUndefined();
  });
  it('띠 형식이 틀려도 band만 undefined', async () => {
    const fetcher = vi.fn((url: string) => ok(url.includes('band') ? { nope: true } : url.includes('terrain') ? terrain : map));
    expect((await loadSceneData('2026-09-22', fetcher as unknown as typeof fetch)).band).toBeUndefined();
  });
```

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run tests/unit/three-data.test.ts` / Expected: 새 두 테스트 FAIL(reject)

- [ ] **Step 3: 구현** — `src/three/data.ts`의 `loadSceneData`에서 band 받기를 바꾼다:

```ts
  const [terrain, map, band] = await Promise.all([
    get(`/data/terrain.${dataVersion}.json`),
    get('/data/map.v1.json'),
    // 띠는 3-5 장면에 얹는 덧붙임이라, 못 받거나 형식이 틀려도 3D 전체를 대체 이미지로 바꾸지 않고 띠만 뺀다
    get(`/data/band.${dataVersion}.json`)
      .then((b) => bandSchema.parse(b))
      .catch((e: unknown) => {
        console.warn('예측 구간 띠 없이 그린다', e);
        return undefined;
      }),
  ]);
  return { terrain: terrainSchema.parse(terrain), map: mapSchema.parse(map), band };
```

`src/three/TerrainScene.tsx`: `useState<{ terrain: Terrain; map: MapData; band: Band } | null>` → `useState<{ terrain: Terrain; map: MapData; band?: Band } | null>`

- [ ] **Step 4: 통과 확인** — Run: `npx vitest run tests/unit/three-data.test.ts && npm run typecheck` / Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/three/data.ts src/three/TerrainScene.tsx tests/unit/three-data.test.ts
git commit -m "fix: missing interval band no longer disables the whole 3D scene"
```

---

### Task 4: 데모 — 추천을 언어별로 낭독, 해를 넘기는 날짜

**Files:**
- Modify: `content/{ko,en,ja}.json`, `src/demo/strip.ts`, `src/demo/reason.ts`, `src/components/demo/{DemoApp,DateStrip,DemoResult}.tsx`
- Test: `tests/unit/demo-strip.test.ts`, `tests/e2e/demo.spec.ts`

**배경:** 배지는 세 언어 공통 영어(`BUY NOW`)라 한국어·일본어 스크린리더 사용자에게 영어로 읽힌다. 눈에 보이는 배지는 그대로 두고, 낭독용 글자를 따로 둔다. 또 데모 날짜는 월·일만 쓰는데(`md`), 기준일이 10월 이후면 D+90이 다음 해로 넘어가 날짜가 모호해진다 — 출발일 범위가 해를 넘기면 연도까지 쓴다.

- [ ] **Step 1: 실패하는 테스트** — `tests/unit/demo-strip.test.ts` 끝에 추가(파일 위 import에 `dayFormat` 추가):

```ts
describe('dayFormat', () => {
  it('같은 해 안이면 월·일(md), 해를 넘기면 연도까지(date)', () => {
    expect(dayFormat(['2026-09-25', '2026-12-21'])).toBe('md');
    expect(dayFormat(['2026-11-02', '2027-01-29'])).toBe('date');
    expect(dayFormat([])).toBe('md');
  });
});
```

Run: `npx vitest run tests/unit/demo-strip.test.ts` / Expected: FAIL (`dayFormat` 없음)

- [ ] **Step 2: `src/demo/strip.ts` 끝에 추가**

```ts
// 출발일 목록이 해를 넘기면(기준일이 10월 이후면 D+90이 다음 해) 월·일만으로는 어느 해인지 모호하므로 연도까지 쓴다
export function dayFormat(dates: string[]): 'md' | 'date' {
  return dates.length > 0 && dates[0].slice(0, 4) !== dates[dates.length - 1].slice(0, 4) ? 'date' : 'md';
}
```

Run: `npx vitest run tests/unit/demo-strip.test.ts` / Expected: PASS

- [ ] **Step 3: 문구** — 세 파일의 `demo` 블록에서 날짜 자리표시를 미리 형식을 맞춘 `{v.day}`로 바꾸고, 낭독용 배지를 추가한다(`demo.money` 다음에 `badges`).

| 키 | ko | en | ja |
|---|---|---|---|
| `strip.valuetext` | `{v.day}, 예측가 {v.price}원` | `{v.day}, predicted ₩{v.price}` | `{v.day}、予測価格 {v.price}ウォン` |
| `announce` | `{v.day} 출발, 예측가 {v.price}원, {v.action}.` | `Departing {v.day}, predicted ₩{v.price}, {v.action}.` | `{v.day}出発、予測価格 {v.price}ウォン、{v.action}。` |
| `badges.BUY_NOW` | `지금 구매` | `Buy now` | `今すぐ購入` |
| `badges.DROP_EXPECTED` | `가격 하락 예상` | `Price drop expected` | `値下がり予想` |
| `badges.WAIT` | `대기 추천` | `Wait` | `待つのがおすすめ` |

`src/demo/reason.ts`의 `SAMPLE_VALUES`에 `day: 'Sat, November 14',`를 `date` 다음 줄에 추가한다.

- [ ] **Step 4: 화면 코드**

`src/components/demo/DemoResult.tsx` — 배지 줄을 바꾼다:

```tsx
      {/* 보이는 배지는 세 언어 공통 영어, 스크린리더는 그 언어 낭독 문구를 읽는다 */}
      <p className={`badge is-${reco.action.toLowerCase()}`}>
        <span aria-hidden="true">{BADGE[reco.action]}</span>
        <span className="sr-only">{texts.badges[reco.action]}</span>
      </p>
```

`src/components/demo/DateStrip.tsx`:
- import에 `dayFormat` 추가: `import { barScale, dayFormat, edgeSelectable, indexFromX, nearestSelectable, stepSelectable } from '@/demo/strip';`
- 컴포넌트 안 `const cur = days[index];` 다음 줄에 `const fmt = dayFormat(days.map((d) => d.date));`
- `valuetext` 조립의 `{ v: { date: cur.date, price: cur.price } }` → `{ v: { day: formatValue(cur.date, fmt, locale), price: cur.price } }`
- 축 라벨 두 곳의 `formatValue(…, 'md', locale)` → `formatValue(…, fmt, locale)`

`src/components/demo/DemoApp.tsx`:
- import에서 `BADGE, ` 제거: `import { DemoResult } from './DemoResult';`, `dayFormat`을 strip import에 추가
- 알림: `action: BADGE[forecast.reco.action]` → `action: texts.badges[forecast.reco.action]`, `date: forecast.date` → `day: formatValue(forecast.date, dayFormat(days.map((d) => d.date)), locale)`
- 문장 속 날짜 칸: `formatValue(day.date, 'md', locale)` → `formatValue(day.date, dayFormat(days.map((d) => d.date)), locale)`

(`days`의 실제 변수 이름이 다르면 — Task 8 리뷰 수정으로 `strip.days`일 수 있다 — 그 이름을 쓴다.)

- [ ] **Step 5: e2e 선택자 수정** — `tests/e2e/demo.spec.ts`
- `page.locator('.demo-result .badge')` + `toHaveText('DROP EXPECTED')` → `page.locator('.demo-result .badge [aria-hidden="true"]')`
- 알림 테스트의 `toContainText(/BUY NOW|DROP EXPECTED|WAIT/)` → `toContainText(new RegExp(Object.values(ko.demo.badges).join('|')))`, 마지막 줄의 배지 텍스트 비교는 `.demo-result .badge .sr-only`의 텍스트로. `ko` 타입 선언에 `badges: Record<string, string>` 추가
- 새 테스트 추가:

```ts
test('/ja/: 추천 배지를 스크린리더가 일본어로 읽는다', async ({ page }) => {
  await openDemo(page, '/ja/');
  const ja = read('../../content/ja.json') as { demo: { badges: Record<string, string> } };
  await expect(page.locator('.demo-result .badge .sr-only')).toHaveText(ja.demo.badges.DROP_EXPECTED);
});
```

- [ ] **Step 6: 확인**

Run: `npm run typecheck && npm test && npm run build && npx playwright test tests/e2e/demo.spec.ts`
Expected: 모두 PASS

- [ ] **Step 7: 커밋**

```bash
git add content/ src/demo src/components/demo tests/unit/demo-strip.test.ts tests/e2e/demo.spec.ts
git commit -m "a11y: localized spoken recommendation; show year when demo dates cross a year"
```

---

### Task 5: Vercel Web Analytics와 이력서 다운로드 이벤트 자리

**Files:**
- Modify: `package.json`, `src/components/RootDocument.tsx`, `src/components/Header.tsx`

- [ ] **Step 1: 설치**

```bash
npm install @vercel/analytics@^2
```

`node_modules/@vercel/analytics/README.md`(또는 package의 `exports`)에서 Next.js App Router용 컴포넌트 import 경로를 확인한다(보통 `@vercel/analytics/next`의 `Analytics`). 아래 코드의 경로가 다르면 확인한 경로를 쓴다.

- [ ] **Step 2: `src/components/RootDocument.tsx`**

import 추가: `import { Analytics } from '@vercel/analytics/next';`

`{children}` 다음 줄에 추가:

```tsx
        {/* 방문 수·유입 경로(쿠키 없음, 스펙 §12). Vercel 대시보드에서 Web Analytics를 켜야 집계된다 */}
        <Analytics />
```

- [ ] **Step 3: 이력서 다운로드 이벤트 자리** — `src/components/Header.tsx`의 `ResumeLink` 위 주석 끝에 두 줄을 더하고, `<a>`에 `data-event` 속성을 단다:

```tsx
// 다운로드 수 집계는 Vercel 유료 요금제의 custom event가 필요해 지금은 넣지 않는다(스펙 §12). 요금제를 올리면 이 링크를
// 클라이언트 컴포넌트로 감싸 onClick에서 track('resume_download', { locale }) 한 줄(@vercel/analytics)을 부르면 된다.
export function ResumeLink(…) {
  return href
    ? <a className={className} href={href} download={`CHOI_HALIM_resume_${locale}.pdf`} data-event="resume_download">{label}</a>
    : …;
}
```

(`…`은 기존 코드 그대로.)

- [ ] **Step 4: 확인**

Run: `npm run typecheck && npm test && npm run build && npm run size`
Expected: 모두 PASS, 초기 JS가 여전히 150KB 안(Analytics는 수 KB)

- [ ] **Step 5: 커밋**

```bash
git add package.json package-lock.json src/components/RootDocument.tsx src/components/Header.tsx
git commit -m "feat: Vercel Web Analytics; mark resume download for a future event"
```

---

### Task 6: 언어별 링크 미리보기(OG) 이미지

**Files:**
- Create: `scripts/capture-og.mjs`, `public/og/{ko,en,ja}.jpg`
- Modify: `package.json`, `src/lib/site.ts`
- Test: `tests/unit/site.test.ts`, `tests/e2e/site.spec.ts`

**방식:** 스펙 §12는 "빌드할 때 생성"이지만, 한국어·일본어 이름을 그리려면 CJK 글꼴 파일을 저장소에 넣어야 한다. 대신 대체 이미지(`capture-fallbacks.mjs`)처럼 실제 3D 첫 화면을 캡처 모드로 열고, 사이트 자체 글꼴로 이름을 얹어 찍어 커밋한다. 재학습·문구 변경 뒤 `npm run build && npm run og`로 다시 만든다.

- [ ] **Step 1: 실패하는 테스트** — `tests/unit/site.test.ts`에 추가(`existsSync` import 필요: `import { existsSync } from 'node:fs';`):

```ts
  it('언어별 링크 미리보기 이미지(1200×630)와 트위터 카드', () => {
    for (const locale of ['ko', 'en', 'ja'] as const) {
      const m = buildMetadata(locale);
      const images = m.openGraph?.images as { url: string; width: number; height: number }[];
      expect(images[0]).toMatchObject({ url: `/og/${locale}.jpg`, width: 1200, height: 630 });
      expect(existsSync(`public/og/${locale}.jpg`)).toBe(true);
      expect((m.twitter as { card: string }).card).toBe('summary_large_image');
    }
  });
```

Run: `npx vitest run tests/unit/site.test.ts` / Expected: FAIL

- [ ] **Step 2: `src/lib/site.ts`** — `buildMetadata`의 return 객체에서 `description: t('meta.description'),` 다음에 추가하고, 파일 위에 상수를 둔다:

```ts
const OG_LOCALE: Record<Locale, string> = { ko: 'ko_KR', en: 'en_US', ja: 'ja_JP' };
```

```ts
    // 링크 미리보기: scripts/capture-og.mjs가 3D 첫 화면에 이름을 얹어 만든 언어별 이미지(스펙 §12)
    openGraph: {
      type: 'website',
      siteName: 'SIGNAL',
      locale: OG_LOCALE[locale],
      url: LOCALE_PATH[locale],
      title: t('meta.title'),
      description: t('meta.description'),
      images: [{ url: `/og/${locale}.jpg`, width: 1200, height: 630, alt: t('meta.title') }],
    },
    twitter: { card: 'summary_large_image', title: t('meta.title'), description: t('meta.description'), images: [`/og/${locale}.jpg`] },
```

- [ ] **Step 3: `scripts/capture-og.mjs`**

```js
// 링크 미리보기(OG) 이미지 생성: 실제 3D 첫 화면을 캡처 모드로 열고, 사이트 글꼴로 이름·역할을 얹어 1200×630으로 찍는다.
// CJK 글꼴 파일을 따로 넣지 않으려고 빌드 시 생성(next/og) 대신 이 방식을 쓴다. 실행 전 npm run build가 필요하다.
import { spawn } from 'node:child_process';
import { mkdir, readFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import sharp from 'sharp';

const PAGES = [['ko', '/'], ['en', '/en/'], ['ja', '/ja/']];
const PORT = 4176; // e2e(4173)·대체 이미지(4174)와 겹치지 않게
const server = spawn('npx', ['serve', 'out', '-l', String(PORT), '--no-clipboard'], { stdio: 'ignore' });

async function waitForServer(url, timeoutMs = 15_000) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    try { if ((await fetch(url)).status === 200) return; } catch { /* 아직 안 떴음 */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`${url}이(가) 응답하지 않았다`);
}

let browser;
try {
  await waitForServer(`http://localhost:${PORT}/`);
  browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await mkdir('public/og', { recursive: true });
  for (const [locale, path] of PAGES) {
    const content = JSON.parse(await readFile(`content/${locale}.json`, 'utf8'));
    await page.goto(`http://localhost:${PORT}${path}?capture=hero`);
    await page.waitForFunction(() => window.__sceneReady === true, null, { timeout: 30_000 });
    await page.evaluate(({ sub, role }) => {
      // 본문·헤더·언어 안내를 숨기고 캔버스만 남긴 뒤, 왼쪽 아래에 이름 카드를 얹는다(사이트 글꼴 클래스 재사용)
      for (const sel of ['main', '.site-header', '.lang-hint', '.skip']) document.querySelectorAll(sel).forEach((el) => { el.style.visibility = 'hidden'; });
      const card = document.createElement('div');
      card.style.cssText = 'position:fixed;left:72px;bottom:64px;z-index:10;padding:28px 32px;border-radius:16px;background:rgba(7,11,22,.82);box-shadow:0 0 64px 32px rgba(7,11,22,.82)';
      const line = (text, cls, css) => { const p = document.createElement('p'); p.className = cls; p.textContent = text; p.style.cssText = css; card.append(p); };
      line('CHOI HALIM', 'display', 'font-size:104px;color:#EEF3FF');
      if (sub) line(sub, '', 'margin-top:10px;font-size:30px;color:rgba(238,243,255,.72)');
      line(role, 'mono', 'margin-top:22px;font-size:26px;letter-spacing:.18em;color:#FFB547');
      document.body.append(card);
    }, { sub: content.hero.nameSub, role: content.hero.role });
    await page.evaluate(() => document.fonts.ready);
    const png = await page.screenshot({ type: 'png' });
    await sharp(png).jpeg({ quality: 84, mozjpeg: true }).toFile(`public/og/${locale}.jpg`);
    console.log(`og/${locale}.jpg`);
  }
} finally {
  await browser?.close();
  server.kill();
}
```

`package.json` scripts에 추가: `"og": "node scripts/capture-og.mjs",`

- [ ] **Step 4: 만들고 눈으로 확인**

```bash
npm run build && npm run og
ls -l public/og
```

Expected: `ko.jpg`, `en.jpg`, `ja.jpg` 각각 300KB 이하. 세 장을 Read 도구로 열어 본다: 3D 지형 위 왼쪽 아래에 `CHOI HALIM`(제목 글꼴), ko는 `최하림`, ja는 `崔夏林（チェ・ハリム）`, en은 보조 표기 없음, 호박색 `ML ENGINEER`. 글자가 잘리거나 네모(글꼴 없음)로 나오면 원인을 고치고 다시 만든다.

- [ ] **Step 5: e2e** — `tests/e2e/site.spec.ts`의 `for (const { path, lang } of PAGES)` 첫 테스트(`lang 속성과 핵심 섹션`) 끝에 추가:

```ts
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', new RegExp(`/og/${lang}\\.jpg$`));
```

- [ ] **Step 6: 확인**

Run: `npm run typecheck && npm test && npm run build && npx playwright test tests/e2e/site.spec.ts`
Expected: PASS

- [ ] **Step 7: 커밋**

```bash
git add scripts/capture-og.mjs public/og package.json src/lib/site.ts tests/unit/site.test.ts tests/e2e/site.spec.ts
git commit -m "feat: per-language link preview images captured from the 3D hero"
```

---

### Task 7: Lighthouse 측정(기록용, CI 밖)

**Files:**
- Create: `scripts/lighthouse.mjs`
- Modify: `package.json`

스펙 §13은 Lighthouse를 "공개 전 수동 점검"으로 둔다. CI에 넣지 않고, 로컬에서 같은 조건으로 잴 수 있는 스크립트만 만든다. 결과는 Task 8에서 문서에 적는다. **여기서 성능을 고치지 않는다** — 점수가 낮으면 원인 상위 3개를 계획 4-2의 할 일로 넘긴다.

- [ ] **Step 1: `scripts/lighthouse.mjs`**

```js
// npm run lighthouse: 빌드 산출물(out/)을 띄워 세 언어 첫 화면을 Lighthouse(모바일 기본 설정)로 재고 점수·핵심 지표를 출력한다.
// 기록용이라 CI에서는 돌리지 않는다. 브라우저는 Playwright가 설치한 Chromium을 쓴다. 실행 전 npm run build가 필요하다.
import { execFileSync, spawn } from 'node:child_process';
import { mkdir, readFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const PORT = 4177;
const server = spawn('npx', ['serve', 'out', '-l', String(PORT), '--no-clipboard'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 2500));
await mkdir('.lighthouse', { recursive: true });
try {
  for (const [locale, path] of [['ko', '/'], ['en', '/en/'], ['ja', '/ja/']]) {
    const out = `.lighthouse/${locale}.json`;
    execFileSync('npx', ['-y', 'lighthouse@13', `http://localhost:${PORT}${path}`, '--quiet', '--output=json', `--output-path=${out}`,
      `--chrome-path=${chromium.executablePath()}`, '--chrome-flags=--headless=new', '--only-categories=performance,accessibility,best-practices,seo'], { stdio: 'inherit' });
    const r = JSON.parse(await readFile(out, 'utf8'));
    const score = (k) => Math.round(r.categories[k].score * 100);
    const a = r.audits;
    console.log(`${locale}: 성능 ${score('performance')} · 접근성 ${score('accessibility')} · 권장사항 ${score('best-practices')} · SEO ${score('seo')}`
      + ` | LCP ${a['largest-contentful-paint'].displayValue} · CLS ${a['cumulative-layout-shift'].displayValue} · TBT ${a['total-blocking-time'].displayValue}`);
  }
} finally {
  server.kill();
}
```

`package.json` scripts에 `"lighthouse": "node scripts/lighthouse.mjs",`를 추가하고, `.gitignore`에 `.lighthouse/`를 추가한다.

- [ ] **Step 2: 측정**

```bash
npm run build && npm run lighthouse
```

Expected: 세 줄의 점수. SEO는 공개 전 `noindex` 때문에 낮게 나오는 것이 정상이다(공개 전환 때 오른다). 성능이 90 미만이면 `.lighthouse/ko.json`의 `audits` 중 `score < 0.9`이고 절약량이 큰 항목 3개(예: `unused-javascript`, `largest-contentful-paint-element`, `render-blocking-resources`)의 제목과 수치를 기록해 둔다(Task 8에서 CLAUDE.md로 옮긴다).

- [ ] **Step 3: 커밋**

```bash
git add scripts/lighthouse.mjs package.json .gitignore
git commit -m "chore: local Lighthouse measurement script"
```

---

### Task 8: 문서 갱신, 전체 검증, PR

**Files:**
- Modify: `README.md`, `CLAUDE.md`, `docs/superpowers/specs/2026-09-23-portfolio-design.md`

- [ ] **Step 1: README** — 스크립트 목록에 추가:

```
npm run size       # 빌드 산출물 gzip 용량 검사(초기 JS ≤150KB 등, CI에서도 실행)
npm run og         # 언어별 링크 미리보기 이미지 캡처(public/og, npm run build 이후)
npm run lighthouse # Lighthouse 측정(기록용, CI 밖)
```

재학습 후 업데이트 순서 끝에 `→ npm run og`를 `npm run fallbacks` 다음에 넣는다.

- [ ] **Step 2: 스펙**
- §8.2 표 아래에 추가: `**측정 (계획 4-1, <날짜>)**: 초기 JS gzip ko <x>KB · en <x>KB · ja <x>KB(npm run size), Lighthouse 모바일(로컬) 성능 <n> · 접근성 <n> · LCP <s> · CLS <n>` — `<…>`는 Task 2·7 실측값으로 채운다
- §12 링크 미리보기 항목의 "빌드할 때 생성합니다." → "`scripts/capture-og.mjs`로 실제 3D 첫 화면에 이름을 얹어 캡처하고 커밋합니다(CJK 글꼴 파일을 넣지 않기 위해 빌드 시 생성 대신)."

- [ ] **Step 3: CLAUDE.md**
- 진행 상태 표에서 `| 계획 4: 연출·마감 | ⏳ 예정 |` → 두 줄로: `| 계획 4-1: 성능·공유·마감 | ✅ 구현 2026-09-24 · branch \`plan-4-1-performance\` · PR 병합 대기 |` / `| 계획 4-2: 연출 | ⏳ 다음 |`
- "다음 세션 할 일" 4번 목록에서 이 계획이 끝낸 항목(zod 경로, 용량 검사 스크립트, OG, Web Analytics, band 실패 처리, 배지 낭독, 날짜 연도)에 `✅ (계획 4-1)`을 붙인다. 남은 것(로딩 화면, 플립 글자판, 텍스트 리빌, GSAP+Lenis, 휴대폰 3-5 띠, Lighthouse 개선 항목, 공개 전환)은 "계획 4-2" 제목 아래로 모은다. Task 7에서 기록한 Lighthouse 개선 항목 3개를 여기에 적는다
- 할 일 5번(공개 전)에 한 줄 추가: `Vercel 대시보드 → 프로젝트 → Analytics에서 Web Analytics 켜기(사용자 작업)`

- [ ] **Step 4: 전체 검증** (`superpowers:verification-before-completion`)

```bash
npm run typecheck && npm test && npm run pytest && npm run build && npm run size && npm run e2e
```

Expected: 모두 성공. 하나라도 실패하면 고치고 처음부터 다시.

- [ ] **Step 5: 커밋과 PR**

```bash
git add README.md CLAUDE.md docs/superpowers/specs/2026-09-23-portfolio-design.md
git commit -m "docs: record plan 4-1 results and hand off plan 4-2"
git push -u origin plan-4-1-performance
gh pr create --base main --head plan-4-1-performance --title "Plan 4-1: performance, sharing, polish" --body "$(cat <<'EOF'
## 요약
- 초기 JS에서 세 언어 사전·facts·zod 떼어 냄(3D 판별 코드의 import 경로), 클라이언트 import 경계 테스트
- npm run size: 초기 JS ≤150KB, 3D 청크, 데이터 JSON gzip 검사를 CI에 추가
- 예측 구간 띠를 못 받아도 지형은 그림
- 데모 추천을 언어별로 낭독, 해를 넘기는 출발일에 연도 표기
- Vercel Web Analytics, 이력서 다운로드 이벤트 자리
- 언어별 링크 미리보기 이미지(3D 첫 화면 캡처)
- Lighthouse 측정 스크립트(기록용)

## 확인
- typecheck, vitest, pytest, build, size, Playwright(desktop·mobile, axe) 통과

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

CI를 `gh pr checks`로 확인한다(통과까지). **main 병합은 사용자에게 묻고 한다.**
