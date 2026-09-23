# SIGNAL 계획 1/4 — 기반과 읽을 수 있는 사이트 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 3D·데모·연출 없이도 모든 내용을 3개 언어(ko/en/ja)로 읽을 수 있는 정적 사이트를 만들고, 수치·문구 관리 체계와 CI까지 갖춰 Vercel에 올린다.

**Architecture:** Next.js App Router 정적 export. 언어별 root layout(route group `(ko)`, `(en)`, `(ja)`)이 공통 `HomePage` 서버 컴포넌트를 렌더링한다. 수치는 `data/facts.json`(빌드 시 import, 공개 URL 없음) 한 곳, 문장은 `content/{ko,en,ja}.json`에 두고 `{facts.path|format}` 자리표시로 연결한다. `facts.json`의 `data`·`model` 영역은 Python 스크립트가 항공권 저장소에서 다시 만든다.

**Tech Stack:** Next.js 16.3, React 19, TypeScript, zod 4, Vitest 5, Playwright 1.63 + @axe-core/playwright, Python 3.11(항공권 저장소 `.venv`, pandas, pytest), GitHub Actions, Vercel.

**Spec:** `docs/superpowers/specs/2026-09-23-portfolio-design.md`

### 전체 로드맵 (이 문서는 1/4)

스펙이 서로 독립적인 하위 시스템 여러 개를 담고 있어 계획을 넷으로 나눈다. 각 계획은 끝나면 그 자체로 동작하고 배포 가능한 사이트를 남긴다. 2~4는 앞 계획이 끝난 뒤, 실제 코드 구조를 보고 작성한다.

| 계획 | 범위 (스펙 절) | 끝나면 |
|---|---|---|
| **1. 기반 (이 문서)** | §2, §3(텍스트), §7, §10, §11, §12(메타·sitemap), §13(단위·E2E·CI) | 3개 언어로 모든 내용을 읽을 수 있는 사이트가 배포됨 |
| 2. 데모 | §6 전체, `export_demo.py` | 섹션 4의 B1 데모 동작 |
| 3. 3D 지형 | §5, §8.3, §9.1, `export_terrain.py`, 캡처 스크립트 | 지형·카메라 비행·대체 이미지 |
| 4. 연출·마감 | §4 모션, §8.1·8.2·8.4, §12(OG·통계), 용량 검사, 공개 전 점검 | 로딩·플립·리빌·Lenis, 성능 목표 달성 |

## Global Constraints

- 색: 배경 `#070B16`, 그라데이션 `#13203A`, 데이터 점 `#8FB8FF`, 텍스트 `#EEF3FF`, 포인트 `#FFB547`
- 글꼴: 제목 Space Grotesk Bold 대문자 자간 −0.03em / 본문 Pretendard(ja 페이지만 Noto Sans JP) / 수치·글자판 IBM Plex Mono. 모두 `next/font`
- 이징은 `cubic-bezier(.16,1,.3,1)` 하나, bounce 금지
- 주소: `/`(ko), `/en/`, `/ja/`. `trailingSlash: true`. 자동 언어 리다이렉트 금지
- **문장에 숫자를 직접 쓰지 않는다.** 수치는 `data/facts.json`에만 있고 문장은 `{path}` 자리표시로 참조한다(허용 예외: "30초/30-second/30秒")
- 문구 톤: 슬로건·광고 문장 금지, 꾸밈 없이 사실만
- 수치 주의: 대표값은 TimeSeriesSplit(R² 0.637 / 48,235원 / 21.4%). GroupKFold 0.649/49,067원은 **lookup 없이** 측정한 값, lookup 포함은 0.457/64,876원. R² 0.84→0.64는 "MAE는 그대로, R²만 떨어짐" 맥락으로만. 단순 기준선 MAE 48,688원을 한계 섹션에서 먼저 밝힌다
- 이메일 주소가 HTML 소스에 연속 문자열로 나타나면 안 된다
- LinkedIn 값이 비어 있으면 버튼을 숨긴다. 언어별 이력서 PDF가 없으면 "준비 중"으로 흐리게 표시
- 코드 링크(`github.com/hyde0395/airfare-forecasting-ml`)는 저장소가 비공개라 **404가 정상**이다. 고치지 않는다
- 원본 CSV는 이 저장소에 복사하지 않는다
- 커밋 작성자 이메일은 GitHub noreply(`55799748+hyde0395@users.noreply.github.com`)만 쓴다. 개인 이메일이 git 기록에 남으면 안 된다
- 계획 4에서 공개하기 전까지 사이트는 검색 노출을 막는다(`noindex`, robots.txt `Disallow: /`). 스위치는 `src/lib/site.ts`의 `LAUNCHED` 하나
- 글꼴 예외: Pretendard만 `next/font`가 아니라 패키지의 dynamic-subset CSS(유니코드 범위별 조각 로딩)를 쓴다
- 사용자와의 대화는 한국어로 한다

## Review Focus

1. **JS가 꺼져 있거나 늦게 로드되는 방문자**: 모든 섹션 제목과 본문이 정적 HTML에 있어야 한다 → Task 9의 `javaScriptEnabled: false` 테스트
2. **자리표시가 facts에 없는 경로를 가리킬 때**: 화면에 `{model.x}`가 그대로 찍히지 말고 빌드·테스트가 실패해야 한다 → Task 4의 `interpolate` throw 테스트, Task 5의 전 키 해석 테스트
3. **이력서 PDF가 없는 언어**: 깨진 링크 대신 비활성 "준비 중" 표시 → Task 7 단위 테스트 + Task 9 E2E
4. **이메일 수집 봇**: 원본 HTML에 주소가 없어야 하고, 사람에게는 보여야 한다 → Task 9 E2E
6. **휴대폰 폭의 상단 바**: `SIGNAL · 이력서 · KO EN JA`가 세 언어 모두 한 줄에 들어가고 넘치지 않아야 한다 → Task 9 모바일 E2E (30초 요약·메뉴는 2026-09-23 사용자 요청으로 제거)
5. **없는 주소로 들어온 방문자**(`/nope/`, `/en/xyz/`): 404 페이지가 3개 언어 안내와 첫 화면 링크를 보여야 한다 → Task 9 E2E

---

## File Structure

```
package.json, tsconfig.json, next.config.ts, vitest.config.ts, playwright.config.ts
.github/workflows/ci.yml
app/
  (ko)/layout.tsx, (ko)/page.tsx              → "/"
  (en)/layout.tsx, (en)/en/page.tsx           → "/en/"
  (ja)/layout.tsx, (ja)/ja/page.tsx           → "/ja/"
  global-not-found.tsx                         → 404.html
  sitemap.ts, robots.ts, icon.svg
src/
  lib/facts.ts          facts.json 스키마(zod)와 검증된 객체
  lib/i18n.ts           Locale, 경로, 값 포맷, 자리표시 해석, createT
  lib/content.ts        언어별 사전 로드 + getT(locale)
  lib/resume.ts         언어별 이력서 존재 여부(빌드 시 fs 확인)
  lib/site.ts           metadataBase, 언어별 metadata 생성
  lib/email.ts          주소 뒤집기/복원
  styles/fonts.ts       next/font 정의 (Pretendard 제외)
  styles/globals.css    토큰과 기본 스타일
  components/RootDocument.tsx   <html>/<body> 공통 틀
  components/HomePage.tsx       섹션 조립
  components/Header.tsx, HeaderMore.tsx(client), LangSwitch.tsx(client), LangHint.tsx(client), Summary.tsx(client), EmailLink.tsx(client)
  components/sections/Hero.tsx, About.tsx, CaseStudy.tsx, ValidationTable.tsx, Stack.tsx, Contact.tsx
content/ko.json, en.json, ja.json
data/facts.json
public/resume/.gitkeep
scripts/export_facts.py, scripts/model_metrics.json, scripts/tests/test_export_facts.py
README.md
tests/unit/*.test.ts, tests/e2e/*.spec.ts
```

> 스펙 §5.1은 `facts.json`을 `public/data/`에 둔다고 적었지만, 이 파일은 빌드할 때만 읽고 공개 URL이 필요 없으며, 공개하면 이메일 난독화가 무의미해진다. 그래서 `data/facts.json`에 둔다(Task 2에서 스펙도 한 줄 고친다). 런타임에 fetch하는 `demo.json`·`terrain.json`은 계획 2·3에서 `public/data/`에 둔다.

---

### Task 1: Next.js 스캐폴딩 + 토큰 + 글꼴 + 테스트 도구

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts`, `src/styles/fonts.ts`, `src/styles/globals.css`, `app/(ko)/layout.tsx`, `app/(ko)/page.tsx`, `tests/unit/smoke.test.ts`
- Modify: `.gitignore`, `docs/superpowers/specs/2026-09-23-portfolio-design.md` (§4 글꼴 줄에 "Pretendard는 dynamic-subset CSS로 조각 로딩(next/font 예외)" 추가)

**Interfaces:**
- Produces: `@/*` → `src/*` 경로 별칭, 폰트 CSS 변수 `--font-display`, `--font-mono`, `--font-jp`, 본문 글꼴 이름 `'Pretendard Variable'`(dynamic-subset CSS), 색 토큰 `--bg`, `--bg2`, `--dot`, `--tx`, `--amb`, `--mute`, `--line`, 이징 `--ease`. npm 스크립트 `dev`, `build`, `typecheck`, `test`, `e2e`.

- [ ] **Step 0: 커밋 작성자 이메일을 GitHub noreply로 바꾸고 기존 기록도 고친다**

저장소를 공개하면 모든 커밋의 작성자 이메일이 드러난다. 사이트에서 이메일을 숨기는 의미가 없어지므로, 이 저장소에서만 noreply 주소를 쓴다. 아직 원격에 올리기 전이라 기록을 다시 써도 안전하다.

```bash
cd ~/dev/signal-ml-portfolio
git config user.email "55799748+hyde0395@users.noreply.github.com"
git rebase -r --root --exec "git commit --amend --no-edit --reset-author"
git log --format='%ae %ce' | sort -u
```
Expected: 출력이 `55799748+hyde0395@users.noreply.github.com 55799748+hyde0395@users.noreply.github.com` 한 줄뿐.

- [ ] **Step 1: 패키지 설치**

```bash
cd ~/dev/signal-ml-portfolio
npm init -y
npm install next@16.3.6 react@19.3.0 react-dom@19.3.0 zod@4.6.5 pretendard@1.3.9
npm install -D typescript @types/node @types/react @types/react-dom vitest@5.0.1 @playwright/test@1.63.0 @axe-core/playwright@4.13.0 serve
```

- [ ] **Step 2: `package.json` 스크립트와 설정**

`package.json`의 `"scripts"`를 아래로 바꾸고 `"private": true`, `"type": "module"`을 넣는다(`main`, `keywords` 등 npm init 기본값은 지운다).

```json
{
  "name": "signal-ml-portfolio",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "e2e": "playwright test",
    "facts": "${AIRFARE_ROOT:-$HOME/Documents/airfare-forecasting-ml}/.venv/bin/python scripts/export_facts.py"
  }
}
```
(`dependencies`/`devDependencies`는 Step 1이 채운 그대로 둔다.)

- [ ] **Step 3: `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "es2022"],
    "strict": true,
    "noEmit": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "skipLibCheck": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules", "out"]
}
```

- [ ] **Step 4: `next.config.ts`**

```ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  experimental: { globalNotFound: true },
};

export default nextConfig;
```

- [ ] **Step 5: `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: { environment: 'node', include: ['tests/unit/**/*.test.ts'] },
});
```

- [ ] **Step 6: 글꼴 `src/styles/fonts.ts`**

```ts
// Pretendard는 여기서 정의하지 않는다. 한글 서브셋 파일이 굵기당 약 270KB라,
// 패키지의 dynamic-subset CSS(유니코드 범위별 92조각)를 import해 페이지에 실제로 나온 글자 조각만 받는다.
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import { IBM_Plex_Mono, Noto_Sans_JP, Space_Grotesk } from 'next/font/google';

export const display = Space_Grotesk({ subsets: ['latin'], weight: ['500', '700'], variable: '--font-display', display: 'swap' });
export const mono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '600'], variable: '--font-mono', display: 'swap' });
// 일본어 페이지 layout에서만 import한다. 가나·한자 서브셋이 크므로 preload하지 않는다.
export const jp = Noto_Sans_JP({ weight: ['400', '600'], variable: '--font-jp', display: 'swap', preload: false });

export const baseFontVars = `${display.variable} ${mono.variable}`;
```

- [ ] **Step 7: `src/styles/globals.css`**

```css
:root {
  --bg: #070B16; --bg2: #13203A; --dot: #8FB8FF; --tx: #EEF3FF; --amb: #FFB547;
  --mute: rgba(238, 243, 255, 0.72); /* #070B16 위에서 대비 ≥ 4.5:1 */
  --line: rgba(143, 184, 255, 0.18);
  --ease: cubic-bezier(.16, 1, .3, 1);
  --font-text: 'Pretendard Variable', system-ui, sans-serif;
}
:root:lang(ja) { --font-text: var(--font-jp), 'Pretendard Variable', system-ui, sans-serif; }

