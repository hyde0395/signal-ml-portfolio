import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

// Playwright의 TS 로더가 이 Node 버전에서 JSON 모듈 import에 "type: json" 속성을 요구해
// 정적 import(`import facts from '../../data/facts.json'`)가 실패한다. fs로 읽어 우회한다.
const facts = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../data/facts.json', import.meta.url)), 'utf-8'),
) as { contact: { emailReversed: string } };

const PAGES = [
  { path: '/', lang: 'ko' },
  { path: '/en/', lang: 'en' },
  { path: '/ja/', lang: 'ja' },
];

for (const { path, lang } of PAGES) {
  test(`${path}: lang 속성과 핵심 섹션`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator('html')).toHaveAttribute('lang', lang);
    await expect(page.getByRole('heading', { level: 1, name: 'CHOI HALIM' })).toBeVisible();
    for (const id of ['about', 'case', 'stack', 'contact']) await expect(page.locator(`#${id}`)).toBeAttached();
    await expect(page.locator('[data-chapter]')).toHaveCount(6);
  });

  test(`${path}: axe 위반 없음`, async ({ page }) => {
    await page.goto(path);
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(result.violations).toEqual([]);
  });
}

test.describe('JS 없이', () => {
  test.use({ javaScriptEnabled: false });
  test('모든 섹션 본문이 읽힌다', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: '한·일 항공권, 언제 사야 할까?' })).toBeVisible();
    await expect(page.locator('#case table')).toBeVisible();
    await expect(page.getByText('이메일은 JavaScript를 켜면 보입니다')).toBeVisible();
  });
});

test('이메일: 원본 HTML에는 없고 화면에는 보인다', async ({ page, request }) => {
  const html = await (await request.get('/')).text();
  const email = [...facts.contact.emailReversed].reverse().join('');   // 저장소에 평문 주소를 두지 않는다
  expect(html).not.toContain(email);
  await page.goto('/');
  await expect(page.getByTestId('email')).toHaveText(email);
});

test('LinkedIn 값이 비어 있으면 행이 없다', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('linkedin')).toHaveCount(0);
});

test('이력서 PDF가 없으면 준비 중 표시, 링크 아님', async ({ page }) => {
  await page.goto('/ja/');
  const header = page.locator('.site-header');
  await expect(header.locator('a[download]')).toHaveCount(0);
  await expect(header.locator('[aria-disabled="true"]')).toBeVisible();
});

test('건너뛰기 링크가 첫 Tab에 나타나고 본문으로 이동한다', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: '본문으로 건너뛰기' });
  await expect(skip).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#main$/);
});

test('언어 전환 링크와 선택 기억', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'JA' }).click();
  await expect(page).toHaveURL(/\/ja\/$/);
  expect(await page.evaluate(() => localStorage.getItem('signal.lang'))).toBe('ja');
});

test.describe('브라우저 언어가 일본어일 때', () => {
  test.use({ locale: 'ja-JP' });
  test('한국어 페이지에 일본어 안내만 뜨고 자동 이동은 없다', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('link', { name: '日本語で見る →' })).toBeVisible();
  });
});

for (const bad of ['/nope/', '/en/xyz/']) {
  test(`없는 주소 ${bad}는 3개 언어 404 안내`, async ({ page }) => {
    const res = await page.goto(bad);
    expect(res?.status()).toBe(404);
    await expect(page.getByText('GATE 404')).toBeVisible();
    await expect(page.getByRole('link', { name: '첫 화면으로' })).toHaveAttribute('href', '/');
  });
}

// 375px 폭에서 헤더가 한 줄(72px 미만)에 들어가는지, 그리고 언어 전환 링크(KO/EN/JA)와
// 이력서 요소(.header-actions 안의 .pill — 링크든 "준비 중" span이든)가 실제로 보이고
// 화면 밖(375px)으로 밀려나지 않는지 확인한다. 버튼 개수를 세는 방식은 lang-hint의 닫기
// 버튼과 우연히 같아져 항상 통과하는 동어반복이라 자리·가시성 기준으로 바꿨다.
for (const path of ['/', '/en/', '/ja/']) {
  test(`${path} 휴대폰 폭: 상단 바가 한 줄이고 언어 전환이 바로 보인다`, async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto(path);
    expect((await page.locator('.site-header').boundingBox())!.height).toBeLessThan(72);
    // exact: true — 기본 부분 문자열 매칭은 "View in English →"(LangHint)와 "Skip to content"에도
    // 우연히 "en"이 들어 있어 걸린다. 언어 전환 링크 자체를 가리키도록 한정한다.
    const targets = [
      page.getByRole('link', { name: 'KO', exact: true }),
      page.getByRole('link', { name: 'EN', exact: true }),
      page.getByRole('link', { name: 'JA', exact: true }),
      page.locator('.header-actions .pill'),
    ];
    for (const locator of targets) {
      await expect(locator).toBeVisible();
      const box = await locator.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x + box!.width).toBeLessThanOrEqual(375);
    }
  });
}

test('공개 전: noindex와 robots.txt', async ({ page, request }) => {
  await page.goto('/');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  expect(await (await request.get('/robots.txt')).text()).toContain('Disallow: /');
});

test('모바일 폭에서 가로 스크롤이 없다', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto('/ja/');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
