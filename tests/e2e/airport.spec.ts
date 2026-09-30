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

  // 첫 화면 → ① 전환(계획 6-5 Task 4): 머리말(#intro)이 화면 가운데일 때 장면이 전환 도중이고,
  // 위로 되돌리면 거꾸로 0(공항)으로 돌아간다. 진행도는 TerrainScene이 html data-handoff로 적는다
  // (hero-runway는 첫 프레임 뒤에 붙어 첫 스크롤 전에는 값이 없을 수 있다 — 그때도 장면은 공항 그대로)
  test('머리말을 지나는 동안 공항 → 지형 전환 도중이고, 되돌리면 거꾸로 간다', async ({ page }) => {
    // 속성이 없을 때 Number(null) === 0이 되어 "0으로 돌아감"이 거짓으로 통과하지 않게, 없으면 NaN으로 읽는다
    // (NaN은 어떤 크기 비교도 통과하지 않는다). 끝값은 문자열로 비교한다
    const raw = () => page.locator('html').getAttribute('data-handoff');
    const handoff = async () => { const v = await raw(); return v === null ? NaN : Number(v); };
    await page.locator('#intro').evaluate((n) => n.scrollIntoView({ block: 'center' }));
    await expect.poll(handoff).toBeGreaterThan(0.2);
    expect(await handoff()).toBeLessThan(0.8);
    await page.locator('#project-h').evaluate((n) => n.scrollIntoView({ block: 'start' }));
    await expect.poll(raw).toBe('1.000');
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect.poll(raw).toBe('0.000');
    await expect(page.locator('html')).toHaveAttribute('data-active-scene', 'hero');
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

// 3D가 켜질 때 맨 위가 아니었더라도(로딩 중 스크롤·새로고침이 스크롤 위치를 되살림) 나중에 맨 위로 돌아오면
// 그때 여백 클래스가 붙어 이륙·전환이 다시 재생된다(Backdrop.tsx setMode). 맨 위에서는 히어로 아래에 여백이
// 끼어들어도 보이는 것이 움직이지 않는다 — 첫 화면 제목 위치가 그대로인지도 본다
test('맨 위가 아닐 때 3D가 켜져도, 맨 위로 돌아오면 여백 클래스가 붙는다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#project');
  await expect(page.locator('html')).toHaveAttribute('data-3d', /^(on|off)$/, { timeout: 20_000 });
  test.skip((await page.locator('html').getAttribute('data-3d')) !== 'on', '3D가 꺼진 환경');
  await expect(page.locator('html')).not.toHaveClass(/hero-runway/);
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page.locator('html')).toHaveClass(/hero-runway/);
  const title = await page.locator('.hero-title').boundingBox();
  expect(title!.y).toBeGreaterThanOrEqual(0);
  // 여백이 붙었으니 스크롤로 전환이 계산된다(data-handoff)
  await page.locator('#intro').evaluate((n) => n.scrollIntoView({ block: 'center' }));
  await expect.poll(() => page.locator('html').getAttribute('data-handoff')).not.toBeNull();
});

test('3D가 켜져도 첫 화면 제목 위치가 그대로다(여백은 화면 밖)', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const before = await page.locator('.hero-title').boundingBox();
  await expect(page.locator('html')).toHaveAttribute('data-3d', /^(on|off)$/, { timeout: 20_000 });
  const after = await page.locator('.hero-title').boundingBox();
  expect(Math.abs(after!.y - before!.y)).toBeLessThanOrEqual(1);
});

test.describe('움직임 줄이기(3D 꺼짐)', () => {
  test.use({ reducedMotion: 'reduce' });
  test('첫 화면 대체 이미지와 제목이 보인다', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-3d', 'off');
    await expect(page.locator('.hero .scene-figure img')).toBeVisible();
    await expect(page.locator('.hero-title')).toBeVisible();
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
