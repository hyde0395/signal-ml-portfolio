// siteUrl과 buildMetadata(canonical/hreflang/robots)를 검증한다.
import { existsSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildMetadata, siteUrl } from '@/lib/site';

afterEach(() => vi.unstubAllEnvs());

describe('site metadata', () => {
  it('Vercel 운영 주소가 있으면 https로 쓴다', () => {
    vi.stubEnv('VERCEL_PROJECT_PRODUCTION_URL', 'signal.vercel.app');
    expect(siteUrl().href).toBe('https://signal.vercel.app/');
  });

  it('Vercel 빌드인데 운영 주소가 없으면 조용히 localhost로 넘어가지 않고 던진다', () => {
    vi.stubEnv('VERCEL', '1');
    vi.stubEnv('VERCEL_PROJECT_PRODUCTION_URL', '');
    expect(() => siteUrl()).toThrow(/VERCEL_PROJECT_PRODUCTION_URL/);
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

  it('언어별 링크 미리보기 이미지(1200×630)와 트위터 카드', () => {
    for (const locale of ['ko', 'en', 'ja'] as const) {
      const m = buildMetadata(locale);
      const images = m.openGraph?.images as { url: string; width: number; height: number }[];
      expect(images[0]).toMatchObject({ url: `/og/${locale}.jpg`, width: 1200, height: 630 });
      expect(existsSync(`public/og/${locale}.jpg`)).toBe(true);
      expect((m.twitter as { card: string }).card).toBe('summary_large_image');
    }
  });
});
