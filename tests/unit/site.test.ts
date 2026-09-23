import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildMetadata, siteUrl } from '@/lib/site';

afterEach(() => vi.unstubAllEnvs());

describe('site metadata', () => {
  it('Vercel 운영 주소가 있으면 https로 쓴다', () => {
    vi.stubEnv('VERCEL_PROJECT_PRODUCTION_URL', 'signal.vercel.app');
    expect(siteUrl().href).toBe('https://signal.vercel.app/');
  });

  it('언어별 canonical과 hreflang', () => {
    const m = buildMetadata('en');
    expect(m.alternates?.canonical).toBe('/en/');
    expect(m.alternates?.languages).toEqual({ ko: '/', en: '/en/', ja: '/ja/', 'x-default': '/' });
    expect(typeof m.title).toBe('string');
  });

  it('공개 전에는 검색 노출을 막고, 공개 후에는 연다', () => {
    expect(buildMetadata('ko', false).robots).toEqual({ index: false, follow: false });
    expect(buildMetadata('ko', true).robots).toBeUndefined();
  });
});