* { box-sizing: border-box; margin: 0; padding: 0; }
html { background: var(--bg); color-scheme: dark; }
body {
  min-height: 100vh; color: var(--tx); font-family: var(--font-text); line-height: 1.7;
  background: radial-gradient(120% 80% at 70% 0%, var(--bg2), var(--bg) 60%) fixed;
}
a { color: var(--dot); }
:focus-visible { outline: 2px solid var(--amb); outline-offset: 3px; }

.display { font-family: var(--font-display); font-weight: 700; text-transform: uppercase; letter-spacing: -0.03em; line-height: 0.95; }
.mono { font-family: var(--font-mono); }
.eyebrow { font: 600 0.75rem var(--font-mono); letter-spacing: 0.18em; color: var(--amb); }
.muted { color: var(--mute); }

.skip { position: absolute; left: 16px; top: -100px; background: var(--amb); color: #1a1200; padding: 8px 12px; z-index: 100; }
.skip:focus { top: 16px; }

.wrap { width: min(1080px, 100% - 32px); margin-inline: auto; }
section { padding-block: 96px; }
section h2 { font-size: clamp(1.75rem, 4vw, 2.75rem); margin: 8px 0 24px; }
section h3 { font-size: 1.25rem; margin: 40px 0 12px; }
section p + p { margin-top: 12px; }
```

- [ ] **Step 8: 임시 한국어 layout/page (Task 6에서 교체)**

`app/(ko)/layout.tsx`:
```tsx
import '@/styles/globals.css';
import { baseFontVars } from '@/styles/fonts';

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={baseFontVars}>
      <body>{children}</body>
    </html>
  );
}
```
`app/(ko)/page.tsx`:
```tsx
export default function Page() {
  return <main className="wrap"><h1 className="display">CHOI HALIM</h1></main>;
}
```

- [ ] **Step 9: 스모크 테스트 `tests/unit/smoke.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import config from '../../next.config';

