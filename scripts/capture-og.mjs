// 링크 미리보기(OG) 이미지 생성: 실제 3D 첫 화면을 캡처 모드로 열고, 사이트 글꼴로 이름·역할을 얹어 1200×630으로 찍는다.
// CJK 글꼴 파일을 따로 넣지 않으려고 빌드 시 생성(next/og) 대신 이 방식을 쓴다. 실행 전 npm run build가 필요하다.
import { spawn } from 'node:child_process';
import { mkdir, readFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import sharp from 'sharp';

const PAGES = [['ko', '/'], ['en', '/en/'], ['ja', '/ja/']];
const PORT = 4176; // e2e(4173)·대체 이미지(4174)와 겹치지 않게
const server = spawn('npx', ['serve', 'out', '-l', String(PORT), '--no-clipboard'], { stdio: 'ignore' });

async function waitForServer(url, timeoutMs = 15_000) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    try { if ((await fetch(url)).status === 200) return; } catch { /* 아직 안 떴음 */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`${url}이(가) 응답하지 않았다`);
}

let browser;
try {
  await waitForServer(`http://localhost:${PORT}/`);
  browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await mkdir('public/og', { recursive: true });
  for (const [locale, path] of PAGES) {
    const content = JSON.parse(await readFile(`content/${locale}.json`, 'utf8'));
    await page.goto(`http://localhost:${PORT}${path}?capture=hero`);
    await page.waitForFunction(() => window.__sceneReady === true, null, { timeout: 30_000 });
    await page.evaluate(({ sub, role }) => {
      // 본문·헤더·언어 안내를 숨기고 캔버스만 남긴 뒤, 왼쪽 아래에 이름 카드를 얹는다(사이트 글꼴 클래스 재사용)
      for (const sel of ['main', '.site-header', '.lang-hint', '.skip']) document.querySelectorAll(sel).forEach((el) => { el.style.visibility = 'hidden'; });
      const card = document.createElement('div');
      card.style.cssText = 'position:fixed;left:72px;bottom:64px;z-index:10;padding:28px 32px;border-radius:16px;background:rgba(7,11,22,.82);box-shadow:0 0 64px 32px rgba(7,11,22,.82)';
      const line = (text, cls, css) => { const p = document.createElement('p'); p.className = cls; p.textContent = text; p.style.cssText = css; card.append(p); };
      line('CHOI HALIM', 'display', 'font-size:104px;color:#EEF3FF');
      if (sub) line(sub, '', 'margin-top:10px;font-size:30px;color:rgba(238,243,255,.72)');
      line(role, 'mono', 'margin-top:22px;font-size:26px;letter-spacing:.18em;color:#FFB547');
      document.body.append(card);
    }, { sub: content.hero.nameSub, role: content.hero.role });
    await page.evaluate(() => document.fonts.ready);
    const png = await page.screenshot({ type: 'png' });
    await sharp(png).jpeg({ quality: 84, mozjpeg: true }).toFile(`public/og/${locale}.jpg`);
    console.log(`og/${locale}.jpg`);
  }
} finally {
  await browser?.close();
  server.kill();
}
