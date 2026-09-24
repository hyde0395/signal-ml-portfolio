// 용량 검사의 순수 함수: 초기 HTML에서 스크립트 고르기(noModule 제외, 중복 제거)와 한도 판정.
import { describe, expect, it } from 'vitest';
import { BUDGET, check, initialScripts } from '../../scripts/size-budget.mjs';

describe('initialScripts', () => {
  it('noModule 폴리필은 빼고, 같은 파일은 한 번만', () => {
    const html = '<script src="/_next/a.js" async=""></script><script src="/_next/b.js" noModule=""></script><script src="/_next/a.js"></script><link href="/x.css">';
    expect(initialScripts(html)).toEqual(['/_next/a.js']);
  });
});

describe('check', () => {
  it('한도 이하는 ok, 넘으면 ok가 아니다', () => {
    const r = check([{ name: 'a', bytes: 100, limit: 100 }, { name: 'b', bytes: 101, limit: 100 }]);
    expect(r.map((x: { ok: boolean }) => x.ok)).toEqual([true, false]);
  });
  it('스펙 §8.2 목표', () => {
    expect(BUDGET).toEqual({ initialJs: 150 * 1024, threeChunk: 256_000, terrain: 300 * 1024, demo: 500 * 1024, band: 50 * 1024 });
  });
});