describe('next config', () => {
  it('정적 export와 trailing slash를 쓴다', () => {
    expect(config.output).toBe('export');
    expect(config.trailingSlash).toBe(true);
  });
});
```

- [ ] **Step 10: `.gitignore`에 추가**

```
next-env.d.ts
*.tsbuildinfo
playwright-report/
test-results/
__pycache__/
```

- [ ] **Step 11: 검증**

Run: `npm run typecheck && npm test && npm run build && ls out/index.html`
Expected: 타입 오류 0, 테스트 1개 PASS, `out/index.html` 존재. 그리고 `ls out/_next/static/media | grep -c woff2`가 여러 개(Pretendard 조각이 빌드에 복사됨)인지, `du -ch out/_next/static/media/*.woff2 | tail -1`로 전체 크기를 확인한다(조각은 필요한 것만 내려받으므로 전체 크기는 커도 된다). CSS import가 빌드에서 거부되면 같은 import를 `src/styles/globals.css` 맨 위 `@import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';`로 옮긴다. 빌드가 `experimental.globalNotFound`를 모른다고 실패하면 Next 16.3.6 문서(`node_modules/next/dist/docs` 또는 `node_modules/next/dist/server/config-shared.js`)에서 키 이름을 확인해 맞춘다.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js static export with tokens, fonts, vitest"
```
(스펙 §4 수정도 이 커밋에 포함한다.)
```bash
git log -1 --format=%ae   # noreply 주소인지 확인
```

---

### Task 2: `export_facts.py` — 항공권 저장소에서 수치 추출 (Python)

**Files:**
- Create: `scripts/export_facts.py`, `scripts/model_metrics.json`, `scripts/tests/test_export_facts.py`, `data/facts.json`
- Modify: `docs/superpowers/specs/2026-09-23-portfolio-design.md` (§5.1 표의 `facts.json` 출력 경로를 `data/facts.json`으로, §11.1에 "빌드 시 import, 공개 URL 없음" 한 줄)

**Interfaces:**
- Consumes: 항공권 저장소 `src.processing.constants.{DURATION_MAX, PRICE_FLOOR}`, `src.processing.features.{drop_inconsistent_flight_times, drop_implausible_direct_flights}`, `data/raw/flight_prices.csv`
- Produces: `data/facts.json`. 스크립트는 `dataVersion`, `data`, `model` 키만 덮어쓰고 나머지(`profile`, `contact`, `codeLinks`)는 보존한다. 키 구조는 Task 3 스키마와 같다.

**배경:** 원본 CSV는 매일 자동으로 늘어난다(2026-09-23 기준 이미 9/23 수집 행이 있음). 모델 수치는 2026-09-22 스냅샷이므로 **`fetch_timestamp`가 기준일 이하인 행만** 센다. 모델 성능 수치는 학습 로그에서 나온 값이라 CSV로 다시 계산할 수 없다. 그래서 `model_metrics.json`에 항공권 저장소 CLAUDE.md의 값을 그대로 옮겨 두고(출처 주석 포함), 스크립트는 그 파일에 적힌 `trainedRows`와 다시 센 행 수가 다르면 **실패**한다. 사이트 수치와 모델 스냅샷이 어긋나는 것을 막기 위해서다.

- [ ] **Step 1: 실패하는 테스트 `scripts/tests/test_export_facts.py`**

```python
import sys
from pathlib import Path

import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import export_facts as ef  # noqa: E402

COLS = ["fetch_timestamp", "origin", "destination", "departure_date", "price", "stops",
        "duration_minutes", "departure_time_raw", "arrival_time_raw", "days_to_departure"]


def row(ts, price=150_000, stops=0, dur=150, dep="08:00", arr="10:30", dtd=20, o="ICN", d="NRT", day="2026-10-10"):
    return [ts, o, d, day, price, stops, dur, f"{day} {dep}", f"{day} {arr}", dtd]


def frame(rows):
    return pd.DataFrame(rows, columns=COLS)


def test_counts_filters_and_cutoff():
    raw = frame([
        row("2026-09-22 10:00:00"),                                   # 정상
        row("2026-09-22 23:59:59", dtd=147, day="2027-02-14"),        # 정상, 기준일 마지막 순간
        row("2026-09-22 11:00:00", price=150),                        # 가격 floor 미만 → 제거
        row("2026-09-22 12:00:00", dur=360, arr="14:00"),              # 직항인데 6시간 → 타당성 필터
        row("2026-09-23 06:54:06"),                                   # 기준일 이후 → 아예 제외
    ])
    stats = ef.compute_data_stats(raw, "2026-09-22")
    assert stats["rawRows"] == 4
    assert stats["filteredRows"] == 2
    assert stats["removedImplausible"] == 1
    assert stats["collectStart"] == "2026-09-22"
    assert stats["collectEnd"] == "2026-09-22"
    assert stats["departStart"] == "2026-10-10"
    assert stats["departEnd"] == "2027-02-14"
    assert stats["uniqueDepartures"] == 2
    assert stats["maxDtd"] == 147
    assert stats["routes"] == 1


def test_merge_keeps_site_config():
    existing = {"dataVersion": "old", "contact": {"linkedin": ""}, "data": {"rawRows": 1}}
    merged = ef.merge_facts(existing, "2026-09-22", {"rawRows": 2}, {"tss": {"r2": 0.637}})
    assert merged["contact"] == {"linkedin": ""}
    assert merged["dataVersion"] == "2026-09-22"
    assert merged["data"] == {"rawRows": 2}
    assert merged["model"] == {"tss": {"r2": 0.637}}


def test_row_count_mismatch_fails():
    with pytest.raises(SystemExit, match="242,874"):
        ef.check_snapshot({"filteredRows": 242_000}, {"trainedRows": 242_874})
```

- [ ] **Step 2: 실패 확인**

Run: `~/Documents/airfare-forecasting-ml/.venv/bin/python -m pytest scripts/tests -q`
Expected: FAIL — `ModuleNotFoundError: No module named 'export_facts'`
(항공권 저장소가 iCloud에서 evict돼 import가 멈추면, 그쪽 CLAUDE.md "iCloud 동기화 I/O 병목"의 워밍 명령을 항공권 저장소 루트에서 먼저 실행한다.)

- [ ] **Step 3: `scripts/export_facts.py`**

```python
"""data/facts.json의 dataVersion·data·model 영역을 항공권 저장소 기준으로 갱신한다.

- data: 원본 CSV를 기준일(asOf)까지 자르고, 항공권 저장소의 학습용 필터를 그대로 적용해 센다.
- model: scripts/model_metrics.json(항공권 저장소 CLAUDE.md에서 옮긴 값)을 그대로 쓴다.
- 나머지 키(profile, contact, codeLinks 등)는 손대지 않는다.

실행: npm run facts   (AIRFARE_ROOT 기본값 ~/Documents/airfare-forecasting-ml)
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
FACTS_PATH = ROOT / "data" / "facts.json"
METRICS_PATH = ROOT / "scripts" / "model_metrics.json"
AIRFARE_ROOT = Path(os.environ.get("AIRFARE_ROOT", Path.home() / "Documents" / "airfare-forecasting-ml"))

sys.path.insert(0, str(AIRFARE_ROOT))
from src.processing.constants import DURATION_MAX, PRICE_FLOOR  # noqa: E402
from src.processing.features import (  # noqa: E402
    drop_implausible_direct_flights,
    drop_inconsistent_flight_times,
)


def apply_filters(df: pd.DataFrame) -> tuple[pd.DataFrame, int]:
    """tscv_eval_v2.load_data()와 같은 순서의 필터. (필터 후 df, 직항 타당성 필터로 제거된 행 수)."""
    df = df[df["duration_minutes"].notna() & (df["duration_minutes"] <= DURATION_MAX)]
    df = df[df["price"] >= PRICE_FLOOR]
    df = drop_inconsistent_flight_times(df)
    n_before = len(df)
    df = drop_implausible_direct_flights(df)
    return df, n_before - len(df)


def compute_data_stats(raw: pd.DataFrame, as_of: str) -> dict:
    cutoff = pd.Timestamp(as_of) + pd.Timedelta(days=1)
    raw = raw[pd.to_datetime(raw["fetch_timestamp"]) < cutoff]
    df, removed = apply_filters(raw)
    fetch = pd.to_datetime(df["fetch_timestamp"])
    dep = pd.to_datetime(df["departure_date"])
    routes = (df["origin"].astype(str) + "_" + df["destination"].astype(str)).nunique()
    return {
        "rawRows": int(len(raw)),
        "filteredRows": int(len(df)),
        "removedImplausible": int(removed),
        "collectStart": fetch.min().strftime("%Y-%m-%d"),
        "collectEnd": fetch.max().strftime("%Y-%m-%d"),
        "departStart": dep.min().strftime("%Y-%m-%d"),
        "departEnd": dep.max().strftime("%Y-%m-%d"),
        "uniqueDepartures": int(dep.nunique()),
        "maxDtd": int(df["days_to_departure"].max()),
        "routes": int(routes),
    }


def check_snapshot(data: dict, metrics_meta: dict) -> None:
    expected = metrics_meta["trainedRows"]
    if data["filteredRows"] != expected:
        raise SystemExit(
            f"필터 후 행 수 {data['filteredRows']:,} ≠ 모델 스냅샷 {expected:,}. "
            "기준일이나 필터가 모델 학습 때와 다르다. 모델 수치를 갱신하기 전에는 사이트 수치를 바꾸지 않는다."
        )


def merge_facts(existing: dict, as_of: str, data: dict, model: dict) -> dict:
    merged = dict(existing)
    merged["dataVersion"] = as_of
    merged["data"] = data
    merged["model"] = model
    return merged


def main() -> None:
    metrics = json.loads(METRICS_PATH.read_text(encoding="utf-8"))
    meta = metrics.pop("_meta")
    as_of = meta["asOf"]
    raw = pd.read_csv(AIRFARE_ROOT / "data" / "raw" / "flight_prices.csv")
    data = compute_data_stats(raw, as_of)
    check_snapshot(data, meta)
    existing = json.loads(FACTS_PATH.read_text(encoding="utf-8")) if FACTS_PATH.exists() else {}
    merged = merge_facts(existing, as_of, data, metrics)
    FACTS_PATH.write_text(json.dumps(merged, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"facts.json 갱신: {as_of}, {data['filteredRows']:,}행")


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `~/Documents/airfare-forecasting-ml/.venv/bin/python -m pytest scripts/tests -q`
Expected: 3 passed

- [ ] **Step 5: `scripts/model_metrics.json`** (값은 항공권 저장소 `CLAUDE.md` "최종 성능", "데이터", "BUY_NOW 편향 판정", "다음 세션 할 일 0번 표"에서 옮긴 것. 옮길 때 원본과 한 번 더 대조한다)

```json
{
  "_meta": {
    "asOf": "2026-09-22",
    "trainedRows": 242874,
    "source": "airfare-forecasting-ml/CLAUDE.md (2026-09-23 정리본). 재학습하면 이 파일을 먼저 고친다."
  },
  "tss": { "r2": 0.637, "mae": 48235, "mape": 21.4 },
  "kfold": { "r2": 0.668, "mae": 44196, "mape": 18.9 },
  "gkfNoLookup": { "r2": 0.649, "mae": 49067, "mape": 20.4 },
  "gkfWithLookup": { "r2": 0.457, "mae": 64876, "mape": 30.0 },
  "baselineMae": 48688,
  "lookupVariants": 4,
  "optunaTrials": 100,
  "testFiles": 7,
  "interval": { "level": 80, "coverage": 80.2, "driftLow": 69 },
  "bubble": { "firstR2": 0.93, "r2Before": 0.84, "r2After": 0.64, "maeBefore": 48442, "maeAfter": 48235, "denomShare": 51 },
  "reco": { "buyNow": 92.1, "dropExpected": 5.9, "wait": 2.0, "simulations": 2847 },
  "realizedFlights": 16469,
  "curveWidth": 16,
  "bookingCurve": [
    { "label": "D-1~3", "pct": 11.1 },
    { "label": "D-4~7", "pct": 4.4 },
    { "label": "D-8~14", "pct": 0.9 },
    { "label": "D-15~21", "pct": -2.4 },
    { "label": "D-22~30", "pct": -3.7 },
    { "label": "D-31~45", "pct": -5.0 },
    { "label": "D-46~60", "pct": -4.3 },
    { "label": "D-61~90", "pct": 2.1 }
  ]
}
```

- [ ] **Step 6: 사이트 설정이 담긴 초기 `data/facts.json`**

`data`·`model`은 다음 Step에서 스크립트가 채운다. 여기서는 스크립트가 보존할 키만 쓴다.

```json
{
  "profile": { "graduation": "2028-02" },
  "contact": {
    "emailReversed": "moc.liamg@5930sugolopa",
    "github": "https://github.com/hyde0395",
    "linkedin": ""
  },
  "codeLinks": {
    "baseUrl": "https://github.com/hyde0395/airfare-forecasting-ml",
    "paths": {
      "problem": "tree/main/src/collection",
      "insight": "blob/main/src/models/realized_wait_analysis.py",
      "bubble": "blob/main/src/processing/features.py",
      "validation": "blob/main/src/models/tscv_eval_v2.py",
      "interval": "blob/main/src/models/v2_predictor.py",
      "limits": "blob/main/README.md"
    }
  }
}
```
(이메일은 파일에서도 뒤집어 저장한다. 저장소를 공개했을 때 파일에서 바로 긁히지 않게 하기 위해서다.)

- [ ] **Step 7: 실제 데이터로 실행**

Run: `npm run facts`
Expected: `facts.json 갱신: 2026-09-22, 242,874행`. 그리고 `data/facts.json`의 `data.rawRows`가 258829, `data.removedImplausible`이 9387, `data.uniqueDepartures`가 180, `data.maxDtd`가 147인지 확인한다.
행 수 불일치로 실패하면 **숫자를 손으로 맞추지 말고** 멈춰서 사용자에게 보고한다(원인 후보: 모델 학습 시점의 CSV가 9/22 중간까지만 있었음).

- [ ] **Step 8: 스펙 한 줄 수정** — §5.1 표 `export_facts.py` 행의 출력을 `data/facts.json (빌드 시 import, 공개 URL 없음)`으로, §11.1 제목 아래에 "위치: `data/facts.json`. 사이트가 빌드할 때 import하며 공개 URL로 제공하지 않는다."를 추가.

- [ ] **Step 9: Commit**

```bash
git add scripts data docs/superpowers/specs
git commit -m "feat: export facts.json from airfare repo snapshot"
```

---

### Task 3: facts 스키마와 로더 (TS)

**Files:**
- Create: `src/lib/facts.ts`, `tests/unit/facts.test.ts`

**Interfaces:**
- Consumes: `data/facts.json` (Task 2)
- Produces: `export const factsSchema`, `export type Facts = z.infer<typeof factsSchema>`, `export const facts: Facts` (모듈 로드 시 검증, 실패하면 throw), `export function codeUrl(chapter: CodeChapter): string`, `export type CodeChapter = 'problem'|'insight'|'bubble'|'validation'|'interval'|'limits'`

- [ ] **Step 1: 실패하는 테스트 `tests/unit/facts.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import raw from '../../data/facts.json';
import { codeUrl, facts, factsSchema } from '@/lib/facts';

describe('facts.json', () => {
  it('스키마를 통과한다', () => {
    expect(() => factsSchema.parse(raw)).not.toThrow();
  });

  it('필수 수치가 들어 있다', () => {
    expect(facts.data.filteredRows).toBe(242874);
    expect(facts.model.tss.r2).toBe(0.637);
    expect(facts.model.bookingCurve).toHaveLength(8);
  });

  it('숫자 자리에 문자열이 오면 거부한다', () => {
    const broken = structuredClone(raw) as Record<string, any>;
    broken.model.tss.mae = '48,235';
    expect(() => factsSchema.parse(broken)).toThrow();
  });

  it('코드 링크를 기본 주소 + 경로로 만든다', () => {
    expect(codeUrl('bubble')).toBe(
      'https://github.com/hyde0395/airfare-forecasting-ml/blob/main/src/processing/features.py',
    );
  });
});
```

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run tests/unit/facts.test.ts` / Expected: FAIL `Cannot find module '@/lib/facts'`

- [ ] **Step 3: `src/lib/facts.ts`**

```ts
import { z } from 'zod';
import raw from '../../data/facts.json';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const score = z.object({ r2: z.number(), mae: z.number(), mape: z.number() });
const chapters = ['problem', 'insight', 'bubble', 'validation', 'interval', 'limits'] as const;
export type CodeChapter = (typeof chapters)[number];

export const factsSchema = z.object({
  dataVersion: isoDate,
  profile: z.object({ graduation: z.string().regex(/^\d{4}-\d{2}$/) }),
  contact: z.object({
    emailReversed: z.string().includes('@'),
    github: z.url(),
    linkedin: z.union([z.literal(''), z.url()]),
  }),
  codeLinks: z.object({
    baseUrl: z.url(),
    paths: z.object(Object.fromEntries(chapters.map((c) => [c, z.string().min(1)])) as Record<CodeChapter, z.ZodString>),
  }),
  data: z.object({
    rawRows: z.number().int(), filteredRows: z.number().int(), removedImplausible: z.number().int(),
    collectStart: isoDate, collectEnd: isoDate, departStart: isoDate, departEnd: isoDate,
    uniqueDepartures: z.number().int(), maxDtd: z.number().int(), routes: z.number().int(),
  }),
  model: z.object({
    tss: score, kfold: score, gkfNoLookup: score, gkfWithLookup: score,
    baselineMae: z.number(), lookupVariants: z.number().int(), optunaTrials: z.number().int(), testFiles: z.number().int(),
    interval: z.object({ level: z.number(), coverage: z.number(), driftLow: z.number() }),
    bubble: z.object({
      firstR2: z.number(), r2Before: z.number(), r2After: z.number(),
      maeBefore: z.number(), maeAfter: z.number(), denomShare: z.number(),
    }),
    reco: z.object({ buyNow: z.number(), dropExpected: z.number(), wait: z.number(), simulations: z.number().int() }),
    realizedFlights: z.number().int(),
    curveWidth: z.number(),
    bookingCurve: z.array(z.object({ label: z.string(), pct: z.number() })).length(8),
  }),
});

export type Facts = z.infer<typeof factsSchema>;

export const facts: Facts = factsSchema.parse(raw);

export function codeUrl(chapter: CodeChapter): string {
  return `${facts.codeLinks.baseUrl}/${facts.codeLinks.paths[chapter]}`;
}
```

- [ ] **Step 4: 통과 확인** — Run: `npx vitest run tests/unit/facts.test.ts` / Expected: 4 passed

- [ ] **Step 5: Commit**

```bash
git add src/lib/facts.ts tests/unit/facts.test.ts
git commit -m "feat: validate facts.json with zod schema"
```

---

### Task 4: i18n 핵심 — 값 포맷과 자리표시 해석

**Files:**
- Create: `src/lib/i18n.ts`, `tests/unit/i18n.test.ts`

**Interfaces:**
- Produces:
  - `type Locale = 'ko' | 'en' | 'ja'`, `const LOCALES: readonly Locale[]`, `const LOCALE_PATH: Record<Locale, string>` (`'/'`, `'/en/'`, `'/ja/'`), `const INTL_LOCALE: Record<Locale, string>`
  - `lookup(obj: unknown, path: string): unknown` (점 경로, 배열 인덱스 허용: `model.bookingCurve.0.pct`)
  - `formatValue(value: unknown, format: string | undefined, locale: Locale): string` — 형식: 없음(숫자 천 단위, 소수 최대 3자리 / 문자열 그대로), `signed`, `plain`, `date`(YYYY-MM-DD), `month`(YYYY-MM)
  - `interpolate(template: string, source: unknown, locale: Locale): string` — `{path}` / `{path|format}`, 경로가 없으면 throw
  - `PLACEHOLDER: RegExp` (전역 플래그)
  - `createT(dict: unknown, source: unknown, locale: Locale): (key: string) => string` — 키가 없거나 문자열이 아니면 throw

- [ ] **Step 1: 실패하는 테스트 `tests/unit/i18n.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { createT, formatValue, interpolate, lookup } from '@/lib/i18n';

const src = { model: { mae: 48235, r2: 0.637, curve: [{ pct: 11.1 }, { pct: -5 }] }, d: '2026-04-23', g: '2028-02', y: 2028 };

describe('lookup', () => {
  it('점 경로와 배열 인덱스를 따라간다', () => {
    expect(lookup(src, 'model.curve.1.pct')).toBe(-5);
    expect(lookup(src, 'model.none')).toBeUndefined();
  });
});

describe('formatValue', () => {
  it('숫자는 언어별 천 단위 구분', () => {
    expect(formatValue(48235, undefined, 'ko')).toBe('48,235');
    expect(formatValue(0.637, undefined, 'en')).toBe('0.637');
  });
  it('signed는 부호를 붙인다', () => {
    expect(formatValue(11.1, 'signed', 'ko')).toBe('+11.1');
    expect(formatValue(-5, 'signed', 'ko')).toMatch(/^[-−]5$/);
  });
  it('plain은 구분 기호 없이', () => {
    expect(formatValue(2028, 'plain', 'ko')).toBe('2028');
  });
  it('date와 month는 언어별 표기', () => {
    expect(formatValue('2026-04-23', 'date', 'ko')).toBe('2026년 4월 23일');
    expect(formatValue('2026-04-23', 'date', 'ja')).toBe('2026年4月23日');
    expect(formatValue('2028-02', 'month', 'en')).toBe('Feb 2028');
    expect(formatValue('2028-02', 'month', 'ko')).toBe('2028년 2월');
    expect(formatValue('2028-02', 'month', 'ja')).toBe('2028年2月');
  });
  it('형식과 값이 맞지 않으면 throw', () => {
    expect(() => formatValue('abc', 'signed', 'ko')).toThrow();
  });
});

describe('interpolate', () => {
  it('자리표시를 채운다', () => {
    expect(interpolate('MAE {model.mae}원, 곡선 {model.curve.0.pct|signed}%', src, 'ko')).toBe('MAE 48,235원, 곡선 +11.1%');
  });
  it('없는 경로는 throw (화면에 {..}가 찍히지 않게)', () => {
    expect(() => interpolate('{model.nope}', src, 'ko')).toThrow(/model\.nope/);
  });
});

describe('createT', () => {
  const t = createT({ a: { b: '값 {model.r2}' }, n: 3 }, src, 'ko');
  it('키로 문장을 찾고 채운다', () => expect(t('a.b')).toBe('값 0.637'));
  it('없는 키는 throw', () => expect(() => t('a.c')).toThrow(/a\.c/));
  it('문자열이 아닌 키는 throw', () => expect(() => t('n')).toThrow());
});
```

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run tests/unit/i18n.test.ts` / Expected: FAIL `Cannot find module '@/lib/i18n'`

- [ ] **Step 3: `src/lib/i18n.ts`**

```ts
export type Locale = 'ko' | 'en' | 'ja';
export const LOCALES: readonly Locale[] = ['ko', 'en', 'ja'];
export const LOCALE_PATH: Record<Locale, string> = { ko: '/', en: '/en/', ja: '/ja/' };
export const INTL_LOCALE: Record<Locale, string> = { ko: 'ko-KR', en: 'en-US', ja: 'ja-JP' };

export const PLACEHOLDER = /\{([A-Za-z0-9_.]+)(?:\|([a-z]+))?\}/g;

export function lookup(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>(
    (acc, key) => (acc !== null && typeof acc === 'object' ? (acc as Record<string, unknown>)[key] : undefined),
    obj,
  );
}

export function formatValue(value: unknown, format: string | undefined, locale: Locale): string {
  const intl = INTL_LOCALE[locale];
  if (format === undefined) {
    if (typeof value === 'number') return new Intl.NumberFormat(intl, { maximumFractionDigits: 3 }).format(value);
    if (typeof value === 'string') return value;
  }
  if (format === 'signed' && typeof value === 'number') {
    return new Intl.NumberFormat(intl, { maximumFractionDigits: 3, signDisplay: 'exceptZero' }).format(value);
  }
  if (format === 'plain' && typeof value === 'number') return String(value);
  if (format === 'date' && typeof value === 'string') {
    return new Intl.DateTimeFormat(intl, { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })
      .format(new Date(`${value}T00:00:00Z`));
  }
  if (format === 'month' && typeof value === 'string') {
    return new Intl.DateTimeFormat(intl, { year: 'numeric', month: locale === 'en' ? 'short' : 'long', timeZone: 'UTC' })
      .format(new Date(`${value}-01T00:00:00Z`));
  }
  throw new Error(`Cannot format ${JSON.stringify(value)} as "${format ?? 'default'}"`);
}

export function interpolate(template: string, source: unknown, locale: Locale): string {
  return template.replace(PLACEHOLDER, (_, path: string, format: string | undefined) => {
    const value = lookup(source, path);
    if (value === undefined) throw new Error(`Missing fact for placeholder {${path}}`);
    return formatValue(value, format, locale);
  });
}

export function createT(dict: unknown, source: unknown, locale: Locale): (key: string) => string {
  return (key) => {
    const template = lookup(dict, key);
    if (typeof template !== 'string') throw new Error(`Missing text for key "${key}" (${locale})`);
    return interpolate(template, source, locale);
  };
}
```

- [ ] **Step 4: 통과 확인** — Run: `npx vitest run tests/unit/i18n.test.ts` / Expected: 모두 PASS. (`date`/`month` 기대값이 Node의 ICU와 다르게 나오면 실제 출력을 확인하고, 스펙의 표기와 뜻이 같으면 기대값을 그 출력으로 맞춘다.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/i18n.ts tests/unit/i18n.test.ts
git commit -m "feat: add i18n formatting and placeholder interpolation"
```

---

### Task 5: 문구 파일 3개 + 문구 규칙 테스트 (사용자 검토 체크포인트 포함)

**Files:**
- Create: `content/ko.json`, `content/en.json`, `content/ja.json`, `src/lib/content.ts`, `tests/unit/content.test.ts`

**Interfaces:**
- Consumes: `facts` (Task 3), `createT`, `interpolate`, `PLACEHOLDER`, `Locale`, `LOCALES` (Task 4)
- Produces: `dictionaries: Record<Locale, Dict>`, `getT(locale: Locale): (key: string) => string` (facts가 자리표시 원본), `flatten(dict: unknown, prefix?: string): Record<string, string>`. 키 목록은 아래 `ko.json`이 기준이다. Task 6~8 컴포넌트는 이 키만 쓴다.

- [ ] **Step 1: 실패하는 테스트 `tests/unit/content.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { facts } from '@/lib/facts';
import { interpolate, LOCALES, PLACEHOLDER } from '@/lib/i18n';
import { dictionaries, flatten } from '@/lib/content';

const ALLOWED_DIGITS = [/30초/g, /30-second/g, /30秒/g];
const MAY_BE_EMPTY = new Set(['hero.nameSub']);

const flat = Object.fromEntries(LOCALES.map((l) => [l, flatten(dictionaries[l])]));

describe('문구 파일', () => {
  it('세 언어의 키 목록이 같다', () => {
    const ko = Object.keys(flat.ko).sort();
    expect(Object.keys(flat.en).sort()).toEqual(ko);
    expect(Object.keys(flat.ja).sort()).toEqual(ko);
  });

  for (const locale of LOCALES) {
    it(`${locale}: 모든 자리표시가 facts에서 해석된다`, () => {
      for (const [key, text] of Object.entries(flat[locale])) {
        expect(() => interpolate(text, facts, locale), key).not.toThrow();
      }
    });

    it(`${locale}: 자리표시 밖에 숫자를 직접 쓰지 않는다`, () => {
      for (const [key, text] of Object.entries(flat[locale])) {
        let rest = text.replace(PLACEHOLDER, '');
        for (const re of ALLOWED_DIGITS) rest = rest.replace(re, '');
        expect(rest, `${locale}:${key} → "${text}"`).not.toMatch(/[0-9０-９]/);
      }
    });

    it(`${locale}: 빈 문장이 없다`, () => {
      for (const [key, text] of Object.entries(flat[locale])) {
        if (!MAY_BE_EMPTY.has(key)) expect(text.trim(), `${locale}:${key}`).not.toBe('');
      }
    });
  }
});
```

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run tests/unit/content.test.ts` / Expected: FAIL `Cannot find module '@/lib/content'`

- [ ] **Step 3: `src/lib/content.ts`**

```ts
import en from '../../content/en.json';
import ja from '../../content/ja.json';
import ko from '../../content/ko.json';
import { facts } from './facts';
import { createT, type Locale } from './i18n';

export type Dict = typeof ko;
export const dictionaries: Record<Locale, Dict> = { ko, en, ja };

export function getT(locale: Locale): (key: string) => string {
  return createT(dictionaries[locale], facts, locale);
}

export function flatten(dict: unknown, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(dict as Record<string, unknown>)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') out[key] = v;
    else Object.assign(out, flatten(v, key));
  }
  return out;
}
```

- [ ] **Step 4: 한국어 초안 `content/ko.json`** (톤: 사실만, 담백하게. 수치는 전부 자리표시)

```json
{
  "meta": {
    "title": "최하림 — ML 엔지니어 포트폴리오",
    "description": "한·일 항공권 가격을 직접 수집해 예측 모델을 만들고 검증한 과정을 정리했습니다."
  },
  "nav": {
    "skip": "본문으로 건너뛰기",
    "resume": "이력서",
    "resumePending": "이력서 준비 중",
    "summary": "30초 요약",
    "language": "언어"
  },
  "langHint": { "offer": "한국어로 보기 →", "dismiss": "닫기" },
  "hero": {
    "nameSub": "최하림",
    "role": "ML ENGINEER",
    "keywords": "시계열 예측 · 모델 검증 · 데이터 파이프라인"
  },
  "about": {
    "heading": "소개",
    "education": "수원대학교 컴퓨터소프트웨어학과 · {profile.graduation|month} 졸업 예정",
    "body1": "한·일 항공권 가격을 매일 자동으로 모으고, 그 데이터로 가격 예측 모델을 만들었습니다.",
    "body2": "점수보다 평가 방식이 맞는지를 먼저 확인했고, 그 과정에서 부풀려진 R²를 두 번 바로잡았습니다.",
    "body3": "예측값과 함께 어느 범위까지 믿을 수 있는지도 보여 주도록 만들었습니다.",
    "skillsHeading": "핵심 역량",
    "skills": {
      "collection": "수집 자동화 — GitHub Actions가 매일 가격을 수집하고 CSV를 자동 커밋",
      "modeling": "시계열 모델링 — 노선별 NeuralProphet 추세 + XGBoost 잔차 학습, Optuna {model.optunaTrials}회 튜닝",
      "validation": "검증 설계 — TimeSeriesSplit · GroupKFold · K-Fold 비교로 누수 확인",
      "interval": "예측 구간 보정 — {model.interval.level}% 구간의 실제 포함률 {model.interval.coverage}%"
    }
  },
  "case": {
    "heading": "한·일 항공권, 언제 사야 할까?",
    "codeLink": "코드 보기",
    "problem": {
      "heading": "문제와 데이터",
      "body1": "인천과 도쿄(나리타·하네다), 오사카(간사이)를 오가는 {data.routes}개 노선의 항공권 가격을 {data.collectStart|date}부터 {data.collectEnd|date}까지 모았습니다.",
      "body2": "SerpApi로 Google Flights 검색 결과를 가져오고, GitHub Actions가 매일 실행합니다. 원본 {data.rawRows}행 중 오류를 걸러 {data.filteredRows}행을 썼습니다.",
      "body3": "가까운 출발일은 매일, 먼 출발일은 매주 한 번 수집해서 먼 구간은 데이터가 성깁니다. 지형에서 점이 듬성한 곳이 그 구간입니다."
    },
    "insight": {
      "heading": "핵심 인사이트",
      "body1": "출발이 지난 {model.realizedFlights}편의 가격을 날마다 추적했습니다. 출발 직전({model.bookingCurve.0.label})에는 같은 편 평균보다 {model.bookingCurve.0.pct|signed}% 비쌌고, {model.bookingCurve.5.label} 구간이 {model.bookingCurve.5.pct|signed}%로 가장 쌌습니다. 폭 약 {model.curveWidth}%p의 U자 곡선입니다.",
      "body2": "하지만 가격을 더 크게 흔드는 것은 언제 사느냐보다 언제 떠나느냐였습니다. 공휴일과 주말 출발편이 지형의 봉우리로 솟아 있습니다."
    },
    "bubble": {
      "heading": "R² 거품 빼기",
      "body1": "처음 얻은 R² {model.bubble.firstR2}는 하네다 노선 하나만의 값이었습니다.",
      "body2": "이후 직항으로 표시됐지만 소요시간은 경유 여정인 행 {data.removedImplausible}개를 찾아 걸러냈습니다. MAE는 {model.bubble.maeBefore}원에서 {model.bubble.maeAfter}원으로 거의 그대로였고, R²만 {model.bubble.r2Before}에서 {model.bubble.r2After}로 내려갔습니다. 이 행들이 R² 분모의 {model.bubble.denomShare}%를 차지하고 있었습니다.",
      "body3": "그래서 R²만 보지 않고 MAE와 데이터 무결성을 함께 봅니다. 필터 조건이 달라 지금 R²와 예전 R²를 직접 비교하지는 않습니다."
    },
    "validation": {
      "heading": "검증 설계",
      "body1": "같은 모델을 세 가지 방식으로 평가했습니다. 운영과 같은 조건인 TimeSeriesSplit을 대표값으로 씁니다.",
      "body2": "GroupKFold로 처음 보는 출발일을 평가하자, 새 출발일에서는 lookup 통계가 기본값으로 떨어지는 학습·서비스 불일치가 드러났습니다. lookup을 넣은 서비스 구성은 R² {model.gkfWithLookup.r2}, MAE {model.gkfWithLookup.mae}원이었습니다. lookup 구성 {model.lookupVariants}가지를 각각 다시 튜닝해 비교했습니다.",
      "table": {
        "caption": "평가 방식별 성능",
        "method": "평가 방식",
        "tss": "TimeSeriesSplit (운영 기준)",
        "gkf": "GroupKFold (처음 보는 출발일, lookup 없이)",
        "kfold": "K-Fold (참고 상한)",
        "maeUnit": "원"
      }
    },
    "interval": {
      "heading": "예측 구간 보정",
      "body1": "가격 하나만 내놓지 않고 {model.interval.level}% 예측 구간을 함께 냅니다.",
      "body2": "고정된 구간은 최근 데이터일수록 실제 포함률이 {model.interval.driftLow}%까지 떨어졌습니다. 분포가 이동하는 추세를 반영해 구간 폭을 고르도록 바꿨고, 가장 최근 구간에서 {model.interval.coverage}%를 포함했습니다."
    },
    "limits": {
      "heading": "한계와 다음 단계",
      "body1": "같은 편의 직전 관측가를 그대로 쓰는 단순 기준선의 MAE는 {model.baselineMae}원으로, 모델({model.tss.mae}원)과 거의 차이가 없습니다.",
      "body2": "추천은 {model.reco.buyNow}%가 '지금 구매'입니다. 실제 가격을 추적해 보니 출발 두 달 안쪽에서는 기다리면 평균적으로 손해였고, 모델도 같은 방향이었습니다.",
      "body3": "다음 단계는 같은 편의 최근 관측가를 피처로 넣어 기준선을 넘는 것입니다."
    }
  },
  "stack": {
    "heading": "기술 스택",
    "collect": { "title": "수집", "body": "Python · SerpApi · requests · tenacity · GitHub Actions" },
    "external": { "title": "외부 데이터", "body": "yfinance(원/엔 환율) · workalendar(한·일 공휴일) · 유가" },
    "model": { "title": "모델", "body": "NeuralProphet · XGBoost · Optuna · 분위수 회귀 · SHAP" },
    "serve": { "title": "서비스·품질", "body": "Streamlit · Plotly · pytest(테스트 파일 {model.testFiles}개)" }
  },
  "contact": {
    "heading": "연락처",
    "passenger": "탑승객",
    "email": "이메일",
    "github": "GitHub",
    "linkedin": "LinkedIn",
    "resume": "이력서 PDF",
    "resumePending": "준비 중",
    "emailFallback": "이메일은 JavaScript를 켜면 보입니다"
  },
  "summary": {
    "title": "30초 요약",
    "close": "닫기",
    "resultsHeading": "대표 프로젝트: 한·일 항공권 가격 예측",
    "r1": "한·일 항공권 {data.filteredRows}행을 직접 수집·정제",
    "r2": "운영 기준(TimeSeriesSplit) R² {model.tss.r2}, MAE {model.tss.mae}원",
    "r3": "{model.interval.level}% 예측 구간의 실제 포함률 {model.interval.coverage}%"
  },
  "notFound": { "title": "페이지를 찾을 수 없습니다", "home": "첫 화면으로" }
}
```

- [ ] **Step 5: 한국어 검증 + ⏸ 사용자 검토 체크포인트**

임시로 `content/en.json`, `content/ja.json`을 `ko.json`의 복사본으로 만들고 `npx vitest run tests/unit/content.test.ts`를 돌려 ko 규칙 테스트가 통과하는지 확인한다. 그다음 **사용자에게 ko.json 문구 검토를 요청하고 답을 받을 때까지 멈춘다.** 수정 요청은 반영하고 테스트를 다시 돌린다.

- [ ] **Step 6: 영어·일본어 초안**

검토를 마친 `ko.json`을 키 하나씩 번역해 `en.json`, `ja.json`을 만든다. 규칙:
- 키와 자리표시(`{...}`)는 한 글자도 바꾸지 않는다. 문장 안 위치는 언어에 맞게 옮겨도 된다
- 톤은 사실만, 담백하게. 영어는 짧은 평서문, 일본어는 です・ます체
- 고정값: `hero.nameSub` en `""`, ja `"崔夏林（チェ・ハリム）"`. `about.education` en `"B.S. in Computer Software, The University of Suwon · Expected {profile.graduation|month}"`, ja `"水原大学 コンピュータソフトウェア学科 · {profile.graduation|month}卒業見込み"`
- `langHint.offer`는 **그 언어로 된 안내**다: en `"View in English →"`, ja `"日本語で見る →"`
- 원 단위: en `"₩{model.tss.mae}"` 식으로 앞에 ₩, ja `"{model.tss.mae}ウォン"`. `case.validation.table.maeUnit` en `"KRW"`, ja `"ウォン"`
- `nav.summary`/`summary.title`: en `"30-second summary"`, ja `"30秒で分かる要約"`
- 일본어는 공개 전에 사용자가 섭외한 검수자가 확인한다(스펙 §14). 이 단계에서는 초안까지만

- [ ] **Step 7: 통과 확인** — Run: `npx vitest run tests/unit/content.test.ts` / Expected: 모두 PASS

- [ ] **Step 8: Commit**

```bash
git add content src/lib/content.ts tests/unit/content.test.ts
git commit -m "feat: add ko/en/ja content with number-free copy rules"
```

---

### Task 6: 언어별 라우팅, 공통 문서 틀, 언어 전환·안내, 메타데이터, 404, sitemap

**Files:**
- Create: `src/lib/site.ts`, `src/components/RootDocument.tsx`, `src/components/HomePage.tsx`, `src/components/LangSwitch.tsx`, `src/components/LangHint.tsx`, `app/(en)/layout.tsx`, `app/(en)/en/page.tsx`, `app/(ja)/layout.tsx`, `app/(ja)/ja/page.tsx`, `app/global-not-found.tsx`, `app/sitemap.ts`, `app/robots.ts`, `app/icon.svg`, `tests/unit/site.test.ts`
- Modify: `docs/superpowers/specs/2026-09-23-portfolio-design.md` (§12에 "계획 4에서 공개하기 전까지 noindex + robots.txt Disallow" 한 줄)
- Modify: `app/(ko)/layout.tsx`, `app/(ko)/page.tsx` (Task 1 임시본 교체)

**Interfaces:**
- Consumes: `LOCALES`, `LOCALE_PATH`, `Locale` (Task 4), `getT`, `dictionaries` (Task 5), 글꼴 (Task 1)
- Produces:
  - `siteUrl(): URL` — `VERCEL_PROJECT_PRODUCTION_URL`이 있으면 `https://<그 값>`, 없으면 `http://localhost:3000`
  - `LAUNCHED: boolean` (지금은 `false`, 계획 4에서 `true`)
  - `buildMetadata(locale: Locale, launched?: boolean): Metadata` — title, description, `alternates.canonical`, `alternates.languages`(ko/en/ja + `x-default` → `/`), `launched`가 false면 `robots: { index: false, follow: false }`
  - `<RootDocument locale extraClass?>{children}</RootDocument>` — `<html lang>`, 글꼴 클래스, 건너뛰기 링크, `<LangHint>`
  - `<HomePage locale />` — 이 Task에서는 `<Header>` 없이 `<main id="main">`만(Task 7·8이 채운다)
  - `<LangSwitch current: Locale label: string />` — 클릭 시 `localStorage['signal.lang']` 저장
  - `<LangHint current: Locale offers: Record<Locale,string> dismiss: string />`

- [ ] **Step 1: 실패하는 테스트 `tests/unit/site.test.ts`**

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildMetadata, siteUrl } from '@/lib/site';

afterEach(() => vi.unstubAllEnvs());

describe('site metadata', () => {
  it('Vercel 운영 주소가 있으면 https로 쓴다', () => {
    vi.stubEnv('VERCEL_PROJECT_PRODUCTION_URL', 'signal.vercel.app');
    expect(siteUrl().href).toBe('https://signal.vercel.app/');
  });

  it('언어별 canonical과 hreflang', () => {
    const m = buildMetadata('en');
    expect(m.alternates?.canonical).toBe('/en/');
    expect(m.alternates?.languages).toEqual({ ko: '/', en: '/en/', ja: '/ja/', 'x-default': '/' });
    expect(typeof m.title).toBe('string');
  });

  it('공개 전에는 검색 노출을 막고, 공개 후에는 연다', () => {
    expect(buildMetadata('ko', false).robots).toEqual({ index: false, follow: false });
    expect(buildMetadata('ko', true).robots).toBeUndefined();
  });
});
```

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run tests/unit/site.test.ts` / Expected: FAIL `Cannot find module '@/lib/site'`

- [ ] **Step 3: `src/lib/site.ts`**

```ts
import type { Metadata } from 'next';
import { getT } from './content';
import { LOCALE_PATH, type Locale } from './i18n';

// 계획 4에서 공개할 때 true로 바꾼다. false인 동안 noindex + robots.txt Disallow.
export const LAUNCHED = false;

export function siteUrl(): URL {
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return new URL(host ? `https://${host}` : 'http://localhost:3000');
}

export function buildMetadata(locale: Locale, launched = LAUNCHED): Metadata {
  const t = getT(locale);
  return {
    ...(launched ? {} : { robots: { index: false, follow: false } }),
    metadataBase: siteUrl(),
    title: t('meta.title'),
    description: t('meta.description'),
    alternates: {
      canonical: LOCALE_PATH[locale],
      languages: { ko: LOCALE_PATH.ko, en: LOCALE_PATH.en, ja: LOCALE_PATH.ja, 'x-default': LOCALE_PATH.ko },
    },
  };
}
```

- [ ] **Step 4: 통과 확인** — Run: `npx vitest run tests/unit/site.test.ts` / Expected: 3 passed

- [ ] **Step 5: `src/components/LangSwitch.tsx`**

```tsx
'use client';
import { LOCALE_PATH, LOCALES, type Locale } from '@/lib/i18n';

export function LangSwitch({ current, label }: { current: Locale; label: string }) {
  const remember = (l: Locale) => {
    try { localStorage.setItem('signal.lang', l); } catch { /* 저장 불가 환경은 무시 */ }
  };
  return (
    <nav aria-label={label} className="lang-switch mono">
      {LOCALES.map((l) => (
        <a key={l} href={LOCALE_PATH[l]} hrefLang={l} lang={l}
           aria-current={l === current ? 'true' : undefined} onClick={() => remember(l)}>
          {l.toUpperCase()}
        </a>
      ))}
    </nav>
  );
}
```

- [ ] **Step 6: `src/components/LangHint.tsx`**

```tsx
'use client';
import { useEffect, useState } from 'react';
import { LOCALE_PATH, LOCALES, type Locale } from '@/lib/i18n';

