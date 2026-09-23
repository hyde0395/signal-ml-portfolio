// 3D 배경 e2e: 켜짐(캔버스·대체 이미지 숨김), 꺼짐(움직임 줄이기·JS 없음·데이터 실패), 초기 청크 분리, 접근성.
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';

test('기본 환경: 3D가 켜지고 대체 이미지는 숨는다', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-3d', 'on', { timeout: 20_000 });
  await expect(page.locator('.backdrop canvas')).toBeVisible();
  await expect(page.locator('.backdrop')).toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('.scene-figure').first()).toBeHidden();
});

test.describe('움직임 줄이기', () => {
  test.use({ reducedMotion: 'reduce' });
  test('캔버스 없이 대체 이미지와 대체 텍스트가 보인다', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-3d', 'off');
    await expect(page.locator('.backdrop canvas')).toHaveCount(0);
    const img = page.locator('.scene-figure img').first();
    await expect(img).toBeVisible();
    expect((await img.getAttribute('alt'))?.length).toBeGreaterThan(5);
  });
});

test.describe('JS 없이', () => {
  test.use({ javaScriptEnabled: false });
  test('서버 HTML만으로 대체 이미지 다섯 장이 있다', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.scene-figure img')).toHaveCount(5);
    await expect(page.locator('.scene-figure img').first()).toBeVisible();
  });
});

test('지형 데이터를 못 받으면 대체 화면으로 돌아간다', async ({ page }) => {
  await page.route('**/data/terrain.*.json', (r) => r.fulfill({ status: 404, body: 'no' }));
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-3d', 'off', { timeout: 20_000 });
  await expect(page.locator('.scene-figure img').first()).toBeVisible();
});

test('초기 HTML은 three 청크를 직접 불러오지 않는다', async () => {
  const dir = 'out/_next/static/chunks';
  const threeChunks = readdirSync(dir).filter((f) => f.endsWith('.js') && readFileSync(`${dir}/${f}`, 'utf8').includes('WebGLRenderer'));
  expect(threeChunks.length).toBeGreaterThan(0);
  const html = readFileSync('out/index.html', 'utf8');
  for (const f of threeChunks) expect(html).not.toContain(f);
});

for (const path of ['/', '/ja/']) {
  test(`${path} 3D가 켜진 상태에서 axe 위반 없음`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator('html')).toHaveAttribute('data-3d', 'on', { timeout: 20_000 });
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(result.violations).toEqual([]);
  });
}
