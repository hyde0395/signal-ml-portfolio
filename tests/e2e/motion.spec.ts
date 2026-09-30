// 연출 e2e: 로딩 화면(1.2초 뒤 사라짐, 재방문 생략, 움직임 줄이기 생략), 제목 리빌, GATE 플립의 완성값·낭독,
// 연출 라이브러리가 초기 청크에 없는지.
import { expect, test } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// site.spec.ts와 같은 이유로 JSON은 fs로 읽는다(Playwright TS 로더의 JSON import 제약).
// 로딩 화면 문구의 숫자를 하드코딩하지 않고 facts.json에서 읽어, 데이터가 바뀌어도 이 테스트가
// 아니라 facts.json만 고치면 되게 한다. Loader가 쓰는 것과 같은 포맷(en-US 천단위 콤마)을 쓴다.
const facts = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../data/facts.json', import.meta.url)), 'utf-8'),
) as { data: { filteredRows: number } };
const rows = new Intl.NumberFormat('en-US').format(facts.data.filteredRows);

test('로딩 화면은 1.2초 안팎에 사라지고, 같은 세션 새로고침에는 없다', async ({ page }) => {
  await page.goto('/');
  const loader = page.locator('.loader');
  await expect(loader.locator('.loader-label').first()).toHaveText('NOW BOARDING');
  await expect(loader.locator('.loader-bar')).toBeAttached();
  // 페이지를 받는 데 1.2초 넘게 걸리는 환경(CI)도 있어 "보인다"는 검사하지 않는다 — 처음 방문엔 생략되지 않았고, 곧 사라지는지만 본다.
  // 타임아웃은 demo.spec.ts의 슬라이더 대기(15_000)처럼 넉넉히 잡는다 — CSS 애니메이션 자체는 1.2초면 끝나지만,
  // 여러 워커가 동시에 소프트웨어 3D 렌더러(swiftshader)를 돌리는 병렬 실행에서는 브라우저 메인 스레드가 밀려
  // 실제 완료까지 3초를 넘기는 경우가 있었다(--repeat-each로 재현)
  await expect(page.locator('html')).not.toHaveClass(/no-loader/);
  await expect(loader).toBeHidden({ timeout: 10_000 });
  await expect(page.locator('.loader [data-count] .sr-only')).toHaveText(rows);
  await page.reload();
  await expect(page.locator('html')).toHaveClass(/no-loader/);
  await expect(loader).toBeHidden();
});

test.describe('움직임 줄이기', () => {
  test.use({ reducedMotion: 'reduce' });
  test('로딩 화면·리빌·플립 없이 최종 글자가 바로 보인다', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.loader')).toBeHidden();
    await page.locator('#features').scrollIntoViewIfNeeded();
    // 애니메이션이 있었다면 끝났을 시간까지 기다려도 .reveal-word가 하나도 안 생기는지 본다
    // (Motion.tsx가 움직임 줄이기에서는 run.ts를 아예 안 불러와 검사할 "완료 신호"가 없다 — 부재를 확인하는 유일한 방법은 시간 경과)
    await page.waitForTimeout(1500);
    await expect(page.locator('.reveal-word')).toHaveCount(0);
    await expect(page.locator('#data .eyebrow').first()).toHaveText('02 — DATA COLLECTION');
  });
});

test('제목은 화면에 들어오면 단어 단위로 떠올라 끝내 보인다', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-3d', /^(on|off)$/, { timeout: 20_000 });
  const h = page.locator('#features-h');
  await h.scrollIntoViewIfNeeded();
  await expect(h.locator('.reveal-word').first()).toBeAttached({ timeout: 5_000 });
  // 고정 대기 대신 opacity가 1에 닿을 때까지 폴링한다 — 0.9초+단어 지연은 환경(CI vs 로컬)에 따라
  // 조금씩 달라질 수 있어, 정확히 그 시간만큼만 기다리면 느린 환경에서 흔들릴 수 있다
  const lastWord = h.locator('.reveal-word > span').last();
  await expect
    .poll(async () => Number(await lastWord.evaluate((n) => getComputedStyle(n).opacity)), { timeout: 5_000 })
    .toBe(1);
});

