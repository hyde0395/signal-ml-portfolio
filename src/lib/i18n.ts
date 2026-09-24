// 로케일 목록·주소·포맷팅 규칙과, 문구 안의 {path|format} 자리표시를 facts 수치로 채우는 함수들.
// 문장에 숫자를 직접 쓰지 않고(global-constraints) 전부 여기를 거쳐 채워 넣는다.
export type Locale = 'ko' | 'en' | 'ja';
export const LOCALES: readonly Locale[] = ['ko', 'en', 'ja'];
export const LOCALE_PATH: Record<Locale, string> = { ko: '/', en: '/en/', ja: '/ja/' };
export const INTL_LOCALE: Record<Locale, string> = { ko: 'ko-KR', en: 'en-US', ja: 'ja-JP' };

// 전역(g) 플래그가 붙어 있다. String.replace에는 매번 새로 매칭되어 안전하지만, 같은 정규식
// 객체를 .test()나 .exec()에 재사용하면 lastIndex가 호출 사이에 남아 결과가 들쭉날쭉해지므로
// 그 용도로는 쓰지 않는다(쓰려면 매번 새 RegExp를 만들 것).
// 형식 이름에 숫자를 허용한다(예: fixed1). 글자만 허용하면 {v.x|fixed1}이 안 채워진 채 남는다.
export const PLACEHOLDER = /\{([A-Za-z0-9_.]+)(?:\|([a-z0-9]+))?\}/g;

export function lookup(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>(
    (acc, key) => (acc !== null && typeof acc === 'object' ? (acc as Record<string, unknown>)[key] : undefined),
    obj,
  );
}

export function formatValue(value: unknown, format: string | undefined, locale: Locale): string {
  const intl = INTL_LOCALE[locale];
  if (format === undefined) {
    if (typeof value === 'number') return new Intl.NumberFormat(intl, { maximumFractionDigits: 3 }).format(value);
    if (typeof value === 'string') return value;
  }
  if (format === 'signed' && typeof value === 'number') {
    return new Intl.NumberFormat(intl, { minimumFractionDigits: 1, maximumFractionDigits: 1, signDisplay: 'exceptZero' }).format(value);
  }
  if (format === 'plain' && typeof value === 'number') return String(value);
  if (format === 'fixed1' && typeof value === 'number') {
    return new Intl.NumberFormat(intl, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value);
  }
  // 데모의 출발일: 연도 없이 월·일·요일(예: 11월 14일 (토)). 같은 해 안의 날짜만 다루기 때문이다
  if (format === 'md' && typeof value === 'string') {
    return new Intl.DateTimeFormat(intl, { month: 'long', day: 'numeric', weekday: 'short', timeZone: 'UTC' })
      .format(new Date(`${value}T00:00:00Z`));
  }
  if (format === 'date' && typeof value === 'string') {
    return new Intl.DateTimeFormat(intl, { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })
      .format(new Date(`${value}T00:00:00Z`));
  }
  if (format === 'month' && typeof value === 'string') {
    return new Intl.DateTimeFormat(intl, { year: 'numeric', month: locale === 'en' ? 'short' : 'long', timeZone: 'UTC' })
      .format(new Date(`${value}-01T00:00:00Z`));
  }
  throw new Error(`Cannot format ${JSON.stringify(value)} as "${format ?? 'default'}"`);
}

function fill(source: unknown, path: string, format: string | undefined, locale: Locale): string {
  const value = lookup(source, path);
  // 자리표시 경로가 facts에 없으면 조용히 빈 문자열로 두지 않고 throw한다. 그래야 화면에
  // "{...}"가 그대로 찍히는 대신 빌드(테스트)에서 바로 잡힌다.
  if (value === undefined) throw new Error(`Missing fact for placeholder {${path}}`);
  return formatValue(value, format, locale);
}

export function interpolate(template: string, source: unknown, locale: Locale): string {
  return template.replace(PLACEHOLDER, (_, path: string, format: string | undefined) => fill(source, path, format, locale));
}

// 서버에서 facts 자리표시만 먼저 채우고, {v.…}(데모 화면이 실행 중에 채우는 값)는 그대로 남긴다.
// 그래서 클라이언트에는 facts 전체가 아니라 채워진 문구만 넘어간다.
export function prefill(template: string, source: unknown, locale: Locale): string {
  return template.replace(PLACEHOLDER, (whole: string, path: string, format: string | undefined) =>
    path.startsWith('v.') ? whole : fill(source, path, format, locale));
}

export function createT(dict: unknown, source: unknown, locale: Locale): (key: string) => string {
  return (key) => {
    const template = lookup(dict, key);
    // 문구 키가 없거나 문자열이 아니면 마찬가지로 throw해 빌드에서 잡는다(화면에 undefined 노출 방지).
    if (typeof template !== 'string') throw new Error(`Missing text for key "${key}" (${locale})`);
    return interpolate(template, source, locale);
  };
}
