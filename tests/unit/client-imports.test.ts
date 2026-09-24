// 클라이언트 번들 경계 검사: 검사 대상(entry)은 서버 컴포넌트가 정적으로 부르는 클라이언트 파일이다 —
// 서버 파일(비-'use client', src/·app/ 전체)이 정적 import로 직접 불러오는 'use client' 파일들이,
// 실제로 초기 번들에 들어가는 클라이언트 경계다. three/TerrainScene처럼 next/dynamic의 import()로만
// 불려오는 클라이언트 파일은 그 자체 지연 청크로 떨어지므로 entry에서 뺀다(STATIC_IMPORT 정규식이
// import() 호출 자체를 애초에 잡지 않는다). 각 entry에서 정적 import로 닿는 모든 모듈을 따라가, 서버
// 전용 모듈(lib/content: 세 언어 사전, lib/facts: 수치 + zod)이나 zod가 초기 JS에 끌려오지 않는지 확인한다.
// import type과 import()(지연 로딩)는 초기 청크를 늘리지 않으므로 따라가지 않는다.
// next/dynamic에 ssr:true를 주면 청크가 초기 HTML에 들어갈 수 있는데 이 검사는 import()를 모두 지연으로 본다 — 그 경우는 npm run size가 잡는다.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = fileURLToPath(new URL('../../src', import.meta.url));
const APP = fileURLToPath(new URL('../../app', import.meta.url));
const FORBIDDEN_FILES = ['lib/content.ts', 'lib/facts.ts'].map((f) => join(SRC, f));
const FORBIDDEN_PACKAGES = ['zod'];
// `import type …`는 빼고, `import x from '…'`·`import '…'`·`export … from '…'`의 경로를 잡는다(여러 줄 import 포함)
const STATIC_IMPORT = /^\s*(?:import|export)\s+(?!type\s)(?:[^'";]*?\sfrom\s+)?['"]([^'"]+)['"]/gm;

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

function resolveImport(from: string, spec: string): string {
  const base = spec.startsWith('@/') ? join(SRC, spec.slice(2)) : spec.startsWith('.') ? resolve(dirname(from), spec) : null;
  if (base === null) return `pkg:${spec.split('/')[0]}`;
  for (const ext of ['', '.ts', '.tsx', '/index.ts', '/index.tsx']) {
    if (existsSync(base + ext) && statSync(base + ext).isFile()) return base + ext;
  }
  return `missing:${spec}`;
}

// 진입 파일에서 정적 import로 닿는 파일·패키지 전체와, 각 항목까지의 경로(실패 메시지용)
function reachable(entry: string): Map<string, string[]> {
  const seen = new Map<string, string[]>([[entry, [entry]]]);
  const queue = [entry];
  while (queue.length) {
    const file = queue.shift()!;
    if (!/\.(ts|tsx)$/.test(file)) continue; // css 등은 따라가지 않는다
    for (const m of readFileSync(file, 'utf8').matchAll(STATIC_IMPORT)) {
      const target = resolveImport(file, m[1]);
      if (seen.has(target)) continue;
      seen.set(target, [...seen.get(file)!, target]);
      if (!target.startsWith('pkg:') && !target.startsWith('missing:')) queue.push(target);
    }
  }
  return seen;
}

const isClientFile = (f: string) => /^\s*['"]use client['"]/.test(readFileSync(f, 'utf8'));
const allFiles = [...walk(SRC), ...walk(APP)].filter((f) => /\.tsx?$/.test(f));

// entry = 서버 파일이 정적 import로 직접 가리키는 'use client' 파일. src/·app/ 전체의 서버 파일을 훑어야
// 중간에 서버 컴포넌트를 거쳐 여러 단계 떨어진 클라이언트 파일도 놓치지 않는다(예: HomePage → Backdrop).
const entries = new Set<string>();
for (const file of allFiles) {
  if (isClientFile(file)) continue; // 클라이언트 파일 안의 import는 이미 그 파일의 reachable 그래프가 다룬다
  for (const m of readFileSync(file, 'utf8').matchAll(STATIC_IMPORT)) {
    const target = resolveImport(file, m[1]);
    if (target.startsWith('pkg:') || target.startsWith('missing:')) continue;
    if (isClientFile(target)) entries.add(target);
  }
}
const entryFiles = [...entries];
const rel = (p: string) => (p.startsWith('pkg:') ? p : relative(SRC, p));

describe('클라이언트 import 경계', () => {
  it('entry는 서버 컴포넌트가 정적으로 부르는 클라이언트 파일이다', () => {
    const relEntries = entryFiles.map(rel);
    expect(relEntries).toContain('components/Backdrop.tsx');
    expect(relEntries).toContain('components/demo/DemoApp.tsx');
    expect(relEntries).not.toContain('three/TerrainScene.tsx'); // next/dynamic(import())로만 불려온다
  });

  it.each(entryFiles.map((f) => [rel(f), f]))('%s는 서버 전용 모듈·zod에 닿지 않는다', (_, file) => {
    const graph = reachable(file);
    for (const bad of [...FORBIDDEN_FILES, ...FORBIDDEN_PACKAGES.map((p) => `pkg:${p}`)]) {
      const path = graph.get(bad);
      expect(path, path && path.map(rel).join(' → ')).toBeUndefined();
    }
  });

  // resolveImport가 못 찾은 경로는 'missing:'으로 조용히 빠지므로, 그런 경로가 하나라도 있으면
  // reachable 그래프가 실제보다 작게 잡혀 이 테스트 전체가 헛돌 수 있다 — 명시적으로 잡아낸다.
  it.each(entryFiles.map((f) => [rel(f), f]))('%s의 reachable 그래프에 missing: 항목이 없다', (_, file) => {
    const graph = reachable(file);
    const missing = [...graph.keys()].filter((k) => k.startsWith('missing:'));
    expect(missing, missing.map((k) => graph.get(k)!.map(rel).join(' → ')).join('\n')).toEqual([]);
  });
});
