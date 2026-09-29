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
  // 빈 칸(로고 왼쪽·글자 사이)은 클릭을 그대로 통과시킨다 — 실제 누르는 자리는 .header-actions뿐
  await expect(header(page)).toHaveCSS('pointer-events', 'none');
});

test('내리면 숨고, 위로 올리면 오른쪽만 다시 보인다', async ({ page }) => {
  await page.goto('/');
  await scrollTo(page, 400);
  await scrollTo(page, 1400);
  await expect(page.locator('html')).toHaveAttribute('data-header', 'hidden');
  await expect(header(page)).toHaveCSS('opacity', '0');
  await expect(header(page).locator('.header-actions')).toHaveCSS('pointer-events', 'none');
  await scrollTo(page, 1300);
  await expect(page.locator('html')).toHaveAttribute('data-header', 'peek');
  await expect(header(page)).toHaveCSS('opacity', '1');
  await expect(header(page).locator('.brand')).toHaveCSS('opacity', '0');
  await expect(header(page).getByRole('link', { name: 'KO', exact: true })).toBeVisible();
  await scrollTo(page, 0);
  await expect(page.locator('html')).toHaveAttribute('data-header', 'top');
  await expect(header(page).locator('.brand')).toHaveCSS('opacity', '1');
});

// 전환을 켠 채로 본다: 예전에는 hidden → peek 때 SIGNAL이 1에서 0으로 0.4초 동안 사라지며 잠깐 번쩍였다.
// 숨김 상태에서 이미 0이면 올린 직후에도 전환할 게 없어 바로 0이다
test.describe('움직임 켬', () => {
  test.use({ reducedMotion: 'no-preference' });
  test('숨김 → 오른쪽만: SIGNAL이 번쩍이지 않는다(올린 직후에도 투명도 0)', async ({ page }) => {
    await page.goto('/');
    await scrollTo(page, 400);
    await scrollTo(page, 1400);
    await expect(page.locator('html')).toHaveAttribute('data-header', 'hidden');
    await expect(header(page).locator('.brand')).toHaveCSS('opacity', '0', { timeout: 10_000 });
    const opacityAfterUp = await page.evaluate(() => {
      window.scrollTo(0, 1300);
      window.dispatchEvent(new Event('scroll'));
      return new Promise<string[]>((resolve) => {
        const brand = document.querySelector('.site-header .brand')!;
        const seen: string[] = [];
        // 전환이 있다면 도는 동안(0.4초) 몇 프레임을 모아 한 번이라도 0이 아닌 값이 보이는지 본다
        const t0 = performance.now();
        const tick = () => {
          seen.push(document.documentElement.dataset.header + ':' + getComputedStyle(brand).opacity);
          if (performance.now() - t0 < 300) requestAnimationFrame(tick); else resolve(seen);
        };
        requestAnimationFrame(tick);
      });
    });
    expect(opacityAfterUp.some((v) => v.startsWith('peek:'))).toBe(true);
    for (const v of opacityAfterUp) expect(v.endsWith(':0')).toBe(true);
  });
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

// 파일 맨 위(test.use)에서 이미 reducedMotion: 'reduce'를 켠다 — 여기서 다시 켤 필요 없다
test.describe('움직임 줄이기', () => {
  test('SCROLL 표시의 선이 멈춰 있다', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.scroll-hint i')).toHaveCSS('animation-name', 'none');
  });
});

// 좁은 휴대폰에서는 언어 안내 판(LangHint, 왼쪽 아래)이 뜨면 SCROLL 표시와 자리가 겹친다.
// 브라우저 언어를 한국어로 두고 /en/에 들어가면 판이 뜬다(LangHint.tsx: 브라우저 언어 ≠ 현재 페이지)
test.describe('좁은 휴대폰에서 언어 안내 판과 겹침', () => {
  test.use({ viewport: { width: 390, height: 844 }, locale: 'ko-KR' });
  test('언어 안내 판이 뜨면 SCROLL 표시가 그 위로 올라가 겹치지 않는다', async ({ page }) => {
    await page.goto('/en/');
    const banner = page.locator('.lang-hint');
    await expect(banner).toBeVisible();
    const hint = page.locator('.scroll-hint');
    await expect(hint).toBeVisible();
    const hintBox = (await hint.boundingBox())!;
    const bannerBox = (await banner.boundingBox())!;
    // 표시의 아래쪽 끝이 판의 위쪽 끝보다 위(작은 y)에 있어야 겹치지 않는다
    expect(hintBox.y + hintBox.height).toBeLessThanOrEqual(bannerBox.y);
  });
});
