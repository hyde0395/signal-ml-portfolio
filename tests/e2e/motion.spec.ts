// 연출 e2e: 로딩 화면(1.2초 뒤 사라짐, 재방문 생략, 움직임 줄이기 생략), 제목 리빌, GATE 플립의 완성값·낭독,
// 연출 라이브러리가 초기 청크에 없는지.
import { expect, test } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// site.spec.ts와 같은 이유로 JSON은 fs로 읽는다(Playwright TS 로더의 JSON import 제약).
// 로딩 화면 문구의 숫자를 하드코딩하지 않고 facts.json에서 읽어, 데이터가 바뀌어도 이 테스트가
// 아니라 facts.json만 고치면 되게 한다. Loader가 쓰는 것과 같은 포맷(en-US 천단위 콤마)을 쓴다.
const facts = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../data/facts.json', import.meta.url)), 'utf-8'),
) as { data: { filteredRows: number } };
const rows = new Intl.NumberFormat('en-US').format(facts.data.filteredRows);

test('로딩 화면은 1.2초 안팎에 사라지고, 같은 세션 새로고침에는 없다', async ({ page }) => {
  await page.goto('/');
  const loader = page.locator('.loader');
  // 페이지를 받는 데 1.2초 넘게 걸리는 환경(CI)도 있어 "보인다"는 검사하지 않는다 — 처음 방문엔 생략되지 않았고, 곧 사라지는지만 본다.
  // 타임아웃은 demo.spec.ts의 슬라이더 대기(15_000)처럼 넉넉히 잡는다 — CSS 애니메이션 자체는 1.2초면 끝나지만,
  // 여러 워커가 동시에 소프트웨어 3D 렌더러(swiftshader)를 돌리는 병렬 실행에서는 브라우저 메인 스레드가 밀려
  // 실제 완료까지 3초를 넘기는 경우가 있었다(--repeat-each로 재현)
  await expect(page.locator('html')).not.toHaveClass(/no-loader/);
  await expect(loader).toBeHidden({ timeout: 10_000 });
  await expect(page.locator('.loader [data-count] .sr-only')).toHaveText(rows);
  await page.reload();
  await expect(page.locator('html')).toHaveClass(/no-loader/);
  await expect(loader).toBeHidden();
});

test.describe('움직임 줄이기', () => {
  test.use({ reducedMotion: 'reduce' });
  test('로딩 화면·리빌·플립 없이 최종 글자가 바로 보인다', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.loader')).toBeHidden();
    await page.locator('#stack').scrollIntoViewIfNeeded();
    // 애니메이션이 있었다면 끝났을 시간까지 기다려도 .reveal-word가 하나도 안 생기는지 본다
    // (Motion.tsx가 움직임 줄이기에서는 run.ts를 아예 안 불러와 검사할 "완료 신호"가 없다 — 부재를 확인하는 유일한 방법은 시간 경과)
    await page.waitForTimeout(1500);
    await expect(page.locator('.reveal-word')).toHaveCount(0);
    await expect(page.locator('[data-chapter="problem"] .eyebrow')).toHaveText('GATE 01 — PROBLEM');
  });
});

test('제목은 화면에 들어오면 단어 단위로 떠올라 끝내 보인다', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-3d', /^(on|off)$/, { timeout: 20_000 });
  const h = page.locator('#stack-h');
  await h.scrollIntoViewIfNeeded();
  await expect(h.locator('.reveal-word').first()).toBeAttached({ timeout: 5_000 });
  // 고정 대기 대신 opacity가 1에 닿을 때까지 폴링한다 — 0.9초+단어 지연은 환경(CI vs 로컬)에 따라
  // 조금씩 달라질 수 있어, 정확히 그 시간만큼만 기다리면 느린 환경에서 흔들릴 수 있다
  const lastWord = h.locator('.reveal-word > span').last();
  await expect
    .poll(async () => Number(await lastWord.evaluate((n) => getComputedStyle(n).opacity)), { timeout: 5_000 })
    .toBe(1);
});

test('GATE 제목은 플립 뒤 완성값이고, 스크린리더용 완성값이 따로 있다', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-3d', /^(on|off)$/, { timeout: 20_000 });
  const gate = page.locator('[data-chapter="bubble"] .eyebrow');
  await gate.scrollIntoViewIfNeeded();
  await expect(gate.locator('.sr-only')).toHaveText('GATE 03 — R² BUBBLE', { timeout: 5_000 });
  await expect(gate.locator('[aria-hidden="true"]')).toHaveText('GATE 03 — R² BUBBLE', { timeout: 2_000 });
});

test('연출 라이브러리(ScrollTrigger·Lenis)는 초기 HTML이 직접 불러오지 않는다', async () => {
  const dir = 'out/_next/static/chunks';
  const chunks = readdirSync(dir).filter((f) => f.endsWith('.js') && /ScrollTrigger|lenis/i.test(readFileSync(`${dir}/${f}`, 'utf8')));
  expect(chunks.length).toBeGreaterThan(0);
  for (const file of ['out/index.html', 'out/en/index.html', 'out/ja/index.html']) {
    const html = readFileSync(file, 'utf8');
    for (const f of chunks) expect(html, file).not.toContain(f);
  }
});
