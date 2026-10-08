// 글꼴 서브셋(계획 2026-10-08 성능 Task 4): 페이지마다 받는 woff2가 적고 작아야 한다. 예전에는 Pretendard 동적 서브셋
// 조각(PretendardVariable.subset.N)을 페이지 전체 글자 때문에 25~40개(650~850KB) 받아 LCP가 늘었다
import { expect, test } from '@playwright/test';

for (const [path, maxKb] of [['/', 260], ['/en/', 200], ['/ja/', 320]] as const) {
  test(`${path}: 글꼴 요청이 적고 작다(옛 조각 없음)`, async ({ page }) => {
    const fonts: { url: string; bytes: number }[] = [];
    page.on('response', async (r) => {
      if (r.url().endsWith('.woff2')) fonts.push({ url: r.url(), bytes: (await r.body().catch(() => Buffer.alloc(0))).length });
    });
    await page.goto(path);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(500);
    expect(fonts.some((f) => /PretendardVariable\.subset/.test(f.url))).toBe(false);
    expect(fonts.length).toBeLessThanOrEqual(6);
    expect(fonts.reduce((s, f) => s + f.bytes, 0) / 1024).toBeLessThan(maxKb);
  });
}
