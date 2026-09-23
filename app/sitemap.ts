import type { MetadataRoute } from 'next';
import { LOCALE_PATH, LOCALES } from '@/lib/i18n';
import { siteUrl } from '@/lib/site';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  const languages = Object.fromEntries(LOCALES.map((l) => [l, new URL(LOCALE_PATH[l], base).href]));
  return LOCALES.map((l) => ({ url: new URL(LOCALE_PATH[l], base).href, alternates: { languages } }));
}