function preferred(): Locale | null {
  try {
    const saved = localStorage.getItem('signal.lang');
    if (saved && (LOCALES as readonly string[]).includes(saved)) return saved as Locale;
  } catch { /* 무시 */ }
  for (const tag of navigator.languages ?? [navigator.language]) {
    const base = tag.slice(0, 2).toLowerCase();
    if ((LOCALES as readonly string[]).includes(base)) return base as Locale;
  }
  return null;
}

export function LangHint({ current, offers, dismiss }: { current: Locale; offers: Record<Locale, string>; dismiss: string }) {
  const [target, setTarget] = useState<Locale | null>(null);
  useEffect(() => {
    try { if (sessionStorage.getItem('signal.hintDismissed')) return; } catch { /* 무시 */ }
    const p = preferred();
    if (p && p !== current) setTarget(p);
  }, [current]);
  if (!target) return null;
  const close = () => {
    try { sessionStorage.setItem('signal.hintDismissed', '1'); } catch { /* 무시 */ }
    setTarget(null);
  };
  return (
    <aside className="lang-hint" lang={target}>
      <a href={LOCALE_PATH[target]} hrefLang={target}>{offers[target]}</a>
      <button type="button" onClick={close} aria-label={dismiss}>×</button>
    </aside>
  );
}
```

- [ ] **Step 7: `src/components/RootDocument.tsx`**

```tsx
import '@/styles/globals.css';
import { LangHint } from './LangHint';
import { dictionaries, getT } from '@/lib/content';
import type { Locale } from '@/lib/i18n';
import { baseFontVars } from '@/styles/fonts';

