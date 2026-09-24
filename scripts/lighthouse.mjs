// npm run lighthouse: 빌드 산출물(out/)을 띄워 세 언어 첫 화면을 Lighthouse(모바일 기본 설정)로 재고 점수·핵심 지표를 출력한다.
// 기록용이라 CI에서는 돌리지 않는다. 브라우저는 Playwright가 설치한 Chromium을 쓴다. 실행 전 npm run build가 필요하다.
import { execFileSync, spawn } from 'node:child_process';
import { mkdir, readFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const PORT = 4177;
const server = spawn('npx', ['serve', 'out', '-l', String(PORT), '--no-clipboard'], { stdio: 'ignore' });

// 고정 대기(2.5초) 대신 실제로 응답할 때까지 기다린다 — capture-og.mjs와 같은 패턴(느린 기기에서 2.5초로는 서버가 안 뜰 수 있음)
async function waitForServer(url, timeoutMs = 15_000) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    try { if ((await fetch(url)).status === 200) return; } catch { /* 아직 안 떴음 */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`${url}이(가) 응답하지 않았다`);
}

await waitForServer(`http://localhost:${PORT}/`);
await mkdir('.lighthouse', { recursive: true });
try {
  for (const [locale, path] of [['ko', '/'], ['en', '/en/'], ['ja', '/ja/']]) {
    const out = `.lighthouse/${locale}.json`;
    execFileSync('npx', ['-y', 'lighthouse@13', `http://localhost:${PORT}${path}`, '--quiet', '--output=json', `--output-path=${out}`,
      `--chrome-path=${chromium.executablePath()}`, '--chrome-flags=--headless=new', '--only-categories=performance,accessibility,best-practices,seo'], { stdio: 'inherit' });
    const r = JSON.parse(await readFile(out, 'utf8'));
    const score = (k) => Math.round(r.categories[k].score * 100);
    const a = r.audits;
    console.log(`${locale}: 성능 ${score('performance')} · 접근성 ${score('accessibility')} · 권장사항 ${score('best-practices')} · SEO ${score('seo')}`
      + ` | LCP ${a['largest-contentful-paint'].displayValue} · CLS ${a['cumulative-layout-shift'].displayValue} · TBT ${a['total-blocking-time'].displayValue}`);
  }
} finally {
  server.kill();
}
