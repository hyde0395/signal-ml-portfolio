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

test('3D가 켜져도 첫 화면 제목 영역이 움직이지 않는다(CLS)', async ({ page }) => {
  await page.goto('/');
  const box = async () => (await page.locator('.hero-copy').boundingBox())!;
  const before = await box();
  await expect(page.locator('html')).toHaveAttribute('data-3d', 'on', { timeout: 20_000 });
  const after = await box();
  expect(Math.abs(after.y - before.y)).toBeLessThanOrEqual(1);
  expect(Math.abs(after.x - before.x)).toBeLessThanOrEqual(1);
});

test('3D가 켜지는 환경에서는 첫 화면 대체 이미지를 받지 않는다(LCP는 제목 글자)', async ({ page }) => {
  const hero: string[] = [];
  page.on('request', (r) => { if (r.url().includes('/fallback/hero.webp')) hero.push(r.url()); });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-3d', 'on', { timeout: 20_000 });
  expect(hero).toEqual([]);
});

// 점 밀기·물결(계획 5-3a) 연기 검사: 셰이더가 컴파일되지 않거나 유니폼이 빠지면 3D가 오류로 꺼진다.
// 모양은 단위 테스트(pointer-field)와 눈 확인으로 본다 — 여기서는 움직여도 오류가 없는지만. 셰이더 오류는 페이지
// 오류가 아니라 three의 console.error로 나와서 둘 다 모은다. 끝에 "3D가 아직 켜짐"은 보지 않는다 — 소프트웨어
// 렌더러(CI)는 fps가 낮아 몇 초 뒤 스스로 꺼질 수 있다(이 변경과 무관한 정상 동작)
test('마우스를 움직이고 눌러도 오류가 없다(점 밀기)', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && /THREE|WebGL|shader/i.test(m.text())) errors.push(m.text()); });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-3d', 'on', { timeout: 20_000 });
  const vp = page.viewportSize()!;
  for (const [fx, fy] of [[0.7, 0.4], [0.5, 0.5], [0.3, 0.6]]) await page.mouse.move(vp.width * fx, vp.height * fy, { steps: 5 });
  await page.mouse.click(vp.width * 0.6, vp.height * 0.3);
  await page.waitForTimeout(500);
  expect(errors).toEqual([]);
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
  await expect(page.locator('h1')).toHaveText('SIGNAL');
  await expect(page.locator('#findings-h')).toBeVisible();
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

