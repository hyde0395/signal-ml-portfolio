import type { MetadataRoute } from 'next';
import { LAUNCHED, siteUrl } from '@/lib/site';

export const dynamic = 'force-static';

export default function robots(): MetadataRoute.Robots {
  return LAUNCHED
    ? { rules: { userAgent: '*', allow: '/' }, sitemap: new URL('/sitemap.xml', siteUrl()).href }
    : { rules: { userAgent: '*', disallow: '/' } };
}