export function RootDocument({ locale, extraClass = '', children }: { locale: Locale; extraClass?: string; children: React.ReactNode }) {
  const t = getT(locale);
  const offers = { ko: dictionaries.ko.langHint.offer, en: dictionaries.en.langHint.offer, ja: dictionaries.ja.langHint.offer };
  return (
    <html lang={locale} className={`${baseFontVars} ${extraClass}`.trim()}>
      <body>
        <a className="skip" href="#main">{t('nav.skip')}</a>
        <LangHint current={locale} offers={offers} dismiss={t('langHint.dismiss')} />
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 8: `src/components/HomePage.tsx`** (Task 7·8에서 확장)

```tsx
import type { Locale } from '@/lib/i18n';

export function HomePage({ locale }: { locale: Locale }) {
  return <main id="main" data-locale={locale} />;
}
```

- [ ] **Step 9: 언어별 layout·page**

`app/(ko)/layout.tsx`:
```tsx
import { RootDocument } from '@/components/RootDocument';
import { buildMetadata } from '@/lib/site';

export const metadata = buildMetadata('ko');

export default function Layout({ children }: { children: React.ReactNode }) {
  return <RootDocument locale="ko">{children}</RootDocument>;
}
```
`app/(ko)/page.tsx`:
```tsx
import { HomePage } from '@/components/HomePage';

export default function Page() {
  return <HomePage locale="ko" />;
}
```
`app/(en)/layout.tsx`: 위 ko layout에서 `'ko'`/`"ko"`를 `'en'`/`"en"`으로 바꾼 동일 코드.
`app/(en)/en/page.tsx`: 위 ko page에서 `locale="en"`.
`app/(ja)/layout.tsx`:
```tsx
import { RootDocument } from '@/components/RootDocument';
import { buildMetadata } from '@/lib/site';
import { jp } from '@/styles/fonts';

export const metadata = buildMetadata('ja');

export default function Layout({ children }: { children: React.ReactNode }) {
  return <RootDocument locale="ja" extraClass={jp.variable}>{children}</RootDocument>;
}
```
`app/(ja)/ja/page.tsx`: ko page에서 `locale="ja"`.

- [ ] **Step 10: `app/global-not-found.tsx`** (3개 언어를 한 페이지에)

```tsx
import '@/styles/globals.css';
import { dictionaries } from '@/lib/content';
import { LOCALE_PATH, LOCALES } from '@/lib/i18n';
import { baseFontVars, jp } from '@/styles/fonts';

export const metadata = { title: '404 — SIGNAL' };

export default function GlobalNotFound() {
  return (
    <html lang="ko" className={`${baseFontVars} ${jp.variable}`}>
      <body>
        <main id="main" className="wrap not-found">
          <p className="eyebrow">GATE 404 — NOT FOUND</p>
          {LOCALES.map((l) => (
            <p key={l} lang={l}>
              {dictionaries[l].notFound.title} · <a href={LOCALE_PATH[l]}>{dictionaries[l].notFound.home}</a>
            </p>
          ))}
        </main>
      </body>
    </html>
  );
}
```

- [ ] **Step 11: `app/sitemap.ts`, `app/robots.ts`, `app/icon.svg`**

```ts
import type { MetadataRoute } from 'next';
import { LOCALE_PATH, LOCALES } from '@/lib/i18n';
import { siteUrl } from '@/lib/site';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  const languages = Object.fromEntries(LOCALES.map((l) => [l, new URL(LOCALE_PATH[l], base).href]));
  return LOCALES.map((l) => ({ url: new URL(LOCALE_PATH[l], base).href, alternates: { languages } }));
}
```
`app/robots.ts`:
```ts
import type { MetadataRoute } from 'next';
import { LAUNCHED, siteUrl } from '@/lib/site';

export const dynamic = 'force-static';

export default function robots(): MetadataRoute.Robots {
  return LAUNCHED
    ? { rules: { userAgent: '*', allow: '/' }, sitemap: new URL('/sitemap.xml', siteUrl()).href }
    : { rules: { userAgent: '*', disallow: '/' } };
}
```
`app/icon.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#070B16"/><path d="M4 22c4-10 8-10 12-4s8 6 12-8" fill="none" stroke="#8FB8FF" stroke-width="2.5" stroke-linecap="round"/><circle cx="24" cy="12" r="3" fill="#FFB547"/></svg>
```

- [ ] **Step 12: 언어 전환·안내 스타일 — `src/styles/globals.css` 끝에 추가**

```css
.lang-switch { display: flex; gap: 4px; font-size: 0.8rem; }
.lang-switch a { color: var(--mute); text-decoration: none; padding: 4px 8px; border: 1px solid transparent; border-radius: 4px; }
.lang-switch a[aria-current] { color: var(--tx); border-color: var(--line); }
.lang-hint { position: fixed; left: 16px; bottom: 16px; z-index: 50; display: flex; gap: 8px; align-items: center;
  background: var(--bg2); border: 1px solid var(--line); border-radius: 8px; padding: 8px 12px; }
.lang-hint button { background: none; border: 0; color: var(--mute); font-size: 1.25rem; cursor: pointer; min-width: 32px; min-height: 32px; }
.not-found { padding-block: 25vh; display: grid; gap: 12px; }
```

- [ ] **Step 13: 빌드 확인**

Run: `npm run typecheck && npm test && npm run build && ls out/index.html out/en/index.html out/ja/index.html out/404.html out/sitemap.xml && grep -o '<html lang="[a-z]*"' out/ja/index.html`
Expected: 파일 5개 존재, 마지막 출력 `<html lang="ja"`. `grep -c 'noindex' out/index.html`이 1 이상, `cat out/robots.txt`에 `Disallow: /`. `out/404.html`에 "GATE 404"가 들어 있는지 `grep -c "GATE 404" out/404.html`로 확인(1 이상). 404.html이 Next 기본 페이지면 `experimental.globalNotFound` 설정을 다시 확인한다.

- [ ] **Step 14: Commit**

```bash
git add -A
git commit -m "feat: per-locale root layouts, language switch/hint, metadata, 404, sitemap"
```

---

### Task 7: 상단 바 — 이력서 버튼, 30초 요약 대화창, 휴대폰 메뉴

**Files:**
- Create: `src/lib/resume.ts`, `src/components/Header.tsx`, `src/components/HeaderMore.tsx`, `src/components/Summary.tsx`, `tests/unit/resume.test.ts`, `public/resume/.gitkeep`
- Modify: `src/components/HomePage.tsx`, `src/styles/globals.css`, `content/ko.json`·`en.json`·`ja.json` (`nav.menu` 추가)

**Interfaces:**
- Consumes: `getT` (Task 5), `LangSwitch` (Task 6), `facts` (Task 3)
- Produces:
  - `resumeHref(locale: Locale, publicDir?: string): string | null` — `public/resume/{locale}.pdf`가 있으면 `/resume/{locale}.pdf`, 없으면 `null`
  - `<ResumeLink href: string|null label pendingLabel className? />` (Header.tsx에서 export, Contact에서 재사용)
  - `<SummaryButton label />`, `<SummaryDialog title close resultsHeading education keywords results: string[] resumeHref resumeLabel resumePendingLabel />` (Summary.tsx. 대화창 id는 `summary-dialog`)
  - `<HeaderMore label>{children}</HeaderMore>` — 휴대폰 폭(≤640px)에서만 접히는 메뉴
  - `<Header locale />`

**휴대폰 상단 바 설계:** 폭 640px 이하에서는 한 줄에 `SIGNAL` · `이력서` · `메뉴`만 보인다. `메뉴`를 누르면 아래로 `30초 요약`과 `KO · EN · JA`가 펼쳐진다. 데스크톱에서는 메뉴 버튼이 숨고 모든 버튼이 한 줄에 보인다. `<dialog>`는 접히는 영역(`display:none`) 안에 있으면 열리지 않으므로, 여는 버튼(`SummaryButton`)과 대화창(`SummaryDialog`)을 나눠 대화창은 메뉴 밖에 둔다.

- [ ] **Step 1: 실패하는 테스트 `tests/unit/resume.test.ts`**

```ts
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { resumeHref } from '@/lib/resume';

describe('resumeHref', () => {
  const dir = mkdtempSync(join(tmpdir(), 'resume-'));
  mkdirSync(join(dir, 'resume'));
  writeFileSync(join(dir, 'resume', 'ko.pdf'), '%PDF-1.4');

  it('파일이 있으면 경로', () => expect(resumeHref('ko', dir)).toBe('/resume/ko.pdf'));
  it('파일이 없으면 null', () => expect(resumeHref('ja', dir)).toBeNull());
});
```

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run tests/unit/resume.test.ts` / Expected: FAIL `Cannot find module '@/lib/resume'`

- [ ] **Step 3: `src/lib/resume.ts`**

```ts
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Locale } from './i18n';

export function resumeHref(locale: Locale, publicDir = join(process.cwd(), 'public')): string | null {
  return existsSync(join(publicDir, 'resume', `${locale}.pdf`)) ? `/resume/${locale}.pdf` : null;
}
```

- [ ] **Step 4: 통과 확인** — Run: `npx vitest run tests/unit/resume.test.ts` / Expected: 2 passed. 그리고 `touch public/resume/.gitkeep`.

- [ ] **Step 5: `nav.menu` 문구 추가** — `content/ko.json`의 `nav`에 `"menu": "메뉴"`, `en.json`에 `"menu": "Menu"`, `ja.json`에 `"menu": "メニュー"`. Run: `npx vitest run tests/unit/content.test.ts` / Expected: PASS(키 목록 일치)

- [ ] **Step 6: `src/components/Summary.tsx`** (네이티브 `<dialog>`의 `showModal()`이 배경을 inert로 만들고 Esc로 닫는다. 닫히면 마지막으로 연 버튼으로 포커스를 돌려준다)

```tsx
'use client';

const DIALOG_ID = 'summary-dialog';
let lastOpener: HTMLElement | null = null;

export function SummaryButton({ label }: { label: string }) {
  return (
    <button type="button" className="pill" aria-haspopup="dialog" onClick={(e) => {
      lastOpener = e.currentTarget;
      (document.getElementById(DIALOG_ID) as HTMLDialogElement | null)?.showModal();
    }}>
      {label}
    </button>
  );
}

type DialogProps = {
  title: string; close: string; resultsHeading: string;
  education: string; keywords: string; results: string[];
  resumeHref: string | null; resumeLabel: string; resumePendingLabel: string;
};

export function SummaryDialog(p: DialogProps) {
  return (
    <dialog id={DIALOG_ID} className="summary" aria-labelledby="summary-title" onClose={() => lastOpener?.focus()}>
      <p className="eyebrow">{p.title}</p>
      <h2 id="summary-title" className="display">CHOI HALIM</h2>
      <p className="mono">ML ENGINEER · {p.keywords}</p>
      <p className="muted">{p.education}</p>
      <h3>{p.resultsHeading}</h3>
      <ul>{p.results.map((r) => <li key={r}>{r}</li>)}</ul>
      <form method="dialog" className="summary-actions">
        {p.resumeHref
          ? <a className="pill" href={p.resumeHref} download>{p.resumeLabel}</a>
          : <span className="pill is-pending" aria-disabled="true">{p.resumePendingLabel}</span>}
        <button className="pill">{p.close}</button>
      </form>
    </dialog>
  );
}
```

- [ ] **Step 7: `src/components/HeaderMore.tsx`**

```tsx
'use client';
import { useState } from 'react';

export function HeaderMore({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="pill menu-toggle" aria-expanded={open} aria-controls="header-more"
              onClick={() => setOpen((v) => !v)}>
        {label}
      </button>
      <div id="header-more" className="header-more" data-open={open}>{children}</div>
    </>
  );
}
```

- [ ] **Step 8: `src/components/Header.tsx`**

```tsx
import { HeaderMore } from './HeaderMore';
import { LangSwitch } from './LangSwitch';
import { SummaryButton, SummaryDialog } from './Summary';
import { getT } from '@/lib/content';
import type { Locale } from '@/lib/i18n';
import { resumeHref } from '@/lib/resume';

export function ResumeLink({ href, label, pendingLabel, className = 'pill' }: { href: string | null; label: string; pendingLabel: string; className?: string }) {
  return href
    ? <a className={className} href={href} download>{label}</a>
    : <span className={`${className} is-pending`} aria-disabled="true">{pendingLabel}</span>;
}

export function Header({ locale }: { locale: Locale }) {
  const t = getT(locale);
  const resume = resumeHref(locale);
  return (
    <header className="site-header">
      <span className="brand display">SIGNAL</span>
      <div className="header-actions">
        <ResumeLink href={resume} label={t('nav.resume')} pendingLabel={t('nav.resumePending')} />
        <HeaderMore label={t('nav.menu')}>
          <SummaryButton label={t('nav.summary')} />
          <LangSwitch current={locale} label={t('nav.language')} />
        </HeaderMore>
      </div>
      <SummaryDialog
        title={t('summary.title')} close={t('summary.close')}
        resultsHeading={t('summary.resultsHeading')} education={t('about.education')} keywords={t('hero.keywords')}
        results={[t('summary.r1'), t('summary.r2'), t('summary.r3')]}
        resumeHref={resume} resumeLabel={t('nav.resume')} resumePendingLabel={t('nav.resumePending')}
      />
    </header>
  );
}
```

- [ ] **Step 9: `HomePage.tsx` 갱신**

```tsx
import { Header } from './Header';
import type { Locale } from '@/lib/i18n';

export function HomePage({ locale }: { locale: Locale }) {
  return (
    <>
      <Header locale={locale} />
      <main id="main" data-locale={locale} />
    </>
  );
}
```

- [ ] **Step 10: 스타일 추가 (`globals.css` 끝)**

```css
.site-header { position: sticky; top: 0; z-index: 40; display: flex; justify-content: space-between; align-items: center;
  gap: 12px; padding: 12px 16px; background: rgba(7, 11, 22, 0.8); backdrop-filter: blur(8px); border-bottom: 1px solid var(--line); }
.brand { font-size: 1rem; letter-spacing: 0.1em; }
.header-actions { display: flex; gap: 8px; align-items: center; }
.header-more { display: flex; gap: 8px; align-items: center; }
.menu-toggle { display: none; }
.pill { font: 600 0.8rem var(--font-mono); color: var(--tx); background: none; border: 1px solid var(--line); border-radius: 999px;
  padding: 6px 14px; text-decoration: none; cursor: pointer; min-height: 32px; display: inline-flex; align-items: center; }
.pill:hover { border-color: var(--dot); }
.pill.is-pending { color: var(--mute); border-style: dashed; cursor: not-allowed; }
@media (max-width: 640px) {
  .menu-toggle { display: inline-flex; }
  .header-more { display: none; position: absolute; top: 100%; left: 0; right: 0; padding: 12px 16px;
    justify-content: space-between; background: var(--bg); border-bottom: 1px solid var(--line); }
  .header-more[data-open="true"] { display: flex; }
}
.summary { margin: auto; max-width: min(560px, 100% - 32px); background: var(--bg2); color: var(--tx);
  border: 1px solid var(--line); border-radius: 12px; padding: 28px; }
.summary::backdrop { background: rgba(7, 11, 22, 0.7); }
.summary h2 { font-size: 2rem; margin-top: 4px; }
.summary ul { margin: 8px 0 0 20px; }
.summary-actions { display: flex; gap: 8px; margin-top: 20px; }
```

- [ ] **Step 11: 확인** — Run: `npm run typecheck && npm test && npm run build && grep -c "이력서 준비 중" out/index.html` / Expected: 1 이상(PDF가 아직 없으므로)

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "feat: header with resume button, summary dialog, mobile menu"
```

---

### Task 8: 본문 섹션 — 첫 화면, 소개, 케이스 스터디, 기술 스택, 연락처

**Files:**
- Create: `src/lib/email.ts`, `src/components/EmailLink.tsx`, `src/components/sections/Hero.tsx`, `About.tsx`, `CaseStudy.tsx`, `ValidationTable.tsx`, `Stack.tsx`, `Contact.tsx`, `tests/unit/email.test.ts`
- Modify: `src/components/HomePage.tsx`, `src/styles/globals.css`

**Interfaces:**
- Consumes: `getT` (Task 5), `facts`, `codeUrl`, `CodeChapter` (Task 3), `formatValue`, `Locale` (Task 4), `ResumeLink` (Task 7), `resumeHref` (Task 7)
- Produces: `revealEmail(reversed: string): string`, 섹션 컴포넌트 각각 `({ locale }: { locale: Locale })`. 각 섹션 루트에 `id`와 `data-section`(계획 3의 카메라 연동용): `hero`, `about`, `case`(챕터 `article`마다 `data-chapter="problem|insight|bubble|validation|interval|limits"`), `stack`, `contact`. 섹션 4(데모) 자리는 계획 2가 `case`와 `stack` 사이에 끼운다.

- [ ] **Step 1: 실패하는 테스트 `tests/unit/email.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { facts } from '@/lib/facts';
import { revealEmail } from '@/lib/email';

describe('revealEmail', () => {
  it('뒤집힌 주소를 되돌린다', () => {
    expect(revealEmail('moc.elpmaxe@a')).toBe('a@example.com');
  });
  it('facts의 주소가 올바른 형태로 복원된다', () => {
    expect(revealEmail(facts.contact.emailReversed)).toMatch(/^[^@\s]+@[^@\s]+\.[a-z]+$/);
  });
});
```

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run tests/unit/email.test.ts` / Expected: FAIL `Cannot find module '@/lib/email'`

- [ ] **Step 3: `src/lib/email.ts`**

```ts
export function revealEmail(reversed: string): string {
  return [...reversed].reverse().join('');
}
```

- [ ] **Step 4: 통과 확인** — Run: `npx vitest run tests/unit/email.test.ts` / Expected: 2 passed

- [ ] **Step 5: `src/components/EmailLink.tsx`** (서버 HTML에는 대체 문구만, 브라우저에서 주소를 조립)

```tsx
'use client';
import { useEffect, useState } from 'react';
import { revealEmail } from '@/lib/email';

export function EmailLink({ reversed, fallback }: { reversed: string; fallback: string }) {
  const [email, setEmail] = useState<string | null>(null);
  useEffect(() => setEmail(revealEmail(reversed)), [reversed]);
  if (!email) return <span className="muted">{fallback}</span>;
  return <a href={`mailto:${email}`} data-testid="email">{email}</a>;
}
```

- [ ] **Step 6: `src/components/sections/Hero.tsx`**

```tsx
import { getT } from '@/lib/content';
import type { Locale } from '@/lib/i18n';

export function Hero({ locale }: { locale: Locale }) {
  const t = getT(locale);
  const sub = t('hero.nameSub');
  return (
    <section id="hero" data-section="hero" className="hero wrap">
      <h1 className="display hero-name">CHOI HALIM</h1>
      {sub && <p className="hero-sub" lang={locale}>{sub}</p>}
      <p className="mono hero-role">{t('hero.role')}</p>
      <p className="hero-keywords">{t('hero.keywords')}</p>
    </section>
  );
}
```

- [ ] **Step 7: `src/components/sections/About.tsx`**

```tsx
import { getT } from '@/lib/content';
import type { Locale } from '@/lib/i18n';

const SKILLS = ['collection', 'modeling', 'validation', 'interval'] as const;

export function About({ locale }: { locale: Locale }) {
  const t = getT(locale);
  return (
    <section id="about" data-section="about" className="wrap" aria-labelledby="about-h">
      <p className="eyebrow">ABOUT</p>
      <h2 id="about-h" className="display">{t('about.heading')}</h2>
      <p className="muted">{t('about.education')}</p>
      <p>{t('about.body1')}</p>
      <p>{t('about.body2')}</p>
      <p>{t('about.body3')}</p>
      <h3>{t('about.skillsHeading')}</h3>
      <ul className="skills">{SKILLS.map((s) => <li key={s}>{t(`about.skills.${s}`)}</li>)}</ul>
    </section>
  );
}
```

- [ ] **Step 8: `src/components/sections/ValidationTable.tsx`**

```tsx
import { getT } from '@/lib/content';
import { facts } from '@/lib/facts';
import { formatValue, type Locale } from '@/lib/i18n';

const ROWS = [
  { key: 'tss', score: facts.model.tss, main: true },
  { key: 'gkf', score: facts.model.gkfNoLookup, main: false },
  { key: 'kfold', score: facts.model.kfold, main: false },
] as const;

export function ValidationTable({ locale }: { locale: Locale }) {
  const t = getT(locale);
  const n = (v: number) => formatValue(v, undefined, locale);
  return (
    <table className="vtable mono">
      <caption>{t('case.validation.table.caption')}</caption>
      <thead>
        <tr>
          <th scope="col">{t('case.validation.table.method')}</th>
          <th scope="col">R²</th>
          <th scope="col">MAE ({t('case.validation.table.maeUnit')})</th>
          <th scope="col">MAPE</th>
        </tr>
      </thead>
      <tbody>
        {ROWS.map((r) => (
          <tr key={r.key} className={r.main ? 'is-main' : undefined}>
            <th scope="row">{t(`case.validation.table.${r.key}`)}</th>
            <td>{n(r.score.r2)}</td>
            <td>{n(r.score.mae)}</td>
            <td>{n(r.score.mape)}%</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 9: `src/components/sections/CaseStudy.tsx`**

```tsx
import { ValidationTable } from './ValidationTable';
import { getT } from '@/lib/content';
import { codeUrl, type CodeChapter } from '@/lib/facts';
import type { Locale } from '@/lib/i18n';

const CHAPTERS: { id: CodeChapter; gate: string; paras: number }[] = [
  { id: 'problem', gate: 'GATE 01 — PROBLEM', paras: 3 },
  { id: 'insight', gate: 'GATE 02 — INSIGHT', paras: 2 },
  { id: 'bubble', gate: 'GATE 03 — R² BUBBLE', paras: 3 },
  { id: 'validation', gate: 'GATE 04 — VALIDATION', paras: 2 },
  { id: 'interval', gate: 'GATE 05 — INTERVAL', paras: 2 },
  { id: 'limits', gate: 'GATE 06 — LIMITS', paras: 3 },
];

export function CaseStudy({ locale }: { locale: Locale }) {
  const t = getT(locale);
  return (
    <section id="case" data-section="case" className="wrap" aria-labelledby="case-h">
      <p className="eyebrow">CASE STUDY</p>
      <h2 id="case-h" className="display">{t('case.heading')}</h2>
      {CHAPTERS.map((c) => (
        <article key={c.id} data-chapter={c.id} className="chapter" aria-labelledby={`ch-${c.id}`}>
          <p className="eyebrow">{c.gate}</p>
          <h3 id={`ch-${c.id}`}>{t(`case.${c.id}.heading`)}</h3>
          {Array.from({ length: c.paras }, (_, i) => <p key={i}>{t(`case.${c.id}.body${i + 1}`)}</p>)}
          {c.id === 'validation' && <ValidationTable locale={locale} />}
          <a className="code-link mono" href={codeUrl(c.id)} target="_blank" rel="noopener noreferrer">
            {t('case.codeLink')} ↗
          </a>
        </article>
      ))}
    </section>
  );
}
```

- [ ] **Step 10: `src/components/sections/Stack.tsx`**

```tsx
import { getT } from '@/lib/content';
import type { Locale } from '@/lib/i18n';

const STEPS = ['collect', 'external', 'model', 'serve'] as const;

export function Stack({ locale }: { locale: Locale }) {
  const t = getT(locale);
  return (
    <section id="stack" data-section="stack" className="wrap" aria-labelledby="stack-h">
      <p className="eyebrow">STACK</p>
      <h2 id="stack-h" className="display">{t('stack.heading')}</h2>
      <ol className="pipeline">
        {STEPS.map((s) => (
          <li key={s}>
            <strong className="mono">{t(`stack.${s}.title`)}</strong>
            <span>{t(`stack.${s}.body`)}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
```

- [ ] **Step 11: `src/components/sections/Contact.tsx`** (탑승권 카드. LinkedIn이 비면 행 자체를 렌더링하지 않는다)

```tsx
import { EmailLink } from '../EmailLink';
import { ResumeLink } from '../Header';
import { getT } from '@/lib/content';
import { facts } from '@/lib/facts';
import type { Locale } from '@/lib/i18n';
import { resumeHref } from '@/lib/resume';

export function Contact({ locale }: { locale: Locale }) {
  const t = getT(locale);
  const { emailReversed, github, linkedin } = facts.contact;
  return (
    <section id="contact" data-section="contact" className="wrap" aria-labelledby="contact-h">
      <p className="eyebrow">CONTACT</p>
      <h2 id="contact-h" className="display">{t('contact.heading')}</h2>
      <div className="pass">
        <p className="pass-head mono">BOARDING PASS · SIGNAL</p>
        <dl>
          <div><dt className="mono">{t('contact.passenger')}</dt><dd className="display">CHOI HALIM</dd></div>
          <div><dt className="mono">{t('contact.email')}</dt><dd><EmailLink reversed={emailReversed} fallback={t('contact.emailFallback')} /></dd></div>
          <div><dt className="mono">{t('contact.github')}</dt><dd><a href={github} target="_blank" rel="noopener noreferrer">{github.replace('https://', '')}</a></dd></div>
          {linkedin && (
            <div data-testid="linkedin"><dt className="mono">{t('contact.linkedin')}</dt><dd><a href={linkedin} target="_blank" rel="noopener noreferrer">{linkedin.replace('https://', '')}</a></dd></div>
          )}
          <div><dt className="mono">{t('contact.resume')}</dt><dd><ResumeLink href={resumeHref(locale)} label="PDF ↓" pendingLabel={t('contact.resumePending')} /></dd></div>
        </dl>
      </div>
    </section>
  );
}
```

- [ ] **Step 12: `HomePage.tsx` 최종**

```tsx
import { Header } from './Header';
import { About } from './sections/About';
import { CaseStudy } from './sections/CaseStudy';
import { Contact } from './sections/Contact';
import { Hero } from './sections/Hero';
import { Stack } from './sections/Stack';
import type { Locale } from '@/lib/i18n';

export function HomePage({ locale }: { locale: Locale }) {
  return (
    <>
      <Header locale={locale} />
      <main id="main" data-locale={locale}>
        <Hero locale={locale} />
        <About locale={locale} />
        <CaseStudy locale={locale} />
        {/* 계획 2: 데모 섹션이 여기에 들어간다 */}
        <Stack locale={locale} />
        <Contact locale={locale} />
      </main>
    </>
  );
}
```

- [ ] **Step 13: 스타일 추가 (`globals.css` 끝)**

```css
.hero { min-height: 88vh; display: flex; flex-direction: column; justify-content: flex-end; padding-bottom: 12vh; }
.hero-name { font-size: clamp(3rem, 12vw, 8.5rem); }
.hero-sub { margin-top: 8px; color: var(--mute); }
.hero-role { margin-top: 24px; color: var(--amb); letter-spacing: 0.18em; }
.hero-keywords { color: var(--mute); }
.skills { list-style: none; display: grid; gap: 8px; }
.skills li { border-left: 2px solid var(--dot); padding-left: 12px; }
.chapter { padding-block: 48px; border-top: 1px solid var(--line); }
.code-link { display: inline-block; margin-top: 16px; font-size: 0.85rem; }
.vtable { width: 100%; border-collapse: collapse; margin-top: 24px; font-size: 0.9rem; }
.vtable caption { text-align: left; color: var(--mute); margin-bottom: 8px; }
.vtable th, .vtable td { text-align: left; padding: 10px 8px; border-bottom: 1px solid var(--line); }
.vtable td { font-variant-numeric: tabular-nums; }
.vtable .is-main { color: var(--amb); }
.pipeline { list-style: none; display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); counter-reset: step; }
.pipeline li { border: 1px solid var(--line); border-radius: 8px; padding: 16px; display: grid; gap: 6px; }
.pass { border: 1px solid var(--line); border-radius: 12px; overflow: hidden; max-width: 640px; background: rgba(19, 32, 58, 0.5); }
.pass-head { background: var(--amb); color: #1a1200; padding: 8px 16px; font-weight: 600; letter-spacing: 0.14em; font-size: 0.8rem; }
.pass dl { display: grid; gap: 14px; padding: 20px 16px; }
.pass dt { font-size: 0.7rem; letter-spacing: 0.14em; color: var(--mute); }
.pass dd { word-break: break-all; }
@media (max-width: 640px) { .vtable { font-size: 0.8rem; } .vtable th, .vtable td { padding: 8px 4px; } }
```

- [ ] **Step 14: 확인**

Run: `npm run typecheck && npm test && npm run build && grep -c "$(node -e "const f=require('./data/facts.json');console.log([...f.contact.emailReversed].reverse().join(''))")" out/index.html; grep -c "GATE 06" out/ja/index.html`
Expected: 첫 grep은 `0`(주소가 HTML에 없음), 두 번째는 1 이상. `npx serve out -l 4173`을 띄워 세 언어 페이지를 눈으로 훑고, 폭 375px에서 가로 스크롤이 없는지 확인한다.

- [ ] **Step 15: ⏸ 화면 확인 체크포인트 (사용자)**

배포 전에 사용자가 처음으로 실제 화면을 보는 단계다. 스크린숏은 저장소가 아니라 스크래치 폴더에 저장한다.

```bash
npx serve out -l 4173 --no-clipboard &
SHOTS="${TMPDIR:-/tmp}/signal-shots"; mkdir -p "$SHOTS"   # 세션 스크래치 폴더가 있으면 그쪽을 쓴다
for p in "ko:/" "ja:/ja/"; do
  name=${p%%:*}; path=${p#*:}
  npx playwright screenshot --full-page --viewport-size=1440,900 "http://localhost:4173$path" "$SHOTS/$name-desktop.png"
  npx playwright screenshot --full-page --viewport-size=390,844  "http://localhost:4173$path" "$SHOTS/$name-mobile.png"
done
kill %1
```
Read 도구로 네 장을 직접 확인해 넘침·겹침·대비 문제가 없는지 먼저 본다. 그다음 사용자에게 로컬 주소(`npx serve out -l 4173`)와 확인할 점(휴대폰 상단 바와 메뉴, 섹션 순서, 글자 크기, 탑승권 카드)을 알리고 **답을 받을 때까지 멈춘다.** 수정 요청은 이 Task 안에서 반영하고 다시 캡처한다. (3D·플립·리빌 같은 연출은 계획 3·4 몫이니, 이 단계에서는 구조와 읽기 쉬운지만 본다.)

- [ ] **Step 16: Commit**

```bash
git add -A
git commit -m "feat: hero, about, case study, stack, contact sections"
```

---

### Task 9: E2E·접근성 테스트 + CI

**Files:**
- Create: `playwright.config.ts`, `tests/e2e/site.spec.ts`, `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: 빌드 산출물 `out/`, 섹션 id·`data-testid` (Task 6~8)
- Produces: `npm run e2e`, GitHub Actions 워크플로 `ci`

- [ ] **Step 1: `playwright.config.ts`**

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  use: { baseURL: 'http://localhost:4173' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: { command: 'npx serve out -l 4173 --no-clipboard', port: 4173, reuseExistingServer: !process.env.CI },
});
```

- [ ] **Step 2: `tests/e2e/site.spec.ts`**

```ts
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import facts from '../../data/facts.json';

const PAGES = [
  { path: '/', lang: 'ko' },
  { path: '/en/', lang: 'en' },
  { path: '/ja/', lang: 'ja' },
];

for (const { path, lang } of PAGES) {
  test(`${path}: lang 속성과 핵심 섹션`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator('html')).toHaveAttribute('lang', lang);
    await expect(page.getByRole('heading', { level: 1, name: 'CHOI HALIM' })).toBeVisible();
    for (const id of ['about', 'case', 'stack', 'contact']) await expect(page.locator(`#${id}`)).toBeAttached();
    await expect(page.locator('[data-chapter]')).toHaveCount(6);
  });

  test(`${path}: axe 위반 없음`, async ({ page }) => {
    await page.goto(path);
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(result.violations).toEqual([]);
  });
}

test.describe('JS 없이', () => {
  test.use({ javaScriptEnabled: false });
  test('모든 섹션 본문이 읽힌다', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: '한·일 항공권, 언제 사야 할까?' })).toBeVisible();
    await expect(page.locator('#case table')).toBeVisible();
    await expect(page.getByText('이메일은 JavaScript를 켜면 보입니다')).toBeVisible();
  });
});

