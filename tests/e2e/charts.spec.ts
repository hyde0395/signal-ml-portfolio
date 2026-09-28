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

  test('와플 그룹에 마우스를 올리면 설명 줄에 그 그룹, 다른 그룹은 흐려진다', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await center(page, '[data-scene="features"]');
    const stage = page.locator('[data-scene="features"]');
    const groups = stage.locator('.chart-group');
    await expect(groups).toHaveCount(6, { timeout: 10_000 });
    const detail = stage.locator('.chart-detail');
    await expect(detail).toBeEmpty();
    const name = (await groups.nth(2).locator('.chart-group-name').textContent())!;
    await groups.nth(2).hover();
    await expect(detail).toContainText(name);
    await expect(groups.nth(2)).toHaveClass(/is-focus/);
    await expect(groups.nth(0)).toHaveClass(/is-dim/);
    await expect(stage.locator('.chart-group-features')).toHaveCount(0); // 그룹마다 펼치던 목록은 없다
    await page.mouse.move(5, 5);
    await expect(detail).toBeEmpty();
    // 설명 줄은 그림 판 안, 와플 이름표보다 아래
    const d = (await detail.boundingBox())!, g = (await groups.nth(2).boundingBox())!, plot = (await stage.locator('[data-plot]').boundingBox())!;
    await groups.nth(2).hover();
    const d2 = (await detail.boundingBox())!;
    expect(d2.y).toBeGreaterThan(g.y + g.height - 1);
    expect(d2.y + d2.height).toBeLessThanOrEqual(plot.y + plot.height + 2);
    expect(d.x).toBeGreaterThanOrEqual(plot.x - 1);
  });

  test.describe('휴대폰 누르기', () => {
    test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });
    test('누르면 켜지고, 손을 떼도 남고, 다시 누르면 꺼진다', async ({ page }) => {
      await page.goto('/');
      await center(page, '[data-scene="features"]');
      const stage = page.locator('[data-scene="features"]');
      const groups = stage.locator('.chart-group');
      // 피처 개수가 가장 많은 그룹(lookup, facts.json 기준 첫 번째 그룹)을 눌러 — 설명 줄 글자가 가장
      // 길어 여러 줄로 접히는 경우에도 판 안에, 다른 이름표와 겹치지 않는지 함께 확인한다
      const g = groups.nth(0);
      await expect(g).toBeVisible({ timeout: 10_000 });
      const name = (await g.locator('.chart-group-name').textContent())!;
      await g.tap();
      const detail = stage.locator('.chart-detail');
      await expect(detail).toContainText(name);
      await page.waitForTimeout(300);
      await expect(detail).toContainText(name);
      const d = (await detail.boundingBox())!, plot = (await stage.locator('[data-plot]').boundingBox())!;
      const groupBoxes = await groups.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().bottom));
      for (const bottom of groupBoxes) expect(d.y).toBeGreaterThanOrEqual(bottom - 1);
      expect(d.y + d.height).toBeLessThanOrEqual(plot.y + plot.height + 2);
      await g.tap();
      await expect(detail).toBeEmpty();
    });
  });

  // 2026-09-28 회고: 이름표 칸 높이(labelPx)를 재실측한 뒤에도 가로가 짧은 휴대폰(가로 모드)과 영어(이름
  // 길이가 달라 줄바꿈이 다르다)에서 설명 줄이 이름표와 겹치지 않는지 확인한다
  for (const [label, path, w, h] of [
    ['가로 모드 휴대폰', '/', 844, 390],
    ['영어', '/en/', 1440, 900],
  ] as const) {
    test(`와플 설명 줄이 이름표와 겹치지 않는다 — ${label}(${w}×${h})`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await page.goto(path);
      await center(page, '[data-scene="features"]');
      const stage = page.locator('[data-scene="features"]');
      const groups = stage.locator('.chart-group');
      await expect(groups).toHaveCount(6, { timeout: 10_000 });
      await groups.nth(0).hover();
      const detail = stage.locator('.chart-detail');
      await expect(detail).not.toBeEmpty();
      const d = (await detail.boundingBox())!, plot = (await stage.locator('[data-plot]').boundingBox())!;
      const groupBoxes = await groups.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().bottom));
      for (const bottom of groupBoxes) expect(d.y).toBeGreaterThanOrEqual(bottom - 1);
      expect(d.y + d.height).toBeLessThanOrEqual(plot.y + plot.height + 2);
    });
  }

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

  // 설계 2026-09-28 §2 후속 수정: 화면이 낮으면 글 상자가 CSS 고정 위치(61vh/55vh)보다 커서 아래로 넘친다 —
  // 그러면 motion/caption.ts가 상자를 위로 올려(stickTopFor) 다 붙었을 때(opacity ~1) 마지막 줄과
  // "코드 보기" 링크까지 화면 안에 들어오는지 확인한다(1440×900·390×844에서는 글이 다 들어가므로 위의
  // 겹침 검사가 그대로 통과해야 한다 — 이 검사와는 다른 크기에서만 상자가 올라간다)
  for (const [label, path, w, h] of [
    ['짧은 화면', '/', 844, 390],
    ['영어 좁은 화면', '/en/', 375, 667],
  ] as const) {
    test(`자막이 붙으면 글 전체와 코드 보기 링크가 화면 안에 들어온다 — ${label}(${w}×${h})`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await page.goto(path);
      for (const key of STAGES) {
        const block = page.locator(`[data-scene="${key}"]`);
        const { top, height } = await block.evaluate((n) => ({ top: n.getBoundingClientRect().top + window.scrollY, height: (n as HTMLElement).offsetHeight }));
        // 한 번에 목표 위치로 건너뛰면(큰 폭의 scrollTo) 헤드리스 브라우저가 이따금 scroll 이벤트를
        // 아예 안 보낼 때가 있어(자막 스크립트가 갱신될 기회를 못 얻는다) 위의 겹침 검사처럼 잘게 나눠
        // 스크롤한다(실제 스크롤도 이렇게 여러 단계로 일어난다). scroll 이벤트도 직접 한 번 더 보내
        // (실제 스크롤은 항상 이 이벤트를 내보낸다) 자막 스크립트가 이번 스크롤 위치로 확실히 다시
        // 계산하게 한다. 고정 구간의 중간을 지나며 다 붙는(opacity ~1) 순간마다 검사한다
        const copy = block.locator('.chart-copy');
        const link = block.locator('a.code-link');
        let checked = false;
        for (let k = 0; k <= 12; k++) {
          await page.evaluate((y) => {
            window.scrollTo(0, y);
            window.dispatchEvent(new Event('scroll'));
          }, top - h + ((height + h) * k) / 12);
          await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
          await page.waitForTimeout(80);
          const opacity = await copy.evaluate((c) => Number(getComputedStyle(c).opacity));
          if (opacity < 0.99) continue; // 다 붙지 않았으면(들고 나는 중) 건너뛴다
          checked = true;
          const copyBox = (await copy.boundingBox())!;
          expect(copyBox.y + copyBox.height, `${key} 단계 ${k} 글 상자 아래`).toBeLessThanOrEqual(h + 1);
          const linkBox = (await link.boundingBox())!;
          expect(linkBox.y, `${key} 단계 ${k} 링크 위`).toBeGreaterThanOrEqual(-1);
          expect(linkBox.y + linkBox.height, `${key} 단계 ${k} 링크 아래`).toBeLessThanOrEqual(h + 1);
        }
        expect(checked, `${key}: 고정된 채 다 붙는 구간을 한 번도 못 만났다`).toBe(true);
      }
    });
  }
});

test('3D가 도중에 꺼지면 이미 불러온 판이 그 자리에서 2D로 그린다', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-3d', /^(on|off)$/, { timeout: 20_000 });
  await center(page, '[data-scene="chartCloud"]');
  await expect(page.locator('[data-scene="chartCloud"] .chart-label').first()).toBeAttached({ timeout: 10_000 });
  await page.evaluate(() => document.documentElement.setAttribute('data-3d', 'off'));
  // 판은 곧바로 그려지지만, 소프트웨어 렌더러(CI swiftshader)에서는 검사의 getImageData(GPU 캔버스 읽기) 한 번이
  // 몇 초씩 걸린다(CPU 4배 느리게 해서 0.8~4.3초 측정, 2026-09-28). 5초로는 CI에서 가끔 모자라 넉넉히 둔다
  await expect.poll(() => painted(page, 'chartCloud'), { timeout: 15_000 }).toBe(true);
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
