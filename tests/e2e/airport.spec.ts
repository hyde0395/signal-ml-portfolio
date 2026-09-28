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

  // 맨 위에서 3D가 켜지면 html.hero-runway가 붙어 히어로 아래 60vh 여백이 붙박이로 남는다(Backdrop.tsx
  // setMode 참고). data-3d가 나중에 off로 바뀌어도(fps 하락·컨텍스트 끊김을 흉내) 그 클래스는 안 지워지므로
  // 여백이 사라지지 않고, #project 같은 뒤 콘텐츠 위치가 튀지 않아야 한다
  test('3D가 나중에 꺼져도(hero-runway 유지) #project 위치가 그대로다', async ({ page }) => {
    await expect(page.locator('html')).toHaveClass(/hero-runway/);
    const before = await page.locator('#project').boundingBox();
    await page.evaluate(() => document.documentElement.setAttribute('data-3d', 'off'));
    const after = await page.locator('#project').boundingBox();
    expect(Math.abs(after!.y - before!.y)).toBeLessThanOrEqual(1);
  });
});

// 느린 회선 등으로 3D가 늦게 켜질 때 이미 #project까지 스크롤해 내려온 상태라면(맨 위가 아니면)
// html.hero-runway를 붙이지 않는다 — 이미 지나온 화면 중간에 여백이 새로 끼어들어 내용이 튀는 것을 막는다
test('#project로 바로 들어오면(이미 스크롤된 채 3D 켜짐) 여백 클래스가 안 붙는다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#project');
  await expect(page.locator('html')).toHaveAttribute('data-3d', /^(on|off)$/, { timeout: 20_000 });
  test.skip((await page.locator('html').getAttribute('data-3d')) !== 'on', '3D가 꺼진 환경');
  await expect(page.locator('html')).not.toHaveClass(/hero-runway/);
});

test('3D가 켜져도 첫 화면 이름 위치가 그대로다(여백은 화면 밖)', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const before = await page.locator('.hero-name').boundingBox();
  await expect(page.locator('html')).toHaveAttribute('data-3d', /^(on|off)$/, { timeout: 20_000 });
  const after = await page.locator('.hero-name').boundingBox();
  expect(Math.abs(after!.y - before!.y)).toBeLessThanOrEqual(1);
});

test.describe('움직임 줄이기(3D 꺼짐)', () => {
  test.use({ reducedMotion: 'reduce' });
  test('첫 화면 대체 이미지와 이름이 보인다', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-3d', 'off');
    await expect(page.locator('.hero .scene-figure img')).toBeVisible();
    await expect(page.locator('.hero-name')).toBeVisible();
  });
});

test('캡처 모드(hero)는 공항 장면을 그린다', async ({ page }) => {
  await page.goto('/?capture=hero');
  await page.waitForFunction(() => (window as Window & { __sceneReady?: boolean }).__sceneReady === true, null, { timeout: 30_000 });
  // 캔버스 윗부분(하늘·지평선)보다 아래(활주로)에 밝은 화소가 더 많다 — 지형(가운데 덩어리)이 아닌 공항 구도
  // .backdrop canvas로 좁힌다 — 캡처 모드에서도 페이지 아래 섹션의 chart-canvas(SVG 대체 등)가 함께 떠 있다
  const ratio = await page.locator('.backdrop canvas').evaluate((c: HTMLCanvasElement) => {
    const g = document.createElement('canvas'); g.width = c.width; g.height = c.height;
    const x = g.getContext('2d')!; x.drawImage(c, 0, 0);
    const d = x.getImageData(0, 0, g.width, g.height).data;
    let top = 0, bottom = 0;
    for (let y = 0; y < g.height; y++) for (let i = 0; i < g.width; i++) {
      const k = (y * g.width + i) * 4; if (d[k] + d[k + 1] + d[k + 2] < 300) continue;
      if (y < g.height * 0.35) top++; else bottom++;
    }
    return bottom / Math.max(1, top);
  });
  expect(ratio).toBeGreaterThan(3);
});