test('이메일: 원본 HTML에는 없고 화면에는 보인다', async ({ page, request }) => {
  const html = await (await request.get('/')).text();
  const email = [...facts.contact.emailReversed].reverse().join('');   // 저장소에 평문 주소를 두지 않는다
  expect(html).not.toContain(email);
  await page.goto('/');
  await expect(page.getByTestId('email')).toHaveText(email);
});

test('LinkedIn 값이 비어 있으면 행이 없다', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('linkedin')).toHaveCount(0);
});

test('이력서 PDF가 없으면 준비 중 표시, 링크 아님', async ({ page }) => {
  await page.goto('/ja/');
  const header = page.locator('.site-header');
  await expect(header.locator('a[download]')).toHaveCount(0);
  await expect(header.locator('[aria-disabled="true"]')).toBeVisible();
});

test('건너뛰기 링크가 첫 Tab에 나타나고 본문으로 이동한다', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: '본문으로 건너뛰기' });
  await expect(skip).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#main$/);
});

test('언어 전환 링크와 선택 기억', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'JA' }).click();
  await expect(page).toHaveURL(/\/ja\/$/);
  expect(await page.evaluate(() => localStorage.getItem('signal.lang'))).toBe('ja');
});

test.describe('브라우저 언어가 일본어일 때', () => {
  test.use({ locale: 'ja-JP' });
  test('한국어 페이지에 일본어 안내만 뜨고 자동 이동은 없다', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('link', { name: '日本語で見る →' })).toBeVisible();
  });
});

