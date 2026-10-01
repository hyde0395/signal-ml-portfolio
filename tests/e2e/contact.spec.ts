// 연락처 가로 탑승권(설계 2026-10-01) e2e: 칸 내용·링크, 화면 낭독기용 언어별 칸 이름, 꾸밈(바코드) 숨김,
// 배치(넓은 화면은 꼬리표가 옆, 좁은 화면은 아래), 좁은 폭 가로 넘침 없음, axe.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// site.spec.ts와 같은 이유(JSON import 속성 문제)로 fs로 읽는다
const readJson = (rel: string) => JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf-8'));
const facts = readJson('../../data/facts.json') as {
  site: { airport: { code: string } };
  profile: { graduation: string };
  contact: { emailReversed: string; github: string; linkedin: string; ticket: { flight: string; gate: string } };
  data: { byRoute: { pair: string }[] };
};
const PAGES = [{ path: '/', lang: 'ko' }, { path: '/en/', lang: 'en' }, { path: '/ja/', lang: 'ja' }] as const;
type Contact = Record<'passenger' | 'class' | 'boarding' | 'gate' | 'email' | 'github' | 'resume' | 'from' | 'to' | 'flight' | 'role', string>;
const content = Object.fromEntries(PAGES.map(({ lang }) => [lang, readJson(`../../content/${lang}.json`).contact])) as Record<(typeof PAGES)[number]['lang'], Contact>;

// 화면 밖이면 3D 장면이 다른 장면이라 탑승권 근처로 내려가서 본다
async function toPass(page: Page) {
  await page.locator('.pass').scrollIntoViewIfNeeded();
}

for (const { path, lang } of PAGES) {
  test(`${path}: 탑승권에 탑승객·노선·이메일·GitHub·이력서가 있다`, async ({ page }) => {
    await page.goto(path);
    await toPass(page);
    const pass = page.locator('.pass');
    const main = pass.locator('.pass-main');
    await expect(main.locator('.pass-name')).toHaveText('CHOI HALIM');
    await expect(main).toContainText(content[lang].role);
    await expect(main).toContainText(facts.profile.graduation);
    await expect(main).toContainText(facts.contact.ticket.gate);
    // 노선: 출발 = 첫 화면 공항 코드, 도착 = 수집 노선의 도착 공항(순서대로, 겹침 없이)
    const dest = [...new Set(facts.data.byRoute.map((r) => r.pair.split('_')[1]))].join(' · ');
    await expect(main.locator('.pass-code').first()).toHaveText(facts.site.airport.code);
    await expect(main.locator('.pass-to .pass-code')).toHaveText(dest);
    const email = [...facts.contact.emailReversed].reverse().join('');
    await expect(main.getByTestId('email')).toHaveText(email);
    await expect(main.getByRole('link', { name: facts.contact.github.replace('https://', '') })).toHaveAttribute('href', facts.contact.github);
    const stub = pass.locator('.pass-stub');
    await expect(stub).toContainText(facts.contact.ticket.flight);
    await expect(stub.locator('.pill')).toBeVisible();   // 이력서: 파일이 있으면 링크, 없으면 "준비 중"
  });

  test(`${path}: 칸 이름은 눈에는 영어, 화면 낭독기에는 그 언어`, async ({ page }) => {
    await page.goto(path);
    const c = content[lang];
    const want = [['PASSENGER', c.passenger], ['CLASS', c.class], ['BOARDING', c.boarding], ['GATE', c.gate], ['EMAIL', c.email],
      ['GITHUB', c.github], ['FROM', c.from], ['TO', c.to], ['FLIGHT', c.flight], ['RESUME', c.resume]];
    for (const [code, text] of want) {
      const dt = page.locator('.pass dt', { has: page.locator('[aria-hidden="true"]', { hasText: new RegExp(`^${code}$`) }) });
      await expect(dt, code).toHaveCount(1);
      await expect(dt.locator('.sr-only'), code).toHaveText(text);
    }
  });
}

test('꾸밈은 화면 낭독기에서 숨긴다(바코드·비행기·꼬리표 이름), LinkedIn 값이 비면 칸이 없다', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.pass-barcode')).toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('.pass-path')).toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('.pass-stub [aria-hidden="true"]', { hasText: 'CHOI HALIM' })).toHaveCount(1);
  test.skip(facts.contact.linkedin !== '', 'LinkedIn 값이 채워져 있다');
  await expect(page.locator('.pass')).not.toContainText('LINKEDIN');
});

