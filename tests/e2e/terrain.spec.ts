// 3D 배경 e2e: 켜짐(캔버스·대체 이미지 숨김), 꺼짐(움직임 줄이기·JS 없음·데이터 실패), 잘못된 캡처 값,
// 초기 청크 분리, 접근성(axe + 3D 위 글자 대비 화소 검사).
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
import sharp from 'sharp';

test('기본 환경: 3D가 켜지고 대체 이미지는 숨는다', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-3d', 'on', { timeout: 20_000 });
  await expect(page.locator('.backdrop canvas')).toBeVisible();
  await expect(page.locator('.backdrop')).toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('.scene-figure').first()).toBeHidden();
});

test.describe('움직임 줄이기', () => {
  test.use({ reducedMotion: 'reduce' });
  test('캔버스 없이 대체 이미지와 대체 텍스트가 보인다', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-3d', 'off');
    await expect(page.locator('.backdrop canvas')).toHaveCount(0);
    const img = page.locator('.scene-figure img').first();
    await expect(img).toBeVisible();
    expect((await img.getAttribute('alt'))?.length).toBeGreaterThan(5);
  });
});

test.describe('JS 없이', () => {
  test.use({ javaScriptEnabled: false });
  test('서버 HTML만으로 대체 이미지 다섯 장이 있다', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.scene-figure img')).toHaveCount(5);
    await expect(page.locator('.scene-figure img').first()).toBeVisible();
  });
});

test('지형 데이터를 못 받으면 대체 화면으로 돌아간다', async ({ page }) => {
  await page.route('**/data/terrain.*.json', (r) => r.fulfill({ status: 404, body: 'no' }));
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-3d', 'off', { timeout: 20_000 });
  await expect(page.locator('.scene-figure img').first()).toBeVisible();
});

test('잘못된 ?capture 값이어도 페이지가 비지 않는다', async ({ page }) => {
  await page.goto('/?capture=bogus');
  await expect(page.locator('html')).toHaveAttribute('data-3d', /^(on|off)$/, { timeout: 20_000 });
  await expect(page.locator('h1')).toHaveText('CHOI HALIM');
  await expect(page.locator('#case-h')).toBeVisible();
});

test('초기 HTML(세 언어)은 three 청크를 직접 불러오지 않는다', async () => {
  const dir = 'out/_next/static/chunks';
  const threeChunks = readdirSync(dir).filter((f) => f.endsWith('.js') && readFileSync(`${dir}/${f}`, 'utf8').includes('WebGLRenderer'));
  expect(threeChunks.length).toBeGreaterThan(0);
  for (const file of ['out/index.html', 'out/en/index.html', 'out/ja/index.html']) {
    const html = readFileSync(file, 'utf8');
    for (const f of threeChunks) expect(html, file).not.toContain(f);
  }
});

// --- 3D 위 글자 대비 화소 검사 ---
// axe는 그라데이션·캔버스 위 글자를 "판정 불가(incomplete)"로 넘겨 위반 0건이 아무것도 증명하지 못한다.
// 그래서 글자를 투명하게 만든 뒤 글 상자 영역을 실제로 찍어, 그 뒤 배경(점 + 어두운 판)의 평균 밝기로
// 글자색과의 대비를 계산한다(WCAG 상대 휘도 공식).
const TX = [0xee, 0xf3, 0xff];
function lin(c: number) { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }
function lum([r, g, b]: number[]) { return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b); }
function contrast(a: number[], b: number[]) { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); }

async function backgroundContrast(page: Page, selector: string, alpha: number) {
  const el = page.locator(selector).first();
  await el.evaluate((n) => n.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(3500); // 카메라·uniform이 새 장면으로 옮겨 가는 시간
  await el.evaluate((n) => { (n as HTMLElement).style.setProperty('color', 'transparent', 'important'); });
  const png = await el.screenshot();
  await el.evaluate((n) => { (n as HTMLElement).style.removeProperty('color'); });
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const sum = [0, 0, 0];
  const n = info.width * info.height;
  const pixels: number[][] = [];
  for (let i = 0; i < n; i++) {
    const px = [data[i * 3], data[i * 3 + 1], data[i * 3 + 2]];
    for (let k = 0; k < 3; k++) sum[k] += px[k];
    pixels.push(px);
  }
  // --mute 글자는 반투명(0.72)이라 실제 글자색은 배경과 섞인 색이다
  const ratio = (bg: number[]) => contrast(TX.map((c, k) => c * alpha + bg[k] * (1 - alpha)), bg);
  // 평균만 보면 어두운 빈 곳이 밝은 점을 묻어 버린다(판을 없애도 평균은 통과했다). 글자 획 바로 뒤에
  // 밝은 점이 오는 경우를 잡으려고 밝은 쪽 99번째 백분위 화소(가장자리 번짐 몇 개는 무시)로도 잰다
  pixels.sort((a, b) => lum(a) - lum(b));
  return { mean: ratio(sum.map((v) => v / n)), p99: ratio(pixels[Math.floor(n * 0.99)]) };
}

test('3D가 켜진 상태에서 글 뒤 배경이 4.5:1 대비를 지킨다(화소 검사)', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-3d', 'on', { timeout: 20_000 });
  await page.evaluate(() => document.querySelector('.lang-hint')?.remove()); // 떠 있는 언어 안내가 영역을 가리지 않게
  const cases: [string, number][] = [
    ['.hero-keywords', 0.72],
    ['.hero-sub', 0.72],
    ['#case-h', 1],
    ['[data-chapter="insight"] > p:not(.eyebrow)', 1],
  ];
  for (const [sel, alpha] of cases) {
    const { mean, p99 } = await backgroundContrast(page, sel, alpha);
    expect(mean, `${sel} 평균 배경 대비 ${mean.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
    expect(p99, `${sel} 밝은 쪽 99% 화소 대비 ${p99.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
  }
});

for (const path of ['/', '/ja/']) {
  test(`${path} 3D가 켜진 상태에서 axe 위반 없음`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator('html')).toHaveAttribute('data-3d', 'on', { timeout: 20_000 });
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(result.violations).toEqual([]);
  });
}
