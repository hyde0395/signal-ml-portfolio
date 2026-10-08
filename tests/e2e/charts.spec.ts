// ③ 와플·④ 차트 그림 판 e2e: 3D가 꺼지면 2D로 그리고 이름표를 붙인다, 와플 이름표에 마우스를 올리면 피처 이름,
// 데이터를 못 받으면 안내, 창 크기를 바꾸면 다시 배치, 3D가 도중에 꺼지면 그 자리에서 2D로,
// 3D가 켜져 있으면 스크롤한 차트로 배경 점 배치가 바뀐다(html[data-chart]) — 순서를 섞어 건너뛰어도 멈춘 차트.
// ③ 와플 그룹을 누르면 SHAP 벌떼로 펼친다(계획 5-3c) — 누르기·키보드·Esc·그룹 바꾸기·axe·휴대폰.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// e2e(ESM)에서는 JSON 정적 import가 실패해 fs로 읽는다(board.spec.ts와 같은 방식). 피처 줄 개수의 기준
const facts = JSON.parse(readFileSync(fileURLToPath(new URL('../../data/facts.json', import.meta.url)), 'utf-8')) as {
  model: { featureGroups: { features: string[] }[] };
  data: { filteredRows: number; filter: { direct: number } };
};

const STAGES = ['chartFilter', 'chartModel', 'features', 'chartDepart', 'chartCurve', 'chartSplit', 'chartCloud'] as const;

async function painted(page: Page, key: string) {
  return page.locator(`.chart-block[data-scene="${key}"] .chart-canvas`).evaluate((c: HTMLCanvasElement) => {
    if (c.width === 0) return false;
    const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 0) return true;
    return false;
  });
}

const center = (page: Page, sel: string) => page.locator(sel).first().evaluate((n) => n.scrollIntoView({ block: 'center' }));

