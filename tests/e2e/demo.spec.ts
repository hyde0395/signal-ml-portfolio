// 데모 e2e: 처음 조합, 키보드·누르기 조작, 노선·등급 바꾸기, 조작 뒤 알림, 불러오기 실패 후 다시 시도,
// 움직임 줄이기, 세 언어 axe, 데이터 모듈(source.ts)이 초기 청크에 없는지.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// site.spec.ts와 같은 이유로 JSON은 fs로 읽는다(Playwright TS 로더의 JSON import 제약)
const read = (p: string) => JSON.parse(readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf-8'));
const facts = read('../../data/facts.json') as { demoDefault: { route: string; cabin: string; date: string } };
const ko = read('../../content/ko.json') as { demo: { routeLabel: string; error: string; retry: string; badges: Record<string, string> } };

async function openDemo(page: Page, path = '/') {
  await page.goto(path);
  // 3D가 늦게 켜지면(data-3d="on") 챕터가 화면 높이로 늘어나 데모 위치가 크게 바뀐다. 켜짐·꺼짐이 정해진 뒤에
  // 스크롤해야 이후 조작이 옮겨 간 자리를 누르지 않는다(좌표 클릭 테스트가 가끔 실패하던 원인)
  await expect(page.locator('html')).toHaveAttribute('data-3d', /^(on|off)$/, { timeout: 20_000 });
  await page.locator('#demo').scrollIntoViewIfNeeded();
  const slider = page.getByRole('slider');
  await expect(slider).toBeVisible({ timeout: 15_000 });
  return slider;
}

test('처음에는 facts.demoDefault 조합(DROP EXPECTED)이 선택돼 있다', async ({ page }) => {
  await openDemo(page);
  await expect(page.getByLabel(ko.demo.routeLabel)).toHaveValue(facts.demoDefault.route);
  await expect(page.locator('.demo-cabin')).toHaveText(facts.demoDefault.cabin);
  await expect(page.locator('.demo-result .badge [aria-hidden="true"]')).toHaveText('DROP EXPECTED');
});

test('/ja/: 추천 배지를 스크린리더가 일본어로 읽는다', async ({ page }) => {
  await openDemo(page, '/ja/');
  const ja = read('../../content/ja.json') as { demo: { badges: Record<string, string> } };
  await expect(page.locator('.demo-result .badge .sr-only')).toHaveText(ja.demo.badges.DROP_EXPECTED);
});

test('키보드: Home·→·End로 날짜를 고른다', async ({ page }) => {
  const slider = await openDemo(page);
  await slider.focus();
  await page.keyboard.press('Home');
  await expect(slider).toHaveAttribute('aria-valuenow', (await slider.getAttribute('aria-valuemin'))!);
  const first = (await slider.getAttribute('aria-valuetext'))!;
  await page.keyboard.press('ArrowRight');
  await expect(slider).not.toHaveAttribute('aria-valuetext', first);
  await page.keyboard.press('End');
  await expect(slider).toHaveAttribute('aria-valuenow', (await slider.getAttribute('aria-valuemax'))!);
});

// 모바일(Pixel 7) 프로젝트는 터치 포인터라 DateStrip이 pointerup(탭)에서만 날짜를 고른다.
// page.mouse.click은 마우스 포인터라 두 프로젝트 모두에서 통과하지만, 그러면 모바일에서도 실제로는
// 마우스 경로만 검증하게 된다. tap()으로 진짜 터치-탭 경로(pointerup 선택)를 타게 한다.
async function clickLeftEdge(page: Page, testInfo: TestInfo) {
  const slider = page.getByRole('slider');
  const box = (await slider.boundingBox())!;
  if (testInfo.project.name === 'mobile') {
    await slider.tap({ position: { x: 1, y: box.height / 2 } });
  } else {
    // 좌표를 미리 읽어 두지 않고 요소 기준으로 누른다 — Playwright가 누르기 직전에 위치를 다시 잡는다
    await slider.click({ position: { x: 1, y: box.height / 2 } });
  }
  return slider;
}

test('막대 왼쪽 끝을 누르면 첫 날짜가 선택된다', async ({ page }, testInfo) => {
  await openDemo(page);
  const slider = await clickLeftEdge(page, testInfo);
  await expect(slider).toHaveAttribute('aria-valuenow', (await slider.getAttribute('aria-valuemin'))!);
});

test('노선과 등급을 바꾸면 선택지와 막대가 새로 그려진다', async ({ page }) => {
  const slider = await openDemo(page);
  const before = (await slider.getAttribute('aria-valuetext'))!;
  const other = facts.demoDefault.route === 'ICN_KIX' ? 'ICN_NRT' : 'ICN_KIX';
  await page.getByLabel(ko.demo.routeLabel).selectOption(other);
  await page.locator('.demo-cabin').click();
  await expect(page.getByLabel(ko.demo.routeLabel)).toHaveValue(other);
  await expect(page.locator('.demo-cabin')).toHaveText(facts.demoDefault.cabin === 'LCC' ? 'FSC' : 'LCC');
  // 막대가 다시 그려지는 동안 잠깐 사라졌다 나타날 수 있으니, 값을 비교하기 전에 슬라이더가
  // 다시 화면에 떠 있는지부터 확인한다
  await expect(slider).toBeVisible();
  await expect(slider).not.toHaveAttribute('aria-valuetext', before);
});

test('조작한 뒤 결과를 aria-live로 알린다', async ({ page }) => {
  const slider = await openDemo(page);
  const live = page.locator('#demo [aria-live="polite"]');
  await expect(page.locator('.demo-result .badge')).toBeVisible();
  // 알림은 조작이 멈추고 700ms 뒤에 뜬다. "처음 표시 때는 알리지 않는다"는, 일어나지 않아야 할
  // 일이라 콜백을 기다릴 수 없다 — 700ms보다 넉넉히 긴 고정 대기로만 비어 있음을 확인할 수 있다
  await page.waitForTimeout(1000);
  await expect(live).toHaveText(''); // 처음 표시 때는 알리지 않는다
  await slider.focus();
  // 처음 날짜가 이미 끝이면 End나 Home 중 하나는 제자리라 조작으로 치지 않는다 → 둘 다 눌러 한 번은 바뀌게 한다
  await page.keyboard.press('End');
  await page.keyboard.press('Home');
  await expect(live).toContainText(new RegExp(Object.values(ko.demo.badges).join('|')));
  // 알림은 지금 화면의 배지(낭독용 문구)와 같은 결과여야 한다
  await expect(live).toContainText((await page.locator('.demo-result .badge .sr-only').textContent())!);
});

test('데모 데이터를 못 받으면 안내가 뜨고, 다시 시도하면 불러온다', async ({ page }) => {
  let fail = true;
  await page.route('**/data/demo.*.json', (r) => (fail ? r.fulfill({ status: 500, body: 'x' }) : r.continue()));
  await page.goto('/');
  await page.locator('#demo').scrollIntoViewIfNeeded();
  // getByRole('alert')만 쓰면 Next.js가 넣는 라우트 알림용 alert(#__next-route-announcer__)와
  // 겹쳐 strict mode 위반이 난다. #demo 안으로 좁힌다
  await expect(page.locator('#demo').getByRole('alert')).toContainText(ko.demo.error, { timeout: 15_000 });
  fail = false;
  await page.getByRole('button', { name: ko.demo.retry }).click();
  await expect(page.getByRole('slider')).toBeVisible();
  // 다시 불러온 뒤에는 실패 알림이 완전히 사라져야 한다(예: 재시도 실패 상태가 남아 있지 않음)
  await expect(page.locator('#demo').getByRole('alert')).toHaveCount(0);
});

test.describe('움직임 줄이기', () => {
  test.use({ reducedMotion: 'reduce' });
  test('데모가 그대로 동작한다', async ({ page }) => {
    const slider = await openDemo(page);
    await slider.focus();
    await page.keyboard.press('End');
    await expect(slider).toHaveAttribute('aria-valuenow', (await slider.getAttribute('aria-valuemax'))!);
    await expect(page.locator('.demo-result .badge')).toBeVisible();
  });
});

for (const path of ['/', '/en/', '/ja/']) {
  test(`${path} 데모를 불러온 뒤 axe 위반 없음`, async ({ page }) => {
    await openDemo(page, path);
    // 결과 영역(가격·배지)까지 그려진 뒤에 검사해야 실제로 보여 주는 상태를 검사한 게 된다
    await expect(page.locator('.demo-result .badge')).toBeVisible();
    const result = await new AxeBuilder({ page }).include('#demo').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(result.violations).toEqual([]);
  });
}

test('초기 HTML(세 언어)은 데모 데이터 모듈(source.ts) 청크를 직접 불러오지 않는다', async () => {
  const dir = 'out/_next/static/chunks';
  // zod 자체는 이 데모 데이터 모듈과 무관한 다른 경로(Backdrop→capability→ChapterFigure→
  // lib/content→facts)로 이미 초기 청크에 들어 있다(계획 4에서 정리 예정). 여기서 확인하는 건
  // src/demo/source.ts(데모 JSON 스키마 검사 모듈) 자체가 초기 청크에 직접 인라인되지 않았는지다.
  // 검사 메시지 머리말 문자열이 든 청크가 그 데이터 모듈 청크다
  const marker = 'demo-series-length-mismatch';
  const chunks = readdirSync(dir).filter((f) => f.endsWith('.js') && readFileSync(`${dir}/${f}`, 'utf8').includes(marker));
  expect(chunks.length).toBeGreaterThan(0);
  for (const file of ['out/index.html', 'out/en/index.html', 'out/ja/index.html']) {
    const html = readFileSync(file, 'utf8');
    for (const f of chunks) expect(html, file).not.toContain(f);
  }
});