async function backgroundContrast(page: Page, selector: string, alpha: number, scroll = true) {
  const el = page.locator(selector).first();
  if (scroll) {
    await el.evaluate((n) => n.scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(3500); // 카메라·uniform이 새 장면으로 옮겨 가는 시간
  }
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
  // 검사 자리 16곳마다 카메라가 옮겨 가길 3.5초씩 기다려 고정 대기만 56초다. 여기에 3D 판정(최대 20초)과 소프트웨어
  // 3D 화면 찍기 16번이 더해져, 여러 워커가 함께 돌면 90초를 넘겨 중간에 끊겼다(--repeat-each·--workers=4로 재현).
  // 대기 자체는 시간 기준(카메라 damp가 경과 시간으로 수렴)이라 줄일 수 없어 한도를 늘린다
  test.setTimeout(180_000);
  await page.goto('/');
  // Backdrop은 마운트 뒤 SLOW_START_MS(20초)에 판정을 끝낸다 — 같은 20초만 기다리면 "pending"에서 실패했다. 그 타이머도
  // 메인 스레드에서 돌아, 소프트웨어 3D의 동기 GL 호출(셰이더 컴파일·점 버퍼 올리기)이 병렬 브라우저 8개와 겹쳐 밀리면
  // 30초 넘게 pending인 것을 봤다(부하 평균 30 이상). 이 검사는 한도가 180초라 45초까지 기다려도 여유가 있다.
  // off로 끝났으면 3D 위 대비라는 이 검사의 전제가 없으므로 건너뛴다
  await expect(page.locator('html')).toHaveAttribute('data-3d', /^(on|off)$/, { timeout: 45_000 });
  test.skip((await page.locator('html').getAttribute('data-3d')) !== 'on', '3D가 켜지지 않음(느린 시작 제한 시간)');
  await page.evaluate(() => document.querySelector('.lang-hint')?.remove()); // 떠 있는 언어 안내가 영역을 가리지 않게
  const cases: [string, number][] = [
    ['.hero-keywords', 0.72],
    // 머리말: 전환(계획 6-5) 동안 점이 글 뒤를 지나간다. 작은 줄은 --mute라 0.72로 엄격하게
    ['#intro-h', 1],
    ['.intro-note', 0.72],
    ['#project-h', 1],
    ['.project-lead', 0.72],
    ['#findings-h', 1],
    // ⑤ 머리는 U자 판이 빠져나가는 자리 위에 뜬다(설계 2026-09-29 이야기 흐름 §3.4)
    ['#validation-h', 1],
    // .is-on을 셀렉터에 넣으면 안 된다 — scrollIntoView가 그 클래스를 붙이는 스크롤 자체이므로, 셀렉터가
    // 미리 그 클래스를 요구하면 되돌아오지 않는다(닭이 먼저냐 요소가 먼저냐). 차트 2는 문단이 하나뿐이라
    // 화면 안에 들어오면 항상 is-on이 된다(motion/caption.ts activeParagraph, count<=1)
    ['[data-scene="chartCurve"] .chart-para', 1],
    ['.collect-steps li:last-child', 1],
    // 판 없는 보드: 머리줄과 열 이름(--mute·#8a96b3 글자라 0.72로 엄격하게)이 흐려진 지도 위에서도 읽혀야 한다
    ['.data-board .board-head', 0.72],
    ['.data-board .board-table thead', 0.72],
    // ③ 머리(계획 7-2): 모델 구조 판이 들어오기 전, 와플 판이 빠져나간 뒤의 자리 위에 뜬다. 모델 구조 글은 자막 띠라
    // 점이 오지 않는다(차트 2 문단과 같은 이유로 따로 재지 않는다)
    ['#features-h', 1],
    // 차트 3(bubble)·LIMITS(limits): 글 뒤 판이 없어진 카드형 챕터의 첫 본문 문단(코드 리뷰 2026-09-28)
    ['[data-scene="bubble"] > p:not(.eyebrow)', 1],
    ['[data-scene="limits"] > p:not(.eyebrow)', 1],
  ];
  for (const [sel, alpha] of cases) {
    const { mean, p99 } = await backgroundContrast(page, sel, alpha);
    expect(mean, `${sel} 평균 배경 대비 ${mean.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
    expect(p99, `${sel} 밝은 쪽 99% 화소 대비 ${p99.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
  }
  // 잡음 → 신호(계획 9-3): 머리말 글이 화면에 붙은 동안 잡음 밭과 그어지는 U자 위에서도 읽혀야 한다. 신호 단계 가운데
  // (yA와 yB 사이 60%)로 스크롤하고 시계(최대 0.28/초)가 따라올 때까지 기다린다. 여백(hero-runway)이 없으면 머리말이 붙지 않는다
  if (await page.evaluate(() => document.documentElement.classList.contains('hero-runway'))) {
    await page.evaluate(() => {
      const vh = innerHeight, r = document.getElementById('intro')!.getBoundingClientRect();
      const yA = r.top + scrollY + 0.25 * vh, yB = r.bottom + scrollY - vh;
      window.scrollTo(0, yA + (yB - yA) * 0.6);
    });
    const html = page.locator('html');
    // 소프트웨어 렌더러가 도중에 3D를 끄면(저프레임) 전제가 없어지므로 건너뛴다
    await expect.poll(async () => ((await html.getAttribute('data-3d')) === 'on' ? html.getAttribute('data-signal') : '0.600'), { timeout: 15_000 }).toBe('0.600');
    test.skip((await html.getAttribute('data-3d')) !== 'on', '도중에 3D가 꺼짐(프레임 저하)');
    await page.waitForTimeout(1500);
    for (const [sel, alpha] of [['#intro-h', 1], ['.intro-note', 0.72]] as const) {
      const { mean, p99 } = await backgroundContrast(page, sel, alpha, false);
      expect(mean, `신호 단계 ${sel} 평균 배경 대비 ${mean.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
      expect(p99, `신호 단계 ${sel} 밝은 쪽 99% 화소 대비 ${p99.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
    }
  }
  // 상단 바의 선택 안 된 언어 링크(--mute, 11px): 맨 위(첫 화면 하늘 위)에서만 전부 보이므로 끝에 맨 위로 돌아가 잰다.
  // 목록 맨 앞에 넣으면 그 대기(3.5초)만큼 첫 화면 비행기 빛줄기 시점이 밀려 첫 화면 글(당시 .hero-sub) 화소 검사가 흔들렸다
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page.locator('html')).toHaveAttribute('data-header', 'top');
  const langSel = '.site-header .lang-switch a:not([aria-current])';
  const lang = await backgroundContrast(page, langSel, 0.72);
  expect(lang.mean, `${langSel} 평균 배경 대비 ${lang.mean.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
  expect(lang.p99, `${langSel} 밝은 쪽 99% 화소 대비 ${lang.p99.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
});

for (const path of ['/', '/ja/']) {
  test(`${path} 3D가 켜진 상태에서 axe 위반 없음`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator('html')).toHaveAttribute('data-3d', 'on', { timeout: 20_000 });
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(result.violations).toEqual([]);
  });
}