test.describe('3D 꺼짐(움직임 줄이기)', () => {
  test.use({ reducedMotion: 'reduce' });

  for (const key of STAGES) {
    test(`${key}: 2D로 그리고 이름표를 붙인다`, async ({ page }) => {
      await page.goto('/');
      await expect(page.locator('html')).toHaveAttribute('data-3d', 'off');
      await center(page, `.chart-block[data-scene="${key}"]`);
      await expect.poll(() => painted(page, key), { timeout: 10_000 }).toBe(true);
      await expect(page.locator(`.chart-block[data-scene="${key}"]`).locator('.chart-label, .chart-group').first()).toBeAttached();
    });
  }

  // 별자리 선(점 위계 계획): 움직임 줄이기에서는 점이 바로 자리 잡아 선도 바로 보인다
  for (const [key, n] of [['chartCurve', 1], ['chartCloud', 1], ['chartDepart', 1]] as const) {
    test(`${key}: 별자리 선이 그려진다`, async ({ page }) => {
      await page.goto('/');
      await center(page, `.chart-block[data-scene="${key}"]`);
      const svg = page.locator(`.chart-block[data-scene="${key}"] .chart-lines`);
      await expect(svg).toHaveAttribute('data-on', '', { timeout: 10_000 });
      await expect(svg.locator('path')).toHaveCount(n);
      expect(await svg.locator('path').first().getAttribute('d')).toMatch(/^M[\d.]+ [\d.]+L/);
    });
  }
  // 설계 2026-10-08 §1: 차트 3은 점 판이 아니라 큰 숫자 두 장 — R² 전→후가 글자로, MAE 줄이 같은 카드 안에
  test('차트 3 R² 거품: 큰 숫자 두 장(전 → 후)과 MAE 줄', async ({ page }) => {
    await page.goto('/');
    const cards = page.locator('#validation .figs-r2 .fig-card');
    await expect(cards).toHaveCount(2);
    await expect(cards.first().locator('.fig-big')).toHaveText('R² 0.93 → 0.71');
    await expect(cards.nth(1).locator('.fig-big')).toHaveText('R² 0.84 → 0.64');
    await expect(cards.nth(1).locator('.fig-sub')).toContainText('48,442 → 48,235');
    await expect(page.locator('.chart-block[data-scene="chartBubble"]')).toHaveCount(0);
  });
  // 설계 2026-10-08 개정 4: 한계 = 단순 기준선 → 모델 평균 오차 큰 숫자, 아래 차이 한 줄
  test('⑤ 한계: 기준선 대 모델 큰 숫자와 차이', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#validation .figs-limits .limits-n')).toHaveText(['48,688원', '48,235원']);
    await expect(page.locator('#validation .limits-gap')).toHaveText('차이 −453원 (0.9%)');
  });
  // 설계 2026-10-08 §2: 운영 기준 대표값 세 개가 크게, 나머지 두 방식은 참고 표 두 줄
  test('⑤ 성능: 대표값 세 개 크게 + 참고 표 두 줄', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#validation .perf-big dd')).toHaveText(['0.637', '48,235원', '21.4%']);
    await expect(page.locator('#validation .figs-perf tbody tr')).toHaveCount(2);
  });
  test('④ U자: 결론 이름표 둘(최저·출발 직전)', async ({ page }) => {
    await page.goto('/');
    await center(page, '.chart-block[data-scene="chartCurve"]');
    await expect(page.locator('.chart-block[data-scene="chartCurve"] .chart-callout')).toHaveCount(2, { timeout: 10_000 });
  });
  test('⑤ 예측 구간 1440px: 칸에 점 20개, → 로 짚은 날을 바꾸면 칸 머리가 바뀐다', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await center(page, '.chart-block[data-scene="chartCloud"]');
    const block = page.locator('.chart-block[data-scene="chartCloud"]');
    await expect(block.locator('.chart-lines circle[r="5"]')).toHaveCount(20, { timeout: 10_000 });
    const head = block.locator('.chart-panelHead');
    const before = await head.textContent();
    await block.locator('.chart-touch').focus();
    await page.keyboard.press('ArrowRight');
    await expect(head).not.toHaveText(before ?? '');
  });
  test('⑤ 예측 구간 390px: 칸 없음, 가로 스크롤 없음', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await center(page, '.chart-block[data-scene="chartCloud"]');
    const block = page.locator('.chart-block[data-scene="chartCloud"]');
    await expect(block.locator('.chart-lines path')).toHaveCount(1, { timeout: 10_000 });
    await expect(block.locator('.chart-panelHead')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  // ③ 모델 구조 점(계획 7-2): 판이 고정된 스크롤 구간을 문단 수(4)로 나눈 자리마다 단계가 바뀐다 — 넷째 칸은 3단계 그대로
  test.describe('③ 모델 구조', () => {
    // 블록 안 고정 구간의 f 위치(0 = 판이 막 고정됨, 1 = 풀리기 직전)로 스크롤한다
    const scrollInto = (page: Page, f: number) => page.locator('.chart-block[data-scene="chartModel"]').evaluate((el, f) => {
      const r = el.getBoundingClientRect();
      window.scrollTo(0, window.scrollY + r.top + (r.height - window.innerHeight) * f);
    }, f);

    for (const [label, w, h] of [['데스크톱', 1440, 900], ['휴대폰', 390, 844]] as const) {
      test(`${label}: 문단이 바뀌면 점 단계가 바뀌고 2D로 다시 그린다, 이름표는 판 안, 가로 스크롤 없음`, async ({ page }) => {
        await page.setViewportSize({ width: w, height: h });
        await page.goto('/');
        const block = page.locator('.chart-block[data-scene="chartModel"]');
        const stage = block.locator('.chart-stage');
        const axis = block.locator('.chart-label.axis');
        for (const [f, n, para, fig] of [[0.2, '0', 0, 1], [0.8, '1', 1, 2]] as const) {
          // 움직임 줄이기라 첫 칸은 바로 마지막 sub(기준 가격) — data-sub 1, 그림 단계 1
          await scrollInto(page, f);
          await expect(stage).toHaveAttribute('data-stage', n, { timeout: 10_000 });
          await expect(block.locator('.chart-para').nth(para)).toHaveClass(/is-on/);
          await expect.poll(() => painted(page, 'chartModel'), { timeout: 10_000 }).toBe(true);
          await expect(axis).toHaveText(fig === 2 ? '기준 가격 대비' : '노선·등급 평균 대비');
          await expect(block.locator('.chart-label.head')).toHaveCount(1);
          const plot = (await block.locator('[data-plot]').boundingBox())!;
          for (const b of await block.locator('.chart-label').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON()))) {
            expect(b.left).toBeGreaterThanOrEqual(plot.x - 1);
            expect(b.right).toBeLessThanOrEqual(plot.x + plot.width + 1);
            expect(b.top).toBeGreaterThanOrEqual(plot.y - 1);
            expect(b.bottom).toBeLessThanOrEqual(plot.y + plot.height + 1);
          }
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
        // 조작 층 없음(보기 전용), 낭독기용 요약 문단은 있다
        await expect(block.locator('[role="slider"]')).toHaveCount(0);
        await expect(block.locator('.chart-copy .sr-only')).not.toBeEmpty();
      });
    }

    test('axe 위반 없음(2칸)', async ({ page }) => {
      await page.goto('/');
      await scrollInto(page, 0.8);
      await expect(page.locator('.chart-block[data-scene="chartModel"] .chart-stage')).toHaveAttribute('data-stage', '1', { timeout: 10_000 });
      const r = await new AxeBuilder({ page }).include('#features').analyze();
      expect(r.violations).toEqual([]);
    });
  });

  // 계획 8-1: 자막 칸이 바뀌면 단계, 단계 안에서는 sub가 저절로(움직임 줄이기 = 이 describe는 바로 마지막 sub)
  test.describe('② 걸러내기·⑤ 검증 설계', () => {
    const scrollInto = (page: Page, key: string, f: number) => page.locator(`.chart-block[data-scene="${key}"]`).evaluate((el, f) => {
      const r = el.getBoundingClientRect();
      window.scrollTo(0, window.scrollY + r.top + (r.height - window.innerHeight) * f);
    }, f);
    for (const [label, w, h] of [['1440', 1440, 900], ['390', 390, 844]] as const) {
      test(`${label}: 걸러내기 단계 0 → 1 → 2, 마지막에 걸러낸 행 수, 가로 스크롤 없음`, async ({ page }) => {
        await page.setViewportSize({ width: w, height: h });
        await page.goto('/');
        const stage = page.locator('.chart-block[data-scene="chartFilter"] .chart-stage');
        for (const [f, n] of [[0.12, '0'], [0.45, '1'], [0.8, '2']] as const) {
          await scrollInto(page, 'chartFilter', f);
          await expect(stage).toHaveAttribute('data-stage', n, { timeout: 10_000 });
        }
        await expect(stage).toHaveAttribute('data-sub', '1');
        const kept = new Intl.NumberFormat('ko').format(facts.data.filteredRows);
        await expect(stage.locator('.chart-label.stat').first()).toContainText(kept);
        const n = (v: number) => new Intl.NumberFormat('ko').format(v);
        await expect(stage.locator('.chart-label.ruleOn').last()).toContainText(n(facts.data.filter.direct));
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      });
      test(`${label}: 검증 설계 단계 0 → 1 → 2, TSS는 바로 FOLD 5 / 5`, async ({ page }) => {
        await page.setViewportSize({ width: w, height: h });
        await page.goto('/');
        const stage = page.locator('.chart-block[data-scene="chartSplit"] .chart-stage');
        for (const [f, n] of [[0.12, '0'], [0.45, '1'], [0.8, '2']] as const) {
          await scrollInto(page, 'chartSplit', f);
          await expect(stage).toHaveAttribute('data-stage', n, { timeout: 10_000 });
        }
        await expect(stage).toHaveAttribute('data-sub', '4');
        await expect(stage.locator('.chart-label.statSm', { hasText: 'FOLD 5 / 5' })).toBeAttached();
        await expect(stage.locator('.chart-label.scoreHi').first()).toContainText('TSS');
        // 지난 줄 2개 × 두 칸(좁은 판의 빈 MAE 칸도 cls는 scorePast — 자리 번호를 지키려고 빈 글자로 둔다)
        await expect(stage.locator('.chart-label.scorePast')).toHaveCount(4);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      });
    }
    // 8-1 최종 검토: 옆 칸 이름표가 판 밖으로 나가 가로 스크롤이 생기던 문제(영어가 가장 길다)
    for (const path of ['/en/', '/ja/']) for (const [w, h] of [[1024, 768], [768, 1024]] as const) {
      test(`${path} ${w}×${h}: 마지막 단계에서 이름표가 판 안, 가로 스크롤 없음`, async ({ page }) => {
        await page.setViewportSize({ width: w, height: h });
        await page.goto(path);
        for (const key of ['chartFilter', 'chartSplit']) {
          await scrollInto(page, key, 0.85);
          const block = page.locator(`.chart-block[data-scene="${key}"]`);
          await expect(block.locator('.chart-stage')).toHaveAttribute('data-stage', '2', { timeout: 10_000 });
          const m = await block.evaluate((el) => {
            const plot = el.querySelector('.chart-stage')!.getBoundingClientRect();
            const over = [...el.querySelectorAll('.chart-label')].map((n) => ({ t: n.textContent, r: n.getBoundingClientRect().right - plot.right })).filter((o) => o.r > 1);
            return { over, sw: document.documentElement.scrollWidth, iw: window.innerWidth };
          });
          expect(m.over, key).toEqual([]);
          expect(m.sw).toBeLessThanOrEqual(m.iw);
        }
      });
    }
    test('axe 위반 없음(두 블록·표 카드)', async ({ page }) => {
      await page.goto('/');
      await scrollInto(page, 'chartSplit', 0.8);
      await expect(page.locator('.chart-block[data-scene="chartSplit"] .chart-stage')).toHaveAttribute('data-stage', '2', { timeout: 10_000 });
      const r = await new AxeBuilder({ page }).include('#data').include('#validation').analyze();
      expect(r.violations).toEqual([]);
    });
  });

  test('이름표 개수: 출발일 눈금 4 + 요일 이름·값 14, 벌떼 구간 8 + 눈금 5, 와플 그룹 6', async ({ page }) => {
    await page.goto('/');
    for (const [key, sel, n] of [['chartDepart', '.chart-label.tick', 18], ['chartCurve', '.chart-label.tick', 13], ['features', '.chart-group', 6]] as const) {
      await center(page, `.chart-block[data-scene="${key}"]`);
      await expect(page.locator(`.chart-block[data-scene="${key}"] ${sel}`)).toHaveCount(n, { timeout: 10_000 });
    }
  });

  test('와플 그룹에 마우스를 올리면 설명 줄에 그 그룹, 다른 그룹은 흐려진다', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await center(page, '.chart-block[data-scene="features"]');
    const stage = page.locator('.chart-block[data-scene="features"]');
    const groups = stage.locator('.chart-group');
    await expect(groups).toHaveCount(6, { timeout: 10_000 });
    const detail = stage.locator('.chart-detail');
    await expect(detail).toBeEmpty();
    const name = (await groups.nth(2).locator('.chart-group-name').textContent())!;
    await groups.nth(2).hover();
    await expect(detail).toContainText(name);
    await expect(groups.nth(2)).toHaveClass(/is-focus/);
    await expect(groups.nth(0)).toHaveClass(/is-dim/);
    await expect(stage.locator('.chart-group-features')).toHaveCount(0); // 그룹마다 펼치던 목록은 없다
    await page.mouse.move(5, 5);
    await expect(detail).toBeEmpty();
    // 설명 줄은 그림 판 안, 와플 이름표보다 아래
    const d = (await detail.boundingBox())!, g = (await groups.nth(2).boundingBox())!, plot = (await stage.locator('[data-plot]').boundingBox())!;
    await groups.nth(2).hover();
    const d2 = (await detail.boundingBox())!;
    expect(d2.y).toBeGreaterThan(g.y + g.height - 1);
    expect(d2.y + d2.height).toBeLessThanOrEqual(plot.y + plot.height + 2);
    expect(d.x).toBeGreaterThanOrEqual(plot.x - 1);
  });

  test.describe('휴대폰 누르기', () => {
    test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });
    // 예전 "누르면 설명 줄" 토글은 펼치기로 바뀌었다. 좁은 판에서도 피처 이름표가 판 밖으로 나가 페이지가 가로로 늘지 않는지 본다
    test('누르면 SHAP 벌떼로 펼치고, 다시 누르면 닫힌다 — 판 안, 가로 스크롤 없음', async ({ page }) => {
      await page.goto('/');
      await center(page, '.chart-block[data-scene="features"]');
      const stage = page.locator('.chart-block[data-scene="features"]');
      const g = stage.locator('.chart-group').nth(0);
      await expect(g).toBeVisible({ timeout: 10_000 });
      await g.tap();
      await expect(g).toHaveAttribute('aria-expanded', 'true');
      const feats = stage.locator('.chart-label.feature');
      await expect(feats).toHaveCount(facts.model.featureGroups[0].features.length);
      const plot = (await stage.locator('[data-plot]').boundingBox())!;
      for (const b of await feats.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON()))) {
        expect(b.left).toBeGreaterThanOrEqual(plot.x - 1);
        expect(b.bottom).toBeLessThanOrEqual(plot.y + plot.height + 2);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
      await stage.locator('.chart-group').nth(0).tap();
      await expect(stage.locator('.chart-group').nth(0)).toHaveAttribute('aria-expanded', 'false');
      await expect(feats).toHaveCount(0);
    });
  });

  // 2026-09-28 회고: 이름표 칸 높이(labelPx)를 재실측한 뒤에도 가로가 짧은 휴대폰(가로 모드)과 영어(이름
  // 길이가 달라 줄바꿈이 다르다)에서 설명 줄이 이름표와 겹치지 않는지 확인한다
  for (const [label, path, w, h] of [
    ['가로 모드 휴대폰', '/', 844, 390],
    ['영어', '/en/', 1440, 900],
  ] as const) {
    test(`와플 설명 줄이 이름표와 겹치지 않는다 — ${label}(${w}×${h})`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await page.goto(path);
      await center(page, '.chart-block[data-scene="features"]');
      const stage = page.locator('.chart-block[data-scene="features"]');
      const groups = stage.locator('.chart-group');
      await expect(groups).toHaveCount(6, { timeout: 10_000 });
      await groups.nth(0).hover();
      const detail = stage.locator('.chart-detail');
      await expect(detail).not.toBeEmpty();
      const d = (await detail.boundingBox())!, plot = (await stage.locator('[data-plot]').boundingBox())!;
      const groupBoxes = await groups.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().bottom));
      for (const bottom of groupBoxes) expect(d.y).toBeGreaterThanOrEqual(bottom - 1);
      expect(d.y + d.height).toBeLessThanOrEqual(plot.y + plot.height + 2);
    });
  }

  // 계획 5-3b: 차트 1·2·4 조작 층(role=slider) — 마우스·키보드·손가락으로 짚으면 표시 상자(.chart-tip)에 값
  test('차트 1: 마우스를 올리면 표시 상자, 조작 층 valuetext가 같은 문장, 떠나면 숨는다', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await center(page, '.chart-block[data-scene="chartDepart"]');
    const stage = page.locator('.chart-block[data-scene="chartDepart"]');
    const slider = stage.locator('[role="slider"]');
    await expect(slider).toBeAttached({ timeout: 10_000 });
    await expect(stage.locator('.chart-tip')).toHaveCount(0); // 처음엔 짚은 항목이 없다
    await slider.hover();
    const tip = stage.locator('.chart-tip');
    await expect(tip).toBeVisible();
    await expect(tip).toContainText('평균 대비');
    await expect(slider).toHaveAttribute('aria-valuetext', (await tip.textContent())!);
    // 표시 상자는 판 안
    const t = (await tip.boundingBox())!, plot = (await stage.locator('[data-plot]').boundingBox())!;
    expect(t.x).toBeGreaterThanOrEqual(plot.x - 1);
    expect(t.x + t.width).toBeLessThanOrEqual(plot.x + plot.width + 1);
    expect(t.y).toBeGreaterThanOrEqual(plot.y - 1);
    // 판 오른쪽 끝에 붙여도 상자가 판 밖으로 안 나간다
    await page.mouse.move(plot.x + plot.width - 2, plot.y + plot.height / 2);
    // 마지막 항목으로 옮겨 간 뒤에 잰다 — 옮기기 전 상자를 재면 검사가 헛돈다
    await expect(slider).toHaveAttribute('aria-valuenow', (await slider.getAttribute('aria-valuemax'))!);
    const t2 = (await tip.boundingBox())!;
    expect(t2.x + t2.width).toBeLessThanOrEqual(plot.x + plot.width + 1);
    await page.mouse.move(5, 5);
    await expect(tip).toBeHidden();
    // 짚은 항목이 없으면 valuenow 0 대신 조작 안내가 읽힌다
    await expect(slider).toHaveAttribute('aria-valuetext', '좌우 화살표로 살펴보기');
  });

  test('차트 1: 판 위에서 휠을 굴리면 페이지가 스크롤된다', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await center(page, '.chart-block[data-scene="chartDepart"]');
    const slider = page.locator('.chart-block[data-scene="chartDepart"] [role="slider"]');
    await expect(slider).toBeAttached({ timeout: 10_000 });
    await slider.hover();
    const y0 = await page.evaluate(() => window.scrollY);
    await page.mouse.wheel(0, 400);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(y0 + 100);
  });

  test('차트 2: 처음부터 가장 싼 구간에 세로선과 표시 상자, 키보드로 옮긴다', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await center(page, '.chart-block[data-scene="chartCurve"]');
    const stage = page.locator('.chart-block[data-scene="chartCurve"]');
    const slider = stage.locator('[role="slider"]');
    await expect(slider).toBeAttached({ timeout: 10_000 });
    await expect(stage.locator('.chart-cursor')).toBeVisible();
    await expect(stage.locator('.chart-tip')).toBeVisible();
    await expect(slider).toHaveAttribute('aria-valuemax', '7');
    const start = Number(await slider.getAttribute('aria-valuenow'));
    await slider.focus();
    await page.keyboard.press(start < 7 ? 'ArrowRight' : 'ArrowLeft');
    await expect(slider).toHaveAttribute('aria-valuenow', String(start < 7 ? start + 1 : start - 1));
    await page.keyboard.press('End');
    await expect(slider).toHaveAttribute('aria-valuenow', '7');
    await page.keyboard.press('Home');
    await expect(slider).toHaveAttribute('aria-valuenow', '0');
    // 판을 떠나도(마우스) 차트 2는 마지막 구간이 남는다
    await slider.hover();
    await page.mouse.move(5, 5);
    await expect(stage.locator('.chart-cursor')).toBeVisible();
    await expect(slider).toHaveAttribute('aria-valuetext', /./);
  });

  test('차트 4: Tab으로 조작 층에 초점, 처음부터 한 날이 짚여 있고 → 로 다음 항목', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await center(page, '.chart-block[data-scene="chartCloud"]');
    const stage = page.locator('.chart-block[data-scene="chartCloud"]');
    const slider = stage.locator('[role="slider"]');
    await expect(slider).toBeAttached({ timeout: 10_000 });
    await expect(slider).toHaveAttribute('aria-label', /값 살펴보기$/);
    const start = Number(await slider.getAttribute('aria-valuenow'));
    expect(start).toBeGreaterThanOrEqual(0);
    // 앞 블록(검증 표)의 코드 링크에서 Tab 한 번 — 문서 순서상 바로 다음이 차트 4 조작 층이다
    await page.locator('.figs-chapter:has(.figs-perf) a.code-link').focus();
    await page.keyboard.press('Tab');
    await expect(slider).toBeFocused();
    const max = Number(await slider.getAttribute('aria-valuemax'));
    await page.keyboard.press(start < max ? 'ArrowRight' : 'ArrowLeft');
    await expect(slider).toHaveAttribute('aria-valuenow', String(start < max ? start + 1 : start - 1));
    await expect(stage.locator('.chart-tip')).toContainText('예측가');
  });

  test.describe('휴대폰 조작 층', () => {
    test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });
    test('차트 1을 가볍게 누르면 표시 상자가 보이고, 손을 떼도 남는다', async ({ page }) => {
      await page.goto('/');
      await center(page, '.chart-block[data-scene="chartDepart"]');
      const stage = page.locator('.chart-block[data-scene="chartDepart"]');
      await expect(stage.locator('[role="slider"]')).toBeAttached({ timeout: 10_000 });
      const plot = (await stage.locator('[data-plot]').boundingBox())!;
      await page.touchscreen.tap(plot.x + plot.width / 2, plot.y + plot.height / 2);
      const tip = stage.locator('.chart-tip');
      await expect(tip).toBeVisible();
      await expect(tip).toContainText('평균 대비');
      await page.waitForTimeout(300);
      await expect(tip).toBeVisible();
      const t = (await tip.boundingBox())!;
      expect(t.x).toBeGreaterThanOrEqual(plot.x - 1);
      expect(t.x + t.width).toBeLessThanOrEqual(plot.x + plot.width + 1);
    });

    // 표시 상자 문장이 판보다 길면(영어·좁은 화면) 판 폭에서 접힌다 — 한 줄로 삐져나가면 페이지 가로 폭이 늘어
    // 휴대폰 브라우저가 화면 전체를 축소한다(자막 띠 검사가 이걸로 깨졌다)
    test('영어 375px: 처음부터 떠 있는 차트 2 표시 상자가 판 안, 가로 스크롤 없음', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/en/');
      await center(page, '.chart-block[data-scene="chartCurve"]');
      const stage = page.locator('.chart-block[data-scene="chartCurve"]');
      const tip = stage.locator('.chart-tip');
      await expect(tip).toBeVisible({ timeout: 10_000 });
      const t = (await tip.boundingBox())!, plot = (await stage.locator('[data-plot]').boundingBox())!;
      expect(t.x).toBeGreaterThanOrEqual(plot.x - 1);
      expect(t.x + t.width).toBeLessThanOrEqual(plot.x + plot.width + 1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    });
  });

  test.describe('③ SHAP 벌떼 펼치기', () => {
    test.use({ viewport: { width: 1440, height: 900 } });
    const open = async (page: Page) => {
      await page.goto('/');
      await center(page, '.chart-block[data-scene="features"]');
      const stage = page.locator('.chart-block[data-scene="features"]');
      await expect(stage.locator('.chart-group')).toHaveCount(6, { timeout: 10_000 });
      return stage;
    };

    test('누르면 펼치고(피처 줄·요약·그림), Esc로 닫고 초점이 버튼으로', async ({ page }) => {
      const stage = await open(page);
      const b = stage.locator('.chart-group').nth(0);
      // 버튼 이름은 눈에 보이는 순서(%, 이름, 개수)와 같게 — 낭독과 화면이 어긋나지 않도록
      const [pct, name, count] = await Promise.all(['pct', 'name', 'count'].map((k) => b.locator(`.chart-group-${k}`).textContent()));
      await expect(b).toHaveAttribute('aria-label', `${pct} ${name} · ${count}`);
      await b.click();
      await expect(b).toHaveAttribute('aria-expanded', 'true');
      const n = facts.model.featureGroups[0].features.length;
      await expect(stage.locator('.chart-label.feature')).toHaveCount(n);
      await expect(stage.locator('#features-shap li')).toHaveCount(n);
      await expect(stage.locator('p.sr-only[role="status"]')).not.toBeEmpty();
      await expect(stage.locator('.chart-group')).toHaveCount(6); // 펼친 동안에도 작은 와플 줄로 남아 다른 그룹을 누를 수 있다
      await expect.poll(() => painted(page, 'features')).toBe(true);
      // 누른 버튼(판 안)에 초점이 있으니 Esc 뒤에도 그 버튼으로 돌아온다
      await page.keyboard.press('Escape');
      await expect(b).toHaveAttribute('aria-expanded', 'false');
      await expect(stage.locator('.chart-label.feature')).toHaveCount(0);
      await expect(b).toBeFocused();
    });

    test('키보드: Enter로 펼치고 Space로 닫는다', async ({ page }) => {
      const stage = await open(page);
      const b = stage.locator('.chart-group').nth(2);
      await b.focus();
      await page.keyboard.press('Enter');
      await expect(b).toHaveAttribute('aria-expanded', 'true');
      await expect(stage.locator('.chart-label.feature')).toHaveCount(facts.model.featureGroups[2].features.length);
      await page.keyboard.press('Space');
      await expect(b).toHaveAttribute('aria-expanded', 'false');
    });

    test('펼친 채 다른 작은 와플을 누르면 그 그룹으로 바뀐다(한 번에 하나)', async ({ page }) => {
      const stage = await open(page);
      await stage.locator('.chart-group').nth(0).click();
      await stage.locator('.chart-group').nth(3).click();
      await expect(stage.locator('.chart-group').nth(3)).toHaveAttribute('aria-expanded', 'true');
      await expect(stage.locator('.chart-group').nth(0)).toHaveAttribute('aria-expanded', 'false');
      await expect(stage.locator('.chart-label.feature')).toHaveCount(facts.model.featureGroups[3].features.length);
    });

    // 머리 줄 길이가 언어마다 달라 같은 줄의 색 범례(눈금 글자)와 부딪히기 쉽다 — 세 언어 모두 본다
    for (const path of ['/', '/en/', '/ja/']) {
      test(`${path} 머리 줄과 색 범례가 겹치지 않고, 이름표가 판 안`, async ({ page }) => {
        await page.goto(path);
        await center(page, '.chart-block[data-scene="features"]');
        const stage = page.locator('.chart-block[data-scene="features"]');
        await expect(stage.locator('.chart-group')).toHaveCount(6, { timeout: 10_000 });
        await stage.locator('.chart-group').nth(0).click();
        await expect(stage.locator('.chart-label.head')).toBeVisible();
        const head = (await stage.locator('.chart-label.head').boundingBox())!;
        const ticks = await stage.locator('.chart-label.tick').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON()));
        const plot = (await stage.locator('[data-plot]').boundingBox())!;
        for (const t of ticks) if (Math.abs(t.top - head.y) < 8) expect(t.left).toBeGreaterThanOrEqual(head.x + head.width);
        for (const b of [...ticks, { left: head.x, right: head.x + head.width }]) {
          expect(b.left).toBeGreaterThanOrEqual(plot.x - 1);
          expect(b.right).toBeLessThanOrEqual(plot.x + plot.width + 1);
        }
      });
    }

    test('펼친 상태 axe 위반 없음', async ({ page }) => {
      const stage = await open(page);
      await stage.locator('.chart-group').nth(0).click();
      await expect(stage.locator('.chart-label.feature').first()).toBeAttached();
      const r = await new AxeBuilder({ page }).include('.chart-block[data-scene="features"]').analyze();
      expect(r.violations).toEqual([]);
    });
  });

  test('차트 데이터를 못 받으면 안내가 뜨고 글 카드는 그대로다', async ({ page }) => {
    await page.route('**/data/charts.*.json', (r) => r.abort());
    await page.goto('/');
    await center(page, '.chart-block[data-scene="chartDepart"]');
    await expect(page.locator('.chart-block[data-scene="chartDepart"] .chart-error')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('#chart-depart')).toBeVisible();
  });

  // SHAP 데이터가 없어도 닫힌 와플은 멀쩡히 읽히므로 판 전체 오류(.chart-error)로 덮지 않는다 — 펼치지 않고
  // 낭독기 알림(숨은 role=status)에만 안내한다. 펼칠 수 없는 버튼이라 aria-expanded도 달지 않는다
  test('차트 데이터를 못 받아도 와플은 그리고, 누르면 펼치지 않고 알림에만 안내', async ({ page }) => {
    await page.route('**/data/charts.*.json', (r) => r.abort());
    await page.goto('/');
    await center(page, '.chart-block[data-scene="features"]');
    const stage = page.locator('.chart-block[data-scene="features"]');
    const groups = stage.locator('.chart-group');
    await expect(groups).toHaveCount(6, { timeout: 10_000 });
    for (let i = 0; i < 6; i++) await expect(groups.nth(i)).toBeVisible();
    await groups.nth(0).click();
    const announce = stage.locator('p.sr-only[role="status"]');
    await expect(announce).toHaveText('차트를 불러오지 못했습니다.');
    await expect(stage.locator('.chart-label.feature')).toHaveCount(0);
    await expect(stage.locator('.chart-error')).toBeEmpty();
    await expect(groups.nth(0)).not.toHaveAttribute('aria-expanded', /./);
  });

  test('창 크기를 바꾸면 다시 배치한다(이름표가 판 안에 남는다)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await center(page, '.chart-block[data-scene="chartCurve"]');
    await expect(page.locator('.chart-block[data-scene="chartCurve"] .chart-label.tick')).toHaveCount(13, { timeout: 10_000 });
    await page.setViewportSize({ width: 820, height: 900 });
    const plot = page.locator('.chart-block[data-scene="chartCurve"] [data-plot]');
    await expect.poll(async () => {
      const p = (await plot.boundingBox())!;
      const boxes = await page.locator('.chart-block[data-scene="chartCurve"] .chart-label.tick').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().right));
      return boxes.every((r) => r <= p.x + p.width + 2);
    }, { timeout: 5_000 }).toBe(true);
    // 선 svg도 새 판 크기를 따라가야 한다(옛 크기로 남으면 선이 점에서 어긋난다)
    const lines = page.locator('.chart-block[data-scene="chartCurve"] .chart-lines');
    await expect.poll(async () => {
      const pw = await plot.evaluate((e) => e.clientWidth);
      const w = Number(await lines.getAttribute('width'));
      const d = (await lines.locator('path').evaluateAll((ps) => ps.map((x) => x.getAttribute('d') ?? ''))).join(' ');
      const xs = [...d.matchAll(/[ML]\s*(-?[\d.]+)[ ,]/g)].map((m) => Number(m[1]));
      return Math.abs(w - pw) <= 1 && xs.length > 0 && xs.every((x) => x <= pw + 1);
    }, { timeout: 5_000 }).toBe(true);
  });

  // 설계 2026-09-28 §2: 글 상자는 그림 판 아래 띠에 고정되고, 어떤 스크롤 위치에서도 판과 겹치지 않는다
  for (const [w, h] of [[1440, 900], [390, 844]] as const) {
    test(`자막 띠 ${w}px: 스크롤 전 구간에서 글 상자가 그림 판 아래, 글 뒤 판 없음`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await page.goto('/');
      for (const key of STAGES) {
        const block = page.locator(`.chart-block[data-scene="${key}"]`);
        await block.evaluate((n) => n.scrollIntoView({ block: 'start' }));
        const copy = block.locator('.chart-copy');
        await expect(copy).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
        const { top, height } = await block.evaluate((n) => ({ top: n.getBoundingClientRect().top + window.scrollY, height: (n as HTMLElement).offsetHeight }));
        for (let k = 0; k <= 12; k++) {
          await page.evaluate((y) => window.scrollTo(0, y), top - h + ((height + h) * k) / 12);
          await page.waitForTimeout(80);
          const r = await block.evaluate((n) => {
            const c = n.querySelector<HTMLElement>('.chart-copy')!, p = n.querySelector('[data-plot]')!.getBoundingClientRect();
            return { copyTop: c.getBoundingClientRect().top, opacity: Number(getComputedStyle(c).opacity), plotBottom: p.bottom };
          });
          if (r.opacity > 0.05) expect(r.copyTop, `${key} 단계 ${k}`).toBeGreaterThanOrEqual(r.plotBottom - 1);
        }
      }
    });
  }

  test('문단이 여러 개인 블록은 한 번에 하나만, 끝까지 가면 마지막 문단', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    const block = page.locator('.chart-block[data-scene="chartCloud"]');
    const paras = block.locator('.chart-para');
    await expect(paras).toHaveCount(3);
    const { top, height } = await block.evaluate((n) => ({ top: n.getBoundingClientRect().top + window.scrollY, height: (n as HTMLElement).offsetHeight }));
    await page.evaluate((y) => window.scrollTo(0, y), top + 10);
    await expect(block.locator('.chart-para.is-on')).toHaveCount(1);
    await expect(paras.nth(0)).toHaveClass(/is-on/);
    await page.evaluate((y) => window.scrollTo(0, y), top + (height - 900) - 10);
    await expect(paras.nth(2)).toHaveClass(/is-on/);
    await expect(block.locator('.chart-para.is-on')).toHaveCount(1);
  });

  // 설계 2026-09-28 §2 후속 수정: 화면이 낮으면 글 상자가 CSS 고정 위치(61vh/55vh)보다 커서 아래로 넘친다 —
  // 그러면 motion/caption.ts가 상자를 위로 올려(stickTopFor) 다 붙었을 때(opacity ~1) 마지막 줄과
  // "코드 보기" 링크까지 화면 안에 들어오는지 확인한다(1440×900·390×844에서는 글이 다 들어가므로 위의
  // 겹침 검사가 그대로 통과해야 한다 — 이 검사와는 다른 크기에서만 상자가 올라간다)
  for (const [label, path, w, h] of [
    ['짧은 화면', '/', 844, 390],
    ['영어 좁은 화면', '/en/', 375, 667],
  ] as const) {
    test(`자막이 붙으면 글 전체와 코드 보기 링크가 화면 안에 들어온다 — ${label}(${w}×${h})`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await page.goto(path);
      for (const key of STAGES) {
        const block = page.locator(`.chart-block[data-scene="${key}"]`);
        const { top, height } = await block.evaluate((n) => ({ top: n.getBoundingClientRect().top + window.scrollY, height: (n as HTMLElement).offsetHeight }));
        // 한 번에 목표 위치로 건너뛰면(큰 폭의 scrollTo) 헤드리스 브라우저가 이따금 scroll 이벤트를
        // 아예 안 보낼 때가 있어(자막 스크립트가 갱신될 기회를 못 얻는다) 위의 겹침 검사처럼 잘게 나눠
        // 스크롤한다(실제 스크롤도 이렇게 여러 단계로 일어난다). scroll 이벤트도 직접 한 번 더 보내
        // (실제 스크롤은 항상 이 이벤트를 내보낸다) 자막 스크립트가 이번 스크롤 위치로 확실히 다시
        // 계산하게 한다. 고정 구간의 중간을 지나며 다 붙는(opacity ~1) 순간마다 검사한다
        const copy = block.locator('.chart-copy');
        const link = block.locator('a.code-link');
        let checked = false;
        for (let k = 0; k <= 12; k++) {
          await page.evaluate((y) => {
            window.scrollTo(0, y);
            window.dispatchEvent(new Event('scroll'));
          }, top - h + ((height + h) * k) / 12);
          await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
          await page.waitForTimeout(80);
          const opacity = await copy.evaluate((c) => Number(getComputedStyle(c).opacity));
          if (opacity < 0.99) continue; // 다 붙지 않았으면(들고 나는 중) 건너뛴다
          checked = true;
          const copyBox = (await copy.boundingBox())!;
          expect(copyBox.y + copyBox.height, `${key} 단계 ${k} 글 상자 아래`).toBeLessThanOrEqual(h + 1);
          const linkBox = (await link.boundingBox())!;
          expect(linkBox.y, `${key} 단계 ${k} 링크 위`).toBeGreaterThanOrEqual(-1);
          expect(linkBox.y + linkBox.height, `${key} 단계 ${k} 링크 아래`).toBeLessThanOrEqual(h + 1);
        }
        expect(checked, `${key}: 고정된 채 다 붙는 구간을 한 번도 못 만났다`).toBe(true);
      }
    });
  }
});