for (const bad of ['/nope/', '/en/xyz/']) {
  test(`없는 주소 ${bad}는 3개 언어 404 안내`, async ({ page }) => {
    const res = await page.goto(bad);
    expect(res?.status()).toBe(404);
    await expect(page.getByText('GATE 404')).toBeVisible();
    await expect(page.getByRole('link', { name: '첫 화면으로' })).toHaveAttribute('href', '/');
  });
}

for (const path of ['/', '/en/', '/ja/']) {
  test(`${path} 휴대폰 폭: 상단 바가 한 줄이고 언어 전환이 바로 보인다`, async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto(path);
    expect((await page.locator('.site-header').boundingBox())!.height).toBeLessThan(72);
    await expect(page.getByRole('link', { name: 'EN' })).toBeVisible();
    await expect(page.getByRole('button')).toHaveCount(await page.locator('.lang-hint button').count());
  });
}

test('공개 전: noindex와 robots.txt', async ({ page, request }) => {
  await page.goto('/');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  expect(await (await request.get('/robots.txt')).text()).toContain('Disallow: /');
});

test('모바일 폭에서 가로 스크롤이 없다', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto('/ja/');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
```

- [ ] **Step 3: 브라우저 설치 후 실행**

Run: `npx playwright install chromium && npm run build && npm run e2e`
Expected: 모두 PASS. axe 위반이 나오면 테스트를 느슨하게 하지 말고 원인(대비, 레이블 등)을 고친다. `/en/xyz/`가 404가 아니라 `/en/`을 보여 주면 `serve`의 설정 문제이므로 `serve.json`에 `{"cleanUrls": false}`를 두고 다시 확인한다(Vercel은 정적 export의 `404.html`을 자동으로 쓴다).

- [ ] **Step 4: `.github/workflows/ci.yml`**

```yaml
name: ci
on:
  push: { branches: [main] }
  pull_request:
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 24, cache: npm }
      - run: npm ci
      - run: npm run typecheck
      - run: npm test
      - run: npm run build
      - run: npx playwright install --with-deps chromium
      - run: npm run e2e
        env: { CI: 'true' }
      - if: failure()
        uses: actions/upload-artifact@v4
        with: { name: playwright-report, path: playwright-report }
