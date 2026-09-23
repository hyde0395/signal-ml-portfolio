// 3개 언어 주소를 모두 담은 sitemap.xml을 만들고, 언어별로 서로를 hreflang alternate로 연결한다.
import type { MetadataRoute } from 'next';
import { LOCALE_PATH, LOCALES } from '@/lib/i18n';
import { siteUrl } from '@/lib/site';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  const languages = Object.fromEntries(LOCALES.map((l) => [l, new URL(LOCALE_PATH[l], base).href]));
  return LOCALES.map((l) => ({ url: new URL(LOCALE_PATH[l], base).href, alternates: { languages } }));
}