test('3D가 도중에 꺼지면 이미 불러온 판이 그 자리에서 2D로 그린다', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-3d', /^(on|off)$/, { timeout: 20_000 });
  await center(page, '.chart-block[data-scene="chartCloud"]');
  await expect(page.locator('.chart-block[data-scene="chartCloud"] .chart-label').first()).toBeAttached({ timeout: 10_000 });
  await page.evaluate(() => document.documentElement.setAttribute('data-3d', 'off'));
  // 판은 곧바로 그려지지만, 소프트웨어 렌더러(CI swiftshader)에서는 검사의 getImageData(GPU 캔버스 읽기) 한 번이
  // 몇 초씩 걸린다(CPU 4배 느리게 해서 0.8~4.3초 측정, 2026-09-28). 5초로는 CI에서 가끔 모자라 넉넉히 둔다
  await expect.poll(() => painted(page, 'chartCloud'), { timeout: 15_000 }).toBe(true);
  await expect(page.locator('.chart-block[data-scene="chartCloud"] .chart-lines path')).toHaveCount(1);
});

// 3D 켜짐 묶음 전용: html의 3D 속성이 기대값이 될 때까지 기다리되, 그사이 소프트웨어 렌더러(CI swiftshader)가 저프레임으로 3D를
// 끄면(data-3d="off") 실패가 아니라 건너뛴다 — 꺼진 뒤에는 검사할 3D 장면이 없다(시작 때 꺼져 있으면 beforeEach가 건너뛰는 것과
// 같은 규칙). 계획 9-3 잡음 밭 뒤로 CI 휴대폰에서 도중에 꺼지는 일이 잦아졌다(2026-10-04, 세 번 연속 다른 검사에서)
async function expect3D(page: Page, attr: string, value: string, timeout = 15_000): Promise<void> {
  const html = page.locator('html');
  await expect.poll(async () => ((await html.getAttribute('data-3d')) === 'off' ? '3D_OFF' : (await html.getAttribute(attr)) ?? ''),
    { timeout }).toMatch(new RegExp(`^(${value}|3D_OFF)$`));
  test.skip((await html.getAttribute('data-3d')) === 'off', '도중에 3D가 꺼짐(소프트웨어 렌더러 저프레임)');
}

