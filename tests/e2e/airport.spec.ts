// 밤의 공항 첫 화면 e2e(설계 2026-09-28 §4): 처음엔 hero 장면, 첫 화면 뒤 여백을 지나는 동안 계속 hero,
// ①에 오면 지형(about)으로. 3D가 켜져도 첫 화면 글 위치는 그대로(CLS).
import { expect, test } from '@playwright/test';

test.describe('3D 켜짐', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-3d', /^(on|off)$/, { timeout: 20_000 });
    test.skip((await page.locator('html').getAttribute('data-3d')) !== 'on', '3D가 꺼진 환경');
  });

  test('처음엔 공항(hero), 여백 동안 hero, ①에서 지형(about)', async ({ page }) => {
    await expect(page.locator('html')).toHaveAttribute('data-active-scene', 'hero');
    await page.evaluate(() => window.scrollTo(0, window.innerHeight * 0.9));
    await expect(page.locator('html')).toHaveAttribute('data-active-scene', 'hero');
    await page.locator('#project-h').evaluate((n) => n.scrollIntoView({ block: 'center' }));
    await expect(page.locator('html')).toHaveAttribute('data-active-scene', 'about', { timeout: 10_000 });
  });
});

test('3D가 켜져도 첫 화면 이름 위치가 그대로다(여백은 화면 밖)', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const before = await page.locator('.hero-name').boundingBox();
  await expect(page.locator('html')).toHaveAttribute('data-3d', /^(on|off)$/, { timeout: 20_000 });
  const after = await page.locator('.hero-name').boundingBox();
  expect(Math.abs(after!.y - before!.y)).toBeLessThanOrEqual(1);
});
