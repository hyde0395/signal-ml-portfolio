// 글꼴 서브셋(계획 2026-10-08 성능 Task 2·3): 글자 모으기 규칙과, 지금 문구의 글자가 커밋된 글꼴에 다 있는지
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PAGE_FONTS, requiredChars, requestedChars, stripComments, isHangul, isCjk } from '../../scripts/font-chars.mjs';

describe('stripComments', () => {
  it('줄·블록 주석을 빼고 문자열 안의 // 는 남긴다', () => {
    const code = "const a = 'https://x.y'; // 주석 가\n/* 블록 나 */ const b = \"다\"; {/* JSX 라 */}";
    const out = stripComments(code);
    expect(out).toContain('https://x.y');
    expect(out).toContain('"다"');
    expect(out).not.toMatch(/[가나라]/);
  });
});

describe('requiredChars', () => {
  it('ASCII 인쇄 글자는 언제나 들어간다', () => {
    for (const l of ['ko', 'en', 'ja'] as const) expect(requiredChars(l).has('~')).toBe(true);
  });
  it('ko는 문구의 한글, ja는 문구의 가나·한자가 들어간다', () => {
    expect([...requiredChars('ko')].some(isHangul)).toBe(true);
    expect([...requiredChars('ja')].some(isCjk)).toBe(true);
    expect([...requiredChars('en')].some((c) => isHangul(c) || isCjk(c))).toBe(false);
  });
  it('Intl 날짜·축약 숫자 글자가 들어간다(차트 축 "20만", "10月")', () => {
    expect(requiredChars('ko').has('만')).toBe(true);
    expect(requiredChars('ja').has('月')).toBe(true);
  });
  it('코드 문자열의 기호(→ ₩ −)는 들어가고 개발용 한글 오류 문구는 안 들어간다', () => {
    const en = requiredChars('en');
    for (const c of ['→', '₩', '−']) expect(en.has(c)).toBe(true);
    expect([...en].some(isHangul)).toBe(false);
  });
});

describe('requestedChars', () => {
  it('pretendard-ko는 ko·en 글자를 모두 담는다(404 화면이 ko 글꼴 하나로 en도 그린다)', () => {
    const ko = requestedChars('pretendard-ko.woff2');
    for (const c of [...requiredChars('ko'), ...requiredChars('en')]) expect(ko.has(c)).toBe(true);
  });
  it('pretendard-latin은 한자·가나를 담지 않고, ko 언어 안내 글자는 담는다', () => {
    const latin = requestedChars('pretendard-latin.woff2');
    expect([...latin].some(isCjk)).toBe(false);
    expect([...latin].some(isHangul)).toBe(true);
  });
});

describe('커밋된 글꼴 서브셋', () => {
  const manifestPath = 'src/styles/font-files/subset.json';
  it('글꼴 파일 셋과 목록(subset.json)이 있다', () => {
    expect(existsSync(manifestPath)).toBe(true);
    for (const f of ['pretendard-ko.woff2', 'pretendard-latin.woff2', 'noto-sans-jp.woff2']) expect(existsSync(`src/styles/font-files/${f}`)).toBe(true);
  });
  for (const locale of ['ko', 'en', 'ja'] as const) {
    it(`${locale}: 페이지에 나올 글자를 글꼴을 만들 때 모두 넣었다 — 빠졌으면 npm run fonts로 다시 만든다`, () => {
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<string, { requested: string; missing: string }>;
      const have = new Set(PAGE_FONTS[locale].flatMap((f) => [...manifest[f].requested]));
      const missing = [...requiredChars(locale)].filter((c) => !have.has(c));
      expect(missing.join('')).toBe('');
    });
  }
});