```
(Python 테스트는 항공권 저장소가 필요해서 CI에서 돌리지 않는다. `npm run facts`를 실행할 때 로컬에서 `pytest scripts/tests`를 함께 돌린다.)

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "test: e2e and axe checks; add CI workflow"
```

---

### Task 10: GitHub 저장소와 Vercel 배포 (⏸ 외부 작업 — 사용자 확인 후)

**Files:**
- Create: `README.md`
- Modify: `CLAUDE.md` (진행 표: 계획 1 완료, 배포 주소 기록, 공개용 항공권 저장소도 noreply 이메일로 커밋하라는 주의)

**Interfaces:**
- Consumes: CI 워크플로 (Task 9)
- Produces: GitHub `hyde0395/signal-ml-portfolio`, Vercel 운영 주소 `https://<project>.vercel.app`

- [ ] **Step 0: `README.md`** (면접관이 저장소에 들어왔을 때 읽는 문서. 사실만, 담백하게. 배포 주소는 Step 5에서 채운다)

````markdown
# SIGNAL — ML Engineer Portfolio

CHOI HALIM(최하림)의 ML 엔지니어 포트폴리오 사이트입니다. 대표 프로젝트인 한·일 항공권 가격 예측(`airfare-forecasting-ml`)을 실제 수집 데이터로 만든 3D 가격 지형 위에서 설명합니다.

- 사이트: (배포 후 기록)
- 언어: 한국어 `/` · English `/en/` · 日本語 `/ja/`

## 구조

| 경로 | 역할 |
|---|---|
| `data/facts.json` | 사이트에 나오는 모든 수치의 유일한 원본 |
| `content/{ko,en,ja}.json` | 문장만. 수치는 `{model.tss.mae}` 같은 자리표시로 참조 |
| `scripts/export_facts.py` | 모델 저장소의 스냅샷(기준일까지 자른 CSV + 학습용 필터)에서 `facts.json`을 다시 만든다 |
| `src/lib/i18n.ts` | 자리표시 해석과 언어별 숫자·날짜 표기 |
| `app/(ko|en|ja)` | 언어별 root layout, 정적 export |

## 수치가 틀리지 않게 하는 장치

- 문장에 숫자를 직접 쓰면 단위 테스트가 실패합니다(`tests/unit/content.test.ts`).
- 자리표시가 `facts.json`에 없는 경로를 가리키면 빌드가 실패합니다.
- `export_facts.py`는 다시 센 행 수가 모델 학습 행 수와 다르면 멈춥니다.

## 실행

```bash
npm ci
npm run dev        # 개발 서버
npm test           # 단위 테스트
npm run build      # 정적 export → out/
npm run e2e        # Playwright + axe
npm run facts      # 모델 저장소에서 수치 갱신 (AIRFARE_ROOT 필요)
```

Next.js (App Router, static export) · TypeScript · zod · Vitest · Playwright · GitHub Actions · Vercel
````

- [ ] **Step 1: ⏸ 사용자에게 확인** — "GitHub에 `signal-ml-portfolio` 저장소를 만들고 올릴까요? 공개(public)/비공개 중 무엇으로 할까요?"를 묻고 답을 기다린다. (포트폴리오 저장소 자체는 공개를 권한다. 원본 CSV는 이 저장소에 없다.)

- [ ] **Step 2: 저장소 생성과 푸시** (Step 1 답에 따라 `--public` 또는 `--private`)

```bash
git log --format='%ae %ce' | sort -u    # noreply 주소 한 줄만 나와야 한다. 다른 주소가 보이면 푸시하지 말고 Task 1 Step 0을 다시 한다
git add README.md && git commit -m "docs: add README"
gh repo create hyde0395/signal-ml-portfolio --public --source . --remote origin --push
gh run watch --exit-status
```
Expected: CI 워크플로 `ci`가 초록색으로 끝남. 실패하면 로그를 보고 고친 뒤 다시 푸시한다.

- [ ] **Step 3: ⏸ Vercel 연결 (사용자 작업)** — 사용자에게 안내: vercel.com → Add New Project → `signal-ml-portfolio` Import → Framework: Next.js(자동) → Deploy. 프로젝트 이름은 주소가 되므로 `signal-choihalim`처럼 정한다. 연결되면 운영 주소를 알려 달라고 한다.

- [ ] **Step 4: 배포 확인**

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://<운영주소>/
curl -s -o /dev/null -w "%{http_code}\n" https://<운영주소>/ja/
curl -s -o /dev/null -w "%{http_code}\n" https://<운영주소>/nope/
curl -s https://<운영주소>/ | grep -o 'hrefLang="ja"[^>]*' | head -1
```
Expected: `200`, `200`, `404`, 그리고 hreflang 링크의 href가 `https://<운영주소>/ja/`.

- [ ] **Step 5: README·CLAUDE.md 갱신과 Commit** — README의 "사이트: (배포 후 기록)"을 운영 주소로 바꾼다(공개 전 noindex 상태라는 점은 적지 않는다). CLAUDE.md 진행 표에 "계획 1 완료 · 배포 주소 https://…"를 적고 "다음: 계획 2(데모) 작성"으로 바꾼다. 그리고 "나중에 만들 공개용 항공권 저장소도 커밋 이메일을 noreply로 설정하고 기존 기록을 확인할 것"을 주의 사항에 추가한다.

```bash
git add README.md CLAUDE.md
git commit -m "docs: record plan 1 completion and deploy URL"
git push
```
