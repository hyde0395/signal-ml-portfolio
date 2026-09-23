// 3D 대체 이미지 생성: 실제 3D 장면을 캡처 모드로 열어 캔버스를 찍고 WebP로 저장한다.
// 대체 이미지가 3D와 똑같이 보이도록(스펙 §9.1) 손으로 만든 그림 대신 이 스크립트로 만든다.
// 실행 전 `npm run build`가 필요하다. 재학습으로 지형이 바뀌면 다시 실행해 커밋한다.
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import sharp from 'sharp';

const KEYS = ['hero', 'problem', 'insight', 'bubble', 'interval'];
const PORT = 4174; // e2e(4173)와 겹치지 않게
const server = spawn('npx', ['serve', 'out', '-l', String(PORT), '--no-clipboard'], { stdio: 'ignore' });

try {
  await new Promise((r) => setTimeout(r, 1500));
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  await mkdir('public/fallback', { recursive: true });
  for (const key of KEYS) {
    await page.goto(`http://localhost:${PORT}/?capture=${key}`);
    await page.waitForFunction(() => window.__sceneReady === true, null, { timeout: 30_000 });
    const png = await page.locator('.backdrop canvas').screenshot();
    // 캔버스는 투명 배경이라, 사이트 배경색을 깔고 WebP로 줄인다
    await sharp(png).flatten({ background: '#070B16' }).webp({ quality: 72 }).toFile(`public/fallback/${key}.webp`);
    console.log(`fallback/${key}.webp`);
  }
  await browser.close();
} finally {
  server.kill();
}
