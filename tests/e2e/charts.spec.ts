// ③ 와플·④ 차트 그림 판 e2e: 3D가 꺼지면 2D로 그리고 이름표를 붙인다, 와플 이름표에 마우스를 올리면 피처 이름,
// 데이터를 못 받으면 안내, 창 크기를 바꾸면 다시 배치, 3D가 도중에 꺼지면 그 자리에서 2D로,
// 3D가 켜져 있으면 스크롤한 차트로 배경 점 배치가 바뀐다(html[data-chart]) — 순서를 섞어 건너뛰어도 멈춘 차트.
import { expect, test, type Page } from '@playwright/test';

const STAGES = ['features', 'chartDepart', 'chartCurve', 'chartCloud'] as const;

async function painted(page: Page, key: string) {
  return page.locator(`[data-scene="${key}"] .chart-canvas`).evaluate((c: HTMLCanvasElement) => {
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

  // 설계 2026-09-28 §2: 글 상자는 그림 판 아래 띠에 고정되고, 어떤 스크롤 위치에서도 판과 겹치지 않는다
  for (const [w, h] of [[1440, 900], [390, 844]] as const) {
    test(`자막 띠 ${w}px: 스크롤 전 구간에서 글 상자가 그림 판 아래, 글 뒤 판 없음`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await page.goto('/');
      for (const key of STAGES) {
        const block = page.locator(`[data-scene="${key}"]`);
        await block.evaluate((n) => n.scrollIntoView({ block: 'start' }));
        const copy = block.locator('.chart-copy');
        await expect(copy).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
        const { top, height } = await block.evaluate((n) => ({ top: n.getBoundingClientRect().top + window.scrollY, height: (n as HTMLElement).offsetHeight }));
        for (let k = 0; k <= 12; k++) {
          await page.evaluate((y) => window.scrollTo(0, y), top - h + ((height + h) * k) / 12);
          await page.waitForTimeout(80);
          const r = await block.evaluate((n) => {
            const c = n.querySelector<HTMLElement>('.chart-copy')!, p = n.querySelector('[data-plot]')!.getBoundingClientRect();
            return { copyTop: c.getBoundingClientRect().top, opacity: Number(getComputedStyle(c).opacity), plotBottom: p.bottom };
          });
          if (r.opacity > 0.05) expect(r.copyTop, `${key} 단계 ${k}`).toBeGreaterThanOrEqual(r.plotBottom - 1);
        }
      }
    });
  }

  test('문단이 여러 개인 블록은 한 번에 하나만, 끝까지 가면 마지막 문단', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    const block = page.locator('[data-scene="chartCloud"]');
    const paras = block.locator('.chart-para');
    await expect(paras).toHaveCount(3);
    const { top, height } = await block.evaluate((n) => ({ top: n.getBoundingClientRect().top + window.scrollY, height: (n as HTMLElement).offsetHeight }));
    await page.evaluate((y) => window.scrollTo(0, y), top + 10);
    await expect(block.locator('.chart-para.is-on')).toHaveCount(1);
    await expect(paras.nth(0)).toHaveClass(/is-on/);
    await page.evaluate((y) => window.scrollTo(0, y), top + (height - 900) - 10);
    await expect(paras.nth(2)).toHaveClass(/is-on/);
    await expect(block.locator('.chart-para.is-on')).toHaveCount(1);
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
    await expect(page.locator('html')).toHaveAttribute('data-active-scene', 'problem', { timeout: 10_000 });
    await center(page, '.data-board');
    await expect(page.locator('html')).toHaveAttribute('data-active-scene', 'dataBoard', { timeout: 10_000 });
    await expect(page.locator('html')).not.toHaveAttribute('data-chart', /./);
  });
});