test.describe('3D 켜짐', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-3d', /^(on|off)$/, { timeout: 20_000 });
    test.skip((await page.locator('html').getAttribute('data-3d')) !== 'on', '3D가 꺼진 환경(소프트웨어 렌더러 저프레임)');
  });

  // 시각을 직접 재서 비교한다: 판이 50% 보인 시각(IntersectionObserver)과 선 svg가 data-on을 얻은 시각(MutationObserver)의 간격이
  // linesDelay(3D)만큼 벌어져야 한다. 둘 다 스크롤 전에 설치해 타이머와 경주하지 않고, 도중에 3D가 꺼지면(linesDelay가 0이 돼
  // 간격이 짧아짐) 결과를 믿을 수 없으니 건너뛴다
  test('3D 켜짐: 선은 점이 자리 잡은 뒤에 나타난다', async ({ page }) => {
    const block = page.locator('.chart-block[data-scene="chartCurve"]');
    await expect(block.locator('.chart-stage')).toBeAttached({ timeout: 10_000 });
    await page.evaluate(() => {
      const w = window as unknown as { __t: { seen?: number; on?: number; off3d: boolean } };
      w.__t = { off3d: false };
      const html = document.documentElement, blk = document.querySelector('.chart-block[data-scene="chartCurve"]')!;
      new MutationObserver(() => {
        if (html.getAttribute('data-3d') === 'off') w.__t.off3d = true;
        const svg = blk.querySelector('.chart-lines');
        if (svg?.hasAttribute('data-on') && w.__t.on === undefined) w.__t.on = performance.now();
      }).observe(document, { subtree: true, childList: true, attributes: true });
      new IntersectionObserver(([e]) => { if (e.isIntersecting && w.__t.seen === undefined) w.__t.seen = performance.now(); }, { threshold: 0.5 })
        .observe(blk.querySelector('.chart-stage')!);
    });
    await center(page, '.chart-block[data-scene="chartCurve"]');
    await expect3D(page, 'data-chart', 'chartCurve');
    await expect(block.locator('.chart-lines')).toHaveAttribute('data-on', '', { timeout: 10_000 });
    const t = await page.evaluate(() => (window as unknown as { __t: { seen?: number; on?: number; off3d: boolean } }).__t);
    test.skip(t.off3d, '도중에 3D가 꺼짐(소프트웨어 렌더러 저프레임)');
    expect(t.seen, '판이 보인 시각이 기록돼야 한다').toBeDefined();
    expect(t.on! - t.seen!).toBeGreaterThanOrEqual(900);
  });

  test('순서를 섞어 건너뛰어도 멈춘 차트의 배치로 바뀐다', async ({ page }) => {
    for (const key of ['chartCloud', 'chartFilter', 'features', 'chartSplit', 'chartModel', 'chartCurve', 'chartDepart']) {
      // .chart-block: ④ 머리도 첫 판과 같은 data-scene(chartDepart)을 달아 [data-scene=…]만으로는 머리가 먼저 잡힌다
      await center(page, `.chart-block[data-scene="${key}"]`);
      await expect3D(page, 'data-chart', key);
    }
  });

  test('② 지도(problem) → 보드(dataBoard) → 걸러내기 판, 판 뒤에서 지도로 되돌아가지 않고 ③ 머리로', async ({ page }) => {
    await center(page, '.data-intro');
    await expect3D(page, 'data-active-scene', 'problem', 10_000);
    await center(page, '.data-board');
    await expect3D(page, 'data-active-scene', 'dataBoard', 10_000);
    await expect(page.locator('html')).not.toHaveAttribute('data-chart', /./);
    await center(page, '.chart-block[data-scene="chartFilter"]');
    await expect3D(page, 'data-chart', 'chartFilter', 15_000);
    // 2026-10-01 순서 변경 전에는 판 뒤에 보드(흐린 지도)가 와 배경이 지도로 되돌아갔다. 판 끝에서 ③ 머리까지
    // 화면 1/4씩 내려가며 활성 장면이 지도·보드로 돌아가지 않는지 본다
    const seen = new Set<string>();
    const until = await page.locator('#features-h').evaluate((n) => n.getBoundingClientRect().top + window.scrollY - window.innerHeight / 2);
    for (let y = await page.evaluate(() => window.scrollY); y < until; y += 225) {
      await page.evaluate((v) => window.scrollTo(0, v), y);
      await page.waitForTimeout(80);
      seen.add((await page.locator('html').getAttribute('data-active-scene')) ?? '');
    }
    await center(page, '#features-h');
    await expect3D(page, 'data-active-scene', 'model', 10_000);
    expect([...seen].filter((k) => k === 'problem' || k === 'dataBoard')).toEqual([]);
  });

  // 섹션 머리(제목) 자리는 다음 블록의 장면 — 장면이 없으면 앞 차트 배치가 제목 위에 멈추거나(① 아래 틈 처리 전에는)
  // ① 물결 줄로 되돌아갔다. ③ 와플 → ④ 제목은 지형을 거치지 않고 곧장 출발일 차트로 간다(2026-09-30)
  // ⑤ 머리는 큰 숫자 카드와 같은 점 없는 장면(blank, 설계 2026-10-08)
  test('③·④·⑤ 머리에서는 지형 → 출발일 차트 → 점 없음', async ({ page }) => {
    await center(page, '#features-h');
    await expect3D(page, 'data-active-scene', 'model', 10_000);
    await center(page, '.chart-block[data-scene="features"]');
    await expect3D(page, 'data-chart', 'features', 15_000);
    await center(page, '#findings-h');
    await expect3D(page, 'data-chart', 'chartDepart', 15_000);
    await center(page, '#validation-h');
    await expect3D(page, 'data-active-scene', 'blank', 10_000);
    await expect(page.locator('html')).not.toHaveAttribute('data-chart', /./);
  });
});

