// 빌드 산출물(out/)의 gzip 용량을 스펙 §8.2 목표와 비교하는 순수 함수들. check-size.mjs가 파일을 읽어 넘기고, 단위 테스트가 직접 부른다.
import { gzipSync } from 'node:zlib';

// threeChunk: 스펙 "약 250KB"를 250,000B가 아니라 256,000B로 둔다(실측 244,928B가 목표 안이라는 계획 3 기록과 맞춤)
export const BUDGET = { initialJs: 150 * 1024, threeChunk: 256_000, terrain: 300 * 1024, demo: 500 * 1024, band: 50 * 1024 };

// 초기 HTML의 <script src>. noModule(옛 브라우저 전용 폴리필)은 요즘 브라우저가 받지 않으므로 초기 JS에서 뺀다
export function initialScripts(html) {
  const out = new Set();
  for (const m of html.matchAll(/<script\b[^>]*\bsrc="([^"]+\.js)"[^>]*>/g)) {
    if (!/\bnomodule\b/i.test(m[0])) out.add(m[1]);
  }
  return [...out];
}

export const gz = (buf) => gzipSync(buf).length;

export function check(items) {
  return items.map((i) => ({ ...i, ok: i.bytes <= i.limit }));
}
