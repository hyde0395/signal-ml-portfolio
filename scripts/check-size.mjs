// npm run size: out/의 초기 JS(세 언어 페이지 각각), 3D 지연 청크, 데이터 JSON의 gzip 용량이 목표 안인지 확인한다.
// 하나라도 넘으면 exit 1(CI 실패). npm run build 뒤에 돌린다.
import { readdirSync, readFileSync } from 'node:fs';
import { BUDGET, check, gz, initialScripts } from './size-budget.mjs';

const v = JSON.parse(readFileSync('data/facts.json', 'utf8')).dataVersion;
const items = [];

for (const page of ['out/index.html', 'out/en/index.html', 'out/ja/index.html']) {
  const bytes = initialScripts(readFileSync(page, 'utf8')).reduce((sum, src) => sum + gz(readFileSync(`out${src}`)), 0);
  items.push({ name: `초기 JS ${page}`, bytes, limit: BUDGET.initialJs });
}

const dir = 'out/_next/static/chunks';
const three = readdirSync(dir).filter((f) => f.endsWith('.js') && readFileSync(`${dir}/${f}`, 'utf8').includes('WebGLRenderer'));
if (three.length === 0) throw new Error('3D 청크(WebGLRenderer)를 찾지 못했다 — npm run build를 먼저 돌린다');
for (const f of three) items.push({ name: `3D 청크 ${f}`, bytes: gz(readFileSync(`${dir}/${f}`)), limit: BUDGET.threeChunk });

for (const [key, file] of [['terrain', `terrain.${v}.json`], ['demo', `demo.${v}.json`], ['band', `band.${v}.json`]]) {
  items.push({ name: `데이터 ${file}`, bytes: gz(readFileSync(`out/data/${file}`)), limit: BUDGET[key] });
}

const results = check(items);
for (const r of results) {
  console.log(`${r.ok ? 'OK  ' : 'OVER'} ${(r.bytes / 1024).toFixed(1).padStart(7)}KB / ${(r.limit / 1024).toFixed(0)}KB  ${r.name}`);
}
if (results.some((r) => !r.ok)) process.exit(1);
