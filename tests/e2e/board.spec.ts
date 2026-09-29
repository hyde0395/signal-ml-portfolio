// ② 플립 보드와 옆 목차 e2e: 완성값 낭독, 넘김이 끝나면 칸 글자가 완성값, 움직임 줄이기에서는 바로 완성값,
// 옆 목차 번호가 섹션 목록 순서이고 누르면 이동하며, 휴대폰에서는 숨는다.
import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// site.spec.ts와 같은 이유로 JSON은 fs로 읽는다
const facts = JSON.parse(readFileSync(fileURLToPath(new URL('../../data/facts.json', import.meta.url)), 'utf-8')) as {
  data: { filteredRows: number; byRoute: { pair: string; rows: number }[] };
};
const fmt = (n: number) => new Intl.NumberFormat('en-US').format(n);

// 칸마다 지금 보이는 글자(정지한 아래 반쪽)가 서버가 적어 둔 완성 글자(data-c)와 같은지
const settled = (el: Element) =>
  [...el.querySelectorAll<HTMLElement>('.flap')].every((f) => f.querySelector('.flap-bot:not(.flap-unfold) > span')?.textContent === f.dataset.c);

test('보드: 노선별·합계 행 수를 완성값으로 읽는다', async ({ page }) => {
  await page.goto('/');
  const board = page.locator('[data-board]');
  for (const r of facts.data.byRoute) await expect(board.locator('.sr-only', { hasText: fmt(r.rows) })).toHaveCount(1);
  await expect(board.locator('tfoot .sr-only', { hasText: fmt(facts.data.filteredRows) })).toHaveCount(1);
});

test('보드: 화면에 들어오면 넘어가고, 끝나면 칸 글자가 완성값이다', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-3d', /^(on|off)$/, { timeout: 20_000 });
  const board = page.locator('[data-board]');
  await board.scrollIntoViewIfNeeded();
  // 연출 예산(board.ts budgetMs 4.2초) 안에 반드시 끝난다. 부하 여유를 두어 12초까지 기다린다
  await expect.poll(() => board.evaluate(settled), { timeout: 12_000 }).toBe(true);
});

test.describe('움직임 줄이기', () => {
  test.use({ reducedMotion: 'reduce' });
  test('보드가 넘어가지 않고 처음부터 완성값', async ({ page }) => {
    await page.goto('/');
    const board = page.locator('[data-board]');
    await board.scrollIntoViewIfNeeded();
    expect(await board.evaluate(settled)).toBe(true);
    expect(await board.evaluate((el) => el.getAnimations({ subtree: true }).length)).toBe(0);
  });
});

test('옆 목차: 섹션 번호 순서, 누르면 이동하고 현재 섹션 표시', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: '섹션 목차' });
  await expect(nav.getByRole('link')).toHaveText(['01', '02', '03', '04', '05']);
  await nav.getByRole('link', { name: '03 MODEL & FEATURES' }).click();
  await expect(page).toHaveURL(/#features$/);
  await expect(nav.getByRole('link', { name: '03 MODEL & FEATURES' })).toHaveAttribute('aria-current', 'true');
});

test('옆 목차: 휴대폰에서는 숨는다', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto('/');
  await expect(page.locator('.side-nav')).toBeHidden();
});
