// npm run lighthouse [-- --runs=3 --base=https://…]: 세 언어 첫 화면을 Lighthouse(모바일 기본 설정)로 N번 재고
// 회차별 값과 중앙값을 출력한다. --base가 없으면 빌드 산출물(out/)을 띄워 잰다(실행 전 npm run build). CI에서는 돌리지 않는다.
// 성능 규칙: 전후 비교는 3회 중앙값(.claude/rules/performance.md). 브라우저는 Playwright가 설치한 Chromium을 쓴다.
import { execFileSync, spawn } from 'node:child_process';
import { mkdir, readFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=') ?? d;
const RUNS = Number(arg('runs', '3'));
const PORT = 4177;
const BASE = arg('base', `http://localhost:${PORT}`).replace(/\/$/, '');
const local = !process.argv.some((a) => a.startsWith('--base='));
const server = local ? spawn('npx', ['serve', 'out', '-l', String(PORT), '--no-clipboard'], { stdio: 'ignore' }) : null;

// 고정 대기(2.5초) 대신 실제로 응답할 때까지 기다린다 — capture-og.mjs와 같은 패턴(느린 기기에서 2.5초로는 서버가 안 뜰 수 있음)
async function waitForServer(url, timeoutMs = 15_000) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    try { if ((await fetch(url)).status === 200) return; } catch { /* 아직 안 떴음 */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`${url}이(가) 응답하지 않았다`);
}

const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

try {
  // 서버 기동 대기·폴더 준비도 try 안에서 해야 여기서 실패해도 finally가 서버를 꼭 죽인다
  await waitForServer(`${BASE}/`);
  // 배포 직후 CDN이 차가우면 첫 회가 낮게 나온다 — 세 주소를 한 번씩 미리 받는다
  for (const p of ['/', '/en/', '/ja/']) await fetch(`${BASE}${p}`);
  await mkdir('.lighthouse', { recursive: true });
  for (const [locale, path] of [['ko', '/'], ['en', '/en/'], ['ja', '/ja/']]) {
    const rows = [];
    for (let i = 1; i <= RUNS; i++) {
      const out = `.lighthouse/${locale}-${i}.json`;
      execFileSync('npx', ['-y', 'lighthouse@13', `${BASE}${path}`, '--quiet', '--output=json', `--output-path=${out}`,
        `--chrome-path=${chromium.executablePath()}`, '--chrome-flags=--headless=new', '--only-categories=performance,accessibility,best-practices,seo'], { stdio: 'inherit' });
      const r = JSON.parse(await readFile(out, 'utf8'));
      const a = r.audits;
      const row = {
        perf: Math.round(r.categories.performance.score * 100), a11y: Math.round(r.categories.accessibility.score * 100),
        lcp: a['largest-contentful-paint'].numericValue, tbt: a['total-blocking-time'].numericValue,
        fcp: a['first-contentful-paint'].numericValue, cls: a['cumulative-layout-shift'].numericValue,
      };
      rows.push(row);
      console.log(`${locale}#${i}: 성능 ${row.perf} · 접근성 ${row.a11y} | LCP ${(row.lcp / 1000).toFixed(2)}s · TBT ${Math.round(row.tbt)}ms · FCP ${(row.fcp / 1000).toFixed(2)}s · CLS ${row.cls.toFixed(3)}`);
    }
    const m = (k) => median(rows.map((r) => r[k]));
    console.log(`== ${locale} 중앙값(${RUNS}회): 성능 ${m('perf')} · 접근성 ${m('a11y')} | LCP ${(m('lcp') / 1000).toFixed(2)}s · TBT ${Math.round(m('tbt'))}ms · FCP ${(m('fcp') / 1000).toFixed(2)}s · CLS ${m('cls').toFixed(3)}`);
  }
} finally {
  server?.kill();
}