test('탑승권 axe 위반 없음(3D 장면 위)', async ({ page }) => {
  await page.goto('/');
  await toPass(page);
  const result = await new AxeBuilder({ page }).include('#contact').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(result.violations).toEqual([]);
});

test.describe('움직임 줄이기(3D 끔)', () => {
  test.use({ reducedMotion: 'reduce' });
  test('탑승권 axe 위반 없음', async ({ page }) => {
    await page.goto('/ja/');
    await toPass(page);
    const result = await new AxeBuilder({ page }).include('#contact').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(result.violations).toEqual([]);
  });
});

// 넓은 화면은 꼬리표가 본권 오른쪽, 좁은 화면은 본권 아래(절취선이 가로)
for (const { width, beside } of [{ width: 1440, beside: true }, { width: 390, beside: false }]) {
  test(`${width}px: 꼬리표가 본권 ${beside ? '옆' : '아래'}에 있다`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await toPass(page);
    // 부드러운 스크롤이 도는 중이면 두 번 따로 재는 사이에 위치가 바뀐다 — 한 번에 잰다
    const [m, s] = await page.evaluate(() => ['.pass-main', '.pass-stub'].map((q) => {
      const r = document.querySelector(q)!.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    }));
    if (beside) {
      expect(Math.abs(s.x - (m.x + m.width))).toBeLessThanOrEqual(1);
      expect(Math.abs(s.y - m.y)).toBeLessThanOrEqual(1);
    } else {
      expect(Math.abs(s.y - (m.y + m.height))).toBeLessThanOrEqual(1);
      expect(Math.abs(s.x - m.x)).toBeLessThanOrEqual(1);
    }
  });
}

for (const width of [320, 390]) {
  for (const { path } of PAGES) {
    test(`${path} ${width}px: 가로 스크롤이 없고 탑승권이 화면 안에 있다`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(path);
      await toPass(page);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
      const box = (await page.locator('.pass').boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
      // 꼬리표 안 칸(편명 띠)이 넘치지 않는다 — 머리 띠가 두 줄로 부서지면 높이가 커진다
      const head = (await page.locator('.pass-head').boundingBox())!;
      expect(head.height).toBeLessThan(48);
    });
  }
}

// 가운데 정렬(사용자 결정 2026-10-01, 데모와 같게): 제목 글자·탑승권·소개 칸의 가운데가 본문 가운데와 맞고,
// 소개 글은 왼쪽 정렬. 제목은 블록 상자가 아니라 글자 범위(Range)로 잰다 — 상자는 늘 가운데라 검사가 되지 않는다
async function centres(page: Page) {
  return page.evaluate(() => {
    const mid = (r: DOMRect) => r.x + r.width / 2;
    const text = (q: string) => { const range = document.createRange(); range.selectNodeContents(document.querySelector(q)!); return mid(range.getBoundingClientRect()); };
    const box = (q: string) => mid(document.querySelector(q)!.getBoundingClientRect());
    const about = document.querySelector('.contact-about')!;
    return {
      content: box('#contact'), eyebrow: text('#contact > .eyebrow'), h2: text('#contact-h'), pass: box('.pass'), about: box('.contact-about'),
      aboutWidth: about.getBoundingClientRect().width,
      aligns: [about, ...about.querySelectorAll('p, li, h3, h4')].map((n) => getComputedStyle(n).textAlign),
    };
  });
}

for (const motion of ['no-preference', 'reduce'] as const) {
  test.describe(`가운데 정렬(${motion === 'reduce' ? '3D 끔' : '3D 켬'})`, () => {
    test.use({ reducedMotion: motion });
    test('1440px: 제목·탑승권·소개 칸이 본문 가운데, 소개 글은 왼쪽 정렬', async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto('/');
      await toPass(page);
      const c = await centres(page);
      for (const k of ['eyebrow', 'h2', 'pass', 'about'] as const) expect(Math.abs(c[k] - c.content), k).toBeLessThanOrEqual(4);
      expect(c.aboutWidth).toBeLessThanOrEqual(560);
      for (const a of c.aligns) expect(['left', 'start']).toContain(a);
    });
  });
}
