// 글꼴 서브셋에 넣을 글자 모으기(순수 함수, 계획 2026-10-08 성능). scripts/build-fonts.mjs가 글꼴을 자를 때와
// tests/unit/font-subset.test.ts가 "지금 문구의 글자가 커밋된 글꼴에 다 있는지" 볼 때 같은 규칙을 쓴다.
// 화면 글자는 문구(content/*.json)·수치(data/facts.json)·코드 안 기호·Intl 날짜/숫자에서 온다. 코드 안 한글은
// 개발용 오류·경고 문구뿐이라(화면에 안 나온다) 기호만 모은다.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

export const LOCALES = ['ko', 'en', 'ja'];
export const FONT_FILES = ['pretendard-ko.woff2', 'pretendard-latin.woff2', 'noto-sans-jp.woff2'];
// 페이지마다 글자를 그리는 글꼴(앞 것이 먼저). 테스트가 이 목록으로 빠진 글자를 찾는다
export const PAGE_FONTS = { ko: ['pretendard-ko.woff2'], en: ['pretendard-latin.woff2'], ja: ['noto-sans-jp.woff2', 'pretendard-latin.woff2'] };

export const isHangul = (c) => /[ᄀ-ᇿ㄰-㆏가-힣]/.test(c);
export const isCjk = (c) => /[　-ヿㇰ-ㇿ㐀-䶿一-鿿豈-﫿＀-￯]/.test(c);

const addAll = (set, s) => { for (const c of s) set.add(c); return set; };
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

// JSON 값 안의 모든 문자열 글자(키는 이름표라 빼고 값만)
export function stringChars(value, out = new Set()) {
  if (typeof value === 'string') addAll(out, value);
  else if (Array.isArray(value)) value.forEach((v) => stringChars(v, out));
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => stringChars(v, out));
  return out;
}

// // 줄 주석과 /* */ 블록 주석(JSX {/* */} 포함)을 뺀다. 문자열·템플릿 안의 // 는 남긴다.
// TypeScript 7에는 JS API가 없어 직접 훑는다 — 정규식 리터럴 안의 // 같은 드문 경우는 글자를 조금 더 모을 뿐이라 괜찮다
export function stripComments(code) {
  let out = '';
  let quote = null;
  for (let i = 0; i < code.length; i++) {
    const c = code[i], d = code[i + 1];
    if (quote) {
      out += c;
      if (c === '\\') { out += d ?? ''; i++; } else if (c === quote) quote = null;
      continue;
    }
    if (c === '/' && d === '/') { while (i < code.length && code[i] !== '\n') i++; out += '\n'; continue; }
    if (c === '/' && d === '*') { const e = code.indexOf('*/', i + 2); i = e < 0 ? code.length : e + 1; continue; }
    if (c === "'" || c === '"' || c === '`') quote = c;
    out += c;
  }
  return out;
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

// 코드(src·app) 안 문자열·JSX 글의 기호(ASCII 밖, 한글·한자·가나 아닌 것). 예: → ₩ − · ▶
export function sourceSymbolChars(root = '.') {
  const out = new Set();
  for (const f of [...walk(join(root, 'src')), ...walk(join(root, 'app'))]) {
    for (const c of stripComments(readFileSync(f, 'utf8'))) if (c > '~' && !isHangul(c) && !isCjk(c)) out.add(c);
  }
  return out;
}

// 사이트가 Intl로 만드는 날짜·숫자 글자(src/lib/i18n.ts formatValue, src/charts/build.ts 축·표시 상자)
export function intlChars(locale) {
  const out = new Set();
  const dates = [
    { month: 'short' }, { weekday: 'short' }, { month: 'short', day: 'numeric', weekday: 'short' },
    { month: 'long', day: 'numeric', weekday: 'short' }, { year: 'numeric', month: 'long', day: 'numeric' },
    { year: 'numeric', month: 'long' }, { year: 'numeric', month: 'short' },
  ];
  for (let m = 0; m < 12; m++) {
    const d = new Date(Date.UTC(2026, m, 1 + m * 2));
    for (const o of dates) addAll(out, new Intl.DateTimeFormat(locale, { ...o, timeZone: 'UTC' }).format(d));
  }
  for (const v of [0.5, 12, 1234, 12345, 123456, 1234567, 12345678, 123456789]) {
    addAll(out, new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(v));
    addAll(out, new Intl.NumberFormat(locale, { maximumFractionDigits: 1, signDisplay: 'exceptZero' }).format(-v));
  }
  return out;
}

const ASCII = (() => { const s = new Set(); for (let c = 0x20; c < 0x7f; c++) s.add(String.fromCharCode(c)); return s; })();

// 한 페이지(로케일)에 나올 수 있는 글자. 다른 언어 페이지에 뜨는 언어 안내(langHint)는 requestedChars가 따로 넣는다
export function requiredChars(locale, root = '.') {
  const out = new Set(ASCII);
  stringChars(readJson(join(root, `content/${locale}.json`)), out);
  stringChars(readJson(join(root, 'data/facts.json')), out);
  addAll(out, sourceSymbolChars(root));
  addAll(out, intlChars(locale));
  return out;
}

// 글꼴 파일마다 잘라 넣을 글자
export function requestedChars(file, root = '.') {
  const req = (l) => requiredChars(l, root);
  if (file === 'pretendard-ko.woff2') return new Set([...req('ko'), ...req('en')]);
  if (file === 'pretendard-latin.woff2') {
    const out = new Set([...req('en'), ...[...req('ja')].filter((c) => !isCjk(c))]);
    // en·ja 페이지에 뜰 수 있는 한국어 언어 안내(RootDocument가 세 언어 안내를 모두 싣는다)
    stringChars(readJson(join(root, 'content/ko.json')).langHint, out);
    return out;
  }
  if (file === 'noto-sans-jp.woff2') return req('ja');
  throw new Error(`모르는 글꼴 파일: ${file}`);
}
