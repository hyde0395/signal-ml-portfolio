// robots.txt를 만든다. LAUNCHED가 false인 동안(공개 전)에는 전체 경로를 Disallow해 검색 노출을 막는다.
import type { MetadataRoute } from 'next';
import { LAUNCHED, siteUrl } from '@/lib/site';

export const dynamic = 'force-static';

export default function robots(): MetadataRoute.Robots {
  return LAUNCHED
    ? { rules: { userAgent: '*', allow: '/' }, sitemap: new URL('/sitemap.xml', siteUrl()).href }
    : { rules: { userAgent: '*', disallow: '/' } };
}
