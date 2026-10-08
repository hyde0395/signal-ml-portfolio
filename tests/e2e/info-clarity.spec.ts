// 정보 전달 2(설계 2026-10-06): 결론형 제목의 수치, ① 숫자 4개, 제목이 두 줄을 넘지 않음(3개 언어 × 1024·768·390), EVALUATION 머리표 없음
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

// e2e(ESM)에서는 JSON 정적 import가 실패해 fs로 읽는다(board.spec.ts와 같은 방식)
const facts = JSON.parse(readFileSync(fileURLToPath(new URL('../../data/facts.json', import.meta.url)), 'utf-8')) as {
  data: { rawRows: number; routes: number; filter: { removed: number } };
  model: { interval: { coverage: number }; bubble: { firstR2: number; firstR2After: number }; baselineGap: { mae: number } };
  insight: { holidayPeak: { pct: number } };
};
const n = (v: number, l = 'ko') => new Intl.NumberFormat(l).format(v);

test('ko 제목에 facts 수치가 들어간다', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#data-h')).toContainText(n(facts.data.rawRows));
  await expect(page.locator('#filter-h')).toContainText(n(facts.data.filter.removed));
  await expect(page.locator('#chart-depart')).toContainText(`+${facts.insight.holidayPeak.pct}%`);
  await expect(page.locator('#chart-limits')).toContainText(n(facts.model.baselineGap.mae));
});

test('en·ja 출발일 제목', async ({ page }) => {
  await page.goto('/en/');
  await expect(page.locator('#chart-depart')).toContainText('New Year');
  await page.goto('/ja/');
  await expect(page.locator('#chart-depart')).toContainText('元日');
});

test('① 숫자 4개: 모은 가격 · 구간 포함률 · R² 바로잡음 · 노선', async ({ page }) => {
  await page.goto('/');
  const dd = page.locator('#project .project-stats dd');
  await expect(dd).toHaveText([
    n(facts.data.rawRows), `${n(facts.model.interval.coverage)}%`,
    `${n(facts.model.bubble.firstR2)} → ${n(facts.model.bubble.firstR2After)}`, String(facts.data.routes),
  ]);
});

test('⑤ 검증 설계 판에 EVALUATION 머리표가 없고 표 제목은 낭독용', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.chart-block[data-scene="chartSplit"] .eyebrow')).toHaveCount(0);
  await expect(page.locator('.vtable caption')).toHaveClass(/sr-only/);
});

// 설계 §3: 제목이 두 줄을 넘지 않는다(가장 긴 것: ④ 두 제목 en). 넘으면 문구 쪽을 고친다
for (const path of ['/', '/en/', '/ja/']) {
  for (const [w, h] of [[1024, 768], [768, 1024], [390, 844]] as const) {
    test(`${path} ${w}px: 결론 제목 두 줄 이하, 가로 스크롤 없음`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await page.goto(path);
      const lines = await page.locator('#data-h, #filter-h, #features-h, #waffle-h, .chart-copy h3, .chapter h3').evaluateAll((els) =>
        els.map((e) => {
          const cs = getComputedStyle(e);
          const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2;
          // ③ 와플 제목 위 작은 머리말 줄(.h-pre)은 큰 글씨 줄 수에 넣지 않는다
          const pre = e.querySelector('.h-pre');
          const ph = pre ? pre.getBoundingClientRect().height + parseFloat(getComputedStyle(pre).marginBottom) : 0;
          return { id: e.id, text: e.textContent, lines: Math.round((e.getBoundingClientRect().height - ph) / lh) };
        }));
      // 큰 글씨(display) 제목(②·③ h2, ③ 와플 h3)은 휴대폰에서 세 줄까지 허용
      for (const l of lines) expect(l.lines, `${l.id} "${l.text}"`).toBeLessThanOrEqual(w <= 390 && /^(data|features|waffle)-h$/.test(l.id) ? 3 : 2);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    });
  }
}
