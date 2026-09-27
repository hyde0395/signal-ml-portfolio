// ③ 와플·④ 차트 그림 판 e2e: 3D가 꺼지면 2D로 그리고 이름표를 붙인다, 와플 이름표에 마우스를 올리면 피처 이름,
// 데이터를 못 받으면 안내, 창 크기를 바꾸면 다시 배치, 3D가 도중에 꺼지면 그 자리에서 2D로,
// 3D가 켜져 있으면 스크롤한 차트로 배경 점 배치가 바뀐다(html[data-chart]) — 순서를 섞어 건너뛰어도 멈춘 차트.
import { expect, test, type Page } from '@playwright/test';

const STAGES = ['features', 'chartDepart', 'chartCurve', 'chartCloud'] as const;

async function painted(page: Page, key: string) {
  // html도 지금 장면을 data-scene으로 들고 있어(TerrainScene) 3D가 켜진 상태로 이 장면이 활성화되면
  // "[data-scene=key] 자손"이 html 밑 페이지 전체와 겹쳐 다른 차트의 캔버스까지 걸린다 — html은 제외한다
  return page.locator(`[data-scene="${key}"]:not(html) .chart-canvas`).evaluate((c: HTMLCanvasElement) => {
    if (c.width === 0) return false;
    const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 0) return true;
    return false;
  });
}

const center = (page: Page, sel: string) => page.locator(sel).first().evaluate((n) => n.scrollIntoView({ block: 'center' }));

test.describe('3D 꺼짐(움직임 줄이기)', () => {
  test.use({ reducedMotion: 'reduce' });

  for (const key of STAGES) {
    test(`${key}: 2D로 그리고 이름표를 붙인다`, async ({ page }) => {
      await page.goto('/');
      await expect(page.locator('html')).toHaveAttribute('data-3d', 'off');
      await center(page, `[data-scene="${key}"]`);
      await expect.poll(() => painted(page, key), { timeout: 10_000 }).toBe(true);
      await expect(page.locator(`[data-scene="${key}"]`).locator('.chart-label, .chart-group').first()).toBeAttached();
    });
  }

  test('이름표 개수: 달력 요일 7, 벌떼 구간 8 + 눈금 3, 와플 그룹 6', async ({ page }) => {
    await page.goto('/');
    for (const [key, sel, n] of [['chartDepart', '.chart-label.tick', 7], ['chartCurve', '.chart-label.tick', 11], ['features', '.chart-group', 6]] as const) {
      await center(page, `[data-scene="${key}"]`);
      await expect(page.locator(`[data-scene="${key}"] ${sel}`)).toHaveCount(n, { timeout: 10_000 });
    }
  });

  test('와플 이름표에 마우스를 올리면 피처 이름이 보인다', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await center(page, '[data-scene="features"]');
    const g = page.locator('[data-scene="features"] .chart-group').first();
    await expect(g).toBeVisible({ timeout: 10_000 });
    await expect(g.locator('.chart-group-features')).toBeHidden();
    await g.hover();
    await expect(g.locator('.chart-group-features')).toBeVisible();
  });

  test('차트 데이터를 못 받으면 안내가 뜨고 글 카드는 그대로다', async ({ page }) => {
    await page.route('**/data/charts.*.json', (r) => r.abort());
    await page.goto('/');
    await center(page, '[data-scene="chartDepart"]');
    await expect(page.locator('[data-scene="chartDepart"] .chart-error')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('#chart-depart')).toBeVisible();
  });

  test('창 크기를 바꾸면 다시 배치한다(이름표가 판 안에 남는다)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await center(page, '[data-scene="chartCurve"]');
    await expect(page.locator('[data-scene="chartCurve"] .chart-label.tick')).toHaveCount(11, { timeout: 10_000 });
    await page.setViewportSize({ width: 820, height: 900 });
    const plot = page.locator('[data-scene="chartCurve"] [data-plot]');
    await expect.poll(async () => {
      const p = (await plot.boundingBox())!;
      const boxes = await page.locator('[data-scene="chartCurve"] .chart-label.tick').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().right));
      return boxes.every((r) => r <= p.x + p.width + 2);
    }, { timeout: 5_000 }).toBe(true);
  });
});

test('3D가 도중에 꺼지면 이미 불러온 판이 그 자리에서 2D로 그린다', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-3d', /^(on|off)$/, { timeout: 20_000 });
  await center(page, '[data-scene="chartCloud"]');
  await expect(page.locator('[data-scene="chartCloud"] .chart-label').first()).toBeAttached({ timeout: 10_000 });
  await page.evaluate(() => document.documentElement.setAttribute('data-3d', 'off'));
  await expect.poll(() => painted(page, 'chartCloud'), { timeout: 5_000 }).toBe(true);
});

test.describe('3D 켜짐', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-3d', /^(on|off)$/, { timeout: 20_000 });
    test.skip((await page.locator('html').getAttribute('data-3d')) !== 'on', '3D가 꺼진 환경(소프트웨어 렌더러 저프레임)');
  });

  test('순서를 섞어 건너뛰어도 멈춘 차트의 배치로 바뀐다', async ({ page }) => {
    for (const key of ['chartCloud', 'features', 'chartCurve', 'chartDepart']) {
      await center(page, `[data-scene="${key}"]`);
      await expect(page.locator('html')).toHaveAttribute('data-chart', key, { timeout: 15_000 });
    }
  });

  test('② 두 번째 화면에서는 보드 장면(dataBoard), 첫 화면은 지도(problem)', async ({ page }) => {
    await center(page, '.data-intro');
    await expect(page.locator('html')).toHaveAttribute('data-scene', 'problem', { timeout: 10_000 });
    await center(page, '.data-board');
    await expect(page.locator('html')).toHaveAttribute('data-scene', 'dataBoard', { timeout: 10_000 });
    await expect(page.locator('html')).not.toHaveAttribute('data-chart', /./);
  });
});
