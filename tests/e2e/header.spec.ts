// 상단 바(설계 2026-09-28 첫 화면 다듬기 §3): 맨 위에서 전부 보임 → 내리면 숨김 → 올리면 오른쪽만 → Tab 초점에 나타남.
// 첫 화면 스크롤 표시(§4): 맨 위에서 보이고 내리면 사라진다.
import { expect, test, type Page } from '@playwright/test';

// 모양 전환(0.4초 투명도 transition)은 부하가 큰 병렬 실행(3D 소프트웨어 렌더링)에서 프레임이 밀려 5초 안에
// 끝나지 않기도 한다. 이 테스트는 상태 → 최종 모양만 보므로 동작 줄이기(전환 없음) 설정으로 끝 값을 바로 읽는다
test.use({ reducedMotion: 'reduce' });

const header = (page: Page) => page.locator('.site-header');
const scrollTo = (page: Page, y: number) =>
  page.evaluate((y) => { window.scrollTo(0, y); window.dispatchEvent(new Event('scroll')); }, y);

test('맨 위: 판 없이 SIGNAL·언어·이력서가 모두 보인다', async ({ page }) => {
  await page.goto('/');
  await expect(header(page)).toHaveCSS('opacity', '1');
  await expect(header(page)).toHaveCSS('position', 'fixed');
  await expect(header(page)).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(header(page).locator('.brand')).toHaveCSS('opacity', '1');
});

test('내리면 숨고, 위로 올리면 오른쪽만 다시 보인다', async ({ page }) => {
  await page.goto('/');
  await scrollTo(page, 400);
  await scrollTo(page, 1400);
  await expect(page.locator('html')).toHaveAttribute('data-header', 'hidden');
  await expect(header(page)).toHaveCSS('opacity', '0');
  await expect(header(page)).toHaveCSS('pointer-events', 'none');
  await scrollTo(page, 1300);
  await expect(page.locator('html')).toHaveAttribute('data-header', 'peek');
  await expect(header(page)).toHaveCSS('opacity', '1');
  await expect(header(page).locator('.brand')).toHaveCSS('opacity', '0');
  await expect(header(page).getByRole('link', { name: 'KO', exact: true })).toBeVisible();
  await scrollTo(page, 0);
  await expect(page.locator('html')).toHaveAttribute('data-header', 'top');
  await expect(header(page).locator('.brand')).toHaveCSS('opacity', '1');
});

test('숨은 동안에도 Tab 초점이 오면 나타난다', async ({ page }) => {
  await page.goto('/');
  await scrollTo(page, 400);
  await scrollTo(page, 1400);
  await expect(header(page)).toHaveCSS('opacity', '0');
  await header(page).getByRole('link', { name: 'EN', exact: true }).focus();
  await expect(header(page)).toHaveCSS('opacity', '1');
});

test('첫 화면 가운데 아래 SCROLL 표시: 맨 위에서 보이고 내리면 사라진다', async ({ page }) => {
  await page.goto('/');
  const hint = page.locator('.scroll-hint');
  await expect(hint).toBeVisible();
  await expect(hint).toHaveAttribute('aria-hidden', 'true');
  const box = (await hint.boundingBox())!;
  const vw = page.viewportSize()!.width;
  expect(Math.abs(box.x + box.width / 2 - vw / 2)).toBeLessThan(4);
  await scrollTo(page, 200);
  await expect(page.locator('html')).toHaveAttribute('data-hint', 'off');
  await expect(hint).toBeHidden();
  await scrollTo(page, 0);
  await expect(hint).toBeVisible();
});

test.describe('움직임 줄이기', () => {
  test.use({ reducedMotion: 'reduce' });
  test('SCROLL 표시의 선이 멈춰 있다', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.scroll-hint i')).toHaveCSS('animation-name', 'none');
  });
});
