// 사이트 주소(siteUrl)와 페이지 메타데이터(canonical, hreflang, robots)를 만든다.
import type { Metadata } from 'next';
import { getT } from './content';
import { LOCALE_PATH, type Locale } from './i18n';

// 계획 4에서 공개할 때 true로 바꾼다. false인 동안 noindex + robots.txt Disallow.
export const LAUNCHED = false;

export function siteUrl(): URL {
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return new URL(host ? `https://${host}` : 'http://localhost:3000');
}

export function buildMetadata(locale: Locale, launched = LAUNCHED): Metadata {
  const t = getT(locale);
  return {
    ...(launched ? {} : { robots: { index: false, follow: false } }),
    metadataBase: siteUrl(),
    title: t('meta.title'),
    description: t('meta.description'),
    alternates: {
      canonical: LOCALE_PATH[locale],
      languages: { ko: LOCALE_PATH.ko, en: LOCALE_PATH.en, ja: LOCALE_PATH.ja, 'x-default': LOCALE_PATH.ko },
    },
  };
}