// 3D가 켜지면 .chapter가 min-height:100vh로 늘어나 페이지가 길어진다(CHART 02 머리표가 574~655px 아래로). 트리거
// 위치를 다시 재지 않으면 리빌·플립이 옛 위치(더 위)에서 미리 터져, 화면에 들어오기 전에 이미 끝나 있다(run.ts의
// ResizeObserver가 막는다). 리빌과 플립은 같은 ScrollTrigger 위치 계산을 쓰므로, 발동 여부가 DOM에 바로 드러나는
// 플립(발동하면 sr-only 완성값이 생긴다)으로 본다 — 리빌의 opacity는 진행 중 값과 끝난 값을 가르려면 오래 기다려야 한다.
// 페이지 아래쪽(#features-h)은 swiftshader에서 3D가 무거워(약 11fps) 병렬 실행 전체를 멈춰 세웠으므로 위쪽 챕터를 쓴다.
test('3D가 켜져 페이지가 길어진 뒤에도 GATE 플립은 제목이 화면에 들어올 때 시작한다', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/');
  // 3D 판정은 Backdrop 마운트 뒤 늦어도 SLOW_START_MS(20초)에 on/off로 끝난다. 여기서도 20초만 기다리면 두 시계가
  // 거의 같이 끝나 부하가 크면 "pending"에서 실패했다. 판정이 끝날 때까지 넉넉히 기다리고, off로 끝났으면 이 검사의
  // 전제(3D가 켜진 긴 페이지)가 없으므로 아래 도중 꺼짐과 같이 건너뛴다
  await expect(page.locator('html')).toHaveAttribute('data-3d', /^(on|off)$/, { timeout: 30_000 });
  test.skip((await page.locator('html').getAttribute('data-3d')) !== 'on', '3D가 켜지지 않음(느린 시작 제한 시간)');
  await expect(page.locator('.reveal-word').first()).toBeAttached({ timeout: 10_000 }); // 연출 시작됨
  // run.ts는 본문 크기 변화를 150ms 모아 refresh한다 — 그 창 안에서 스크롤하면 옛 위치로 판정되므로 잠시 기다린다
  await page.waitForTimeout(500);
  const gate = page.locator('[data-scene="chartCurve"] [data-flip-on-enter]');
  // 제목 윗변을 화면 높이 95% 지점에 둔다 — 트리거(85%)에는 아직 닿지 않은 자리
  await gate.evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 0.95 * window.innerHeight));
  await page.waitForTimeout(500); // Lenis가 자리 잡고 ScrollTrigger가 스크롤을 반영할 시간
  const flipped = await gate.locator('.sr-only').count();
  // 부하가 큰 환경(swiftshader 병렬)에서는 프레임 감시가 도중에 3D를 꺼(페이지가 다시 짧아짐) 이 검사의
  // 전제(3D가 켜진 긴 페이지)가 깨질 수 있다 — 그때는 건너뛴다
  test.skip((await page.locator('html').getAttribute('data-3d')) !== 'on', '도중에 3D가 꺼져 전제가 깨짐(프레임 저하)');
  expect(flipped).toBe(0);
  await gate.evaluate((n) => n.scrollIntoView({ block: 'center' }));
  await expect(gate.locator('.sr-only')).toHaveText('CHART 02', { timeout: 5_000 });
});

test('머리표는 플립 뒤 완성값이고, 스크린리더용 완성값이 따로 있다', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-3d', /^(on|off)$/, { timeout: 20_000 });
  const gate = page.locator('[data-scene="bubble"] .eyebrow');
  await gate.scrollIntoViewIfNeeded();
  await expect(gate.locator('.sr-only')).toHaveText('CHART 03', { timeout: 5_000 });
  await expect(gate.locator('[aria-hidden="true"]')).toHaveText('CHART 03', { timeout: 2_000 });
});

test('연출 라이브러리(ScrollTrigger·Lenis)는 초기 HTML이 직접 불러오지 않는다', async () => {
  const dir = 'out/_next/static/chunks';
  const chunks = readdirSync(dir).filter((f) => f.endsWith('.js') && /ScrollTrigger|lenis/i.test(readFileSync(`${dir}/${f}`, 'utf8')));
  expect(chunks.length).toBeGreaterThan(0);
  for (const file of ['out/index.html', 'out/en/index.html', 'out/ja/index.html']) {
    const html = readFileSync(file, 'utf8');
    for (const f of chunks) expect(html, file).not.toContain(f);
  }
});