test.describe('③ 모델 구조 저절로 넘김(정보 전달 2 §7)', () => {
  test.use({ reducedMotion: 'no-preference' });
  test('첫 칸에서 sub 0 → 약 1.2초 뒤 1', async ({ page }) => {
    await page.goto('/');
    const block = page.locator('.chart-block[data-scene="chartModel"]');
    await block.evaluate((el) => { const r = el.getBoundingClientRect(); window.scrollTo(0, window.scrollY + r.top + (r.height - window.innerHeight) * 0.2); });
    const stage = block.locator('.chart-stage');
    await expect(stage).toHaveAttribute('data-stage', '0', { timeout: 10_000 });
    await expect(stage).toHaveAttribute('data-sub', '1', { timeout: 5_000 });
  });
});

test.describe('⑤ 검증 설계 TSS 반복(설계 2026-10-07 §5)', () => {
  test.use({ reducedMotion: 'no-preference' });
  test('폴드 5에 닿은 뒤 다시 폴드 1로 돌아온다', async ({ page }) => {
    await page.goto('/');
    const block = page.locator('.chart-block[data-scene="chartSplit"]');
    await block.evaluate((el) => { const r = el.getBoundingClientRect(); window.scrollTo(0, window.scrollY + r.top + (r.height - window.innerHeight) * 0.8); });
    const stage = block.locator('.chart-stage');
    await expect(stage).toHaveAttribute('data-stage', '2', { timeout: 10_000 });
    // 1.2초 × 4 = 4.8초에 폴드 5, 2.4초 머문 뒤 폴드 1
    await expect(stage).toHaveAttribute('data-sub', '4', { timeout: 8_000 });
    await expect(stage).toHaveAttribute('data-sub', '0', { timeout: 5_000 });
    await expect(stage).toHaveAttribute('data-sub', '1', { timeout: 3_000 });
  });
});
