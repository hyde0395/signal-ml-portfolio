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

test('3D가 켜져도 첫 화면 이름 영역이 움직이지 않는다(CLS)', async ({ page }) => {
  await page.goto('/');
  const box = async () => (await page.locator('.hero-copy').boundingBox())!;
  const before = await box();
  await expect(page.locator('html')).toHaveAttribute('data-3d', 'on', { timeout: 20_000 });
  const after = await box();
  expect(Math.abs(after.y - before.y)).toBeLessThanOrEqual(1);
  expect(Math.abs(after.x - before.x)).toBeLessThanOrEqual(1);
});

test('3D가 켜지는 환경에서는 첫 화면 대체 이미지를 받지 않는다(LCP는 이름 글자)', async ({ page }) => {
  const hero: string[] = [];
  page.on('request', (r) => { if (r.url().includes('/fallback/hero.webp')) hero.push(r.url()); });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-3d', 'on', { timeout: 20_000 });
  expect(hero).toEqual([]);
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
  test('서버 HTML만으로 대체 이미지 세 장이 있다', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.scene-figure img')).toHaveCount(3);
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
  await expect(page.locator('#charts-h')).toBeVisible();
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
  // 글자색을 지운다. 셀렉터 그 요소만이 아니라 자손도 모두 지워야 한다 — .collect-steps li·.data-board 열 이름처럼
  // 안에 자기 색(예: strong의 호박색, --mute)을 따로 지정한 자손이 섞인 경우, 부모에만 칠하면
  // 상속이 아니라 자손의 명시적 색이 이겨 글자가 그대로 남아 배경 화소를 오염시킨다(최종 리뷰 #1 추가 검사에서 발견)
  await el.evaluate((n) => {
    for (const x of [n, ...n.querySelectorAll('*')]) (x as HTMLElement).style.setProperty('color', 'transparent', 'important');
  });
  const png = await el.screenshot();
  await el.evaluate((n) => {
    for (const x of [n, ...n.querySelectorAll('*')]) (x as HTMLElement).style.removeProperty('color');
  });
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
  // 검사 자리 7곳마다 카메라가 옮겨 가길 3.5초씩 기다려 기본 30초를 넘긴다(CI의 소프트웨어 3D에서 실측 초과)
  test.setTimeout(90_000);
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-3d', 'on', { timeout: 20_000 });
  await page.evaluate(() => document.querySelector('.lang-hint')?.remove()); // 떠 있는 언어 안내가 영역을 가리지 않게
  const cases: [string, number][] = [
    ['.hero-keywords', 0.72],
    ['.hero-sub', 0.72],
    ['#project-h', 1],
    ['.project-lead', 0.72],
    ['#charts-h', 1],
    // .is-on을 셀렉터에 넣으면 안 된다 — scrollIntoView가 그 클래스를 붙이는 스크롤 자체이므로, 셀렉터가
    // 미리 그 클래스를 요구하면 되돌아오지 않는다(닭이 먼저냐 요소가 먼저냐). 차트 2는 문단이 하나뿐이라
    // 화면 안에 들어오면 항상 is-on이 된다(motion/caption.ts activeParagraph, count<=1)
    ['[data-scene="chartCurve"] .chart-para', 1],
    ['.collect-steps li:last-child', 1],
    // 판 없는 보드: 머리줄과 열 이름(--mute·#8a96b3 글자라 0.72로 엄격하게)이 흐려진 지도 위에서도 읽혀야 한다
    ['.data-board .board-head', 0.72],
    ['.data-board .board-table thead', 0.72],
    // 차트 3(bubble)·LIMITS(limits): 글 뒤 판이 없어진 카드형 챕터의 첫 본문 문단(코드 리뷰 2026-09-28)
    ['[data-scene="bubble"] > p:not(.eyebrow)', 1],
    ['[data-scene="limits"] > p:not(.eyebrow)', 1],
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
