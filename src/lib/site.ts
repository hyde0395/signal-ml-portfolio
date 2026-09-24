// 사이트 주소(siteUrl)와 페이지 메타데이터(canonical, hreflang, robots)를 만든다.
import type { Metadata } from 'next';
import { getT } from './content';
import { LOCALE_PATH, type Locale } from './i18n';

// 계획 4에서 공개할 때 true로 바꾼다. false인 동안 noindex + robots.txt Disallow.
export const LAUNCHED = false;

// 링크 미리보기(og:locale) 표기용. Open Graph는 BCP-47이 아니라 language_TERRITORY 형식을 쓴다.
const OG_LOCALE: Record<Locale, string> = { ko: 'ko_KR', en: 'en_US', ja: 'ja_JP' };

export function siteUrl(): URL {
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (!host) {
    // Vercel 빌드인데 운영 주소가 없으면 localhost로 조용히 넘어가지 않고 바로 실패시킨다.
    // (로컬 빌드에서는 VERCEL이 안 잡혀 있으니 그대로 localhost로 진행한다.)
    if (process.env.VERCEL) {
      throw new Error(
        'VERCEL_PROJECT_PRODUCTION_URL이 없습니다. Vercel 빌드에서 canonical/hreflang 주소를 만들 수 없습니다. ' +
          '(VERCEL_PROJECT_PRODUCTION_URL is missing on a Vercel build; cannot build canonical/hreflang URLs.)',
      );
    }
    return new URL('http://localhost:3000');
  }
  return new URL(`https://${host}`);
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
    // 링크 미리보기: scripts/capture-og.mjs가 3D 첫 화면에 이름을 얹어 만든 언어별 이미지(스펙 §12)
    openGraph: {
      type: 'website',
      siteName: 'SIGNAL',
      locale: OG_LOCALE[locale],
      url: LOCALE_PATH[locale],
      title: t('meta.title'),
      description: t('meta.description'),
      images: [{ url: `/og/${locale}.jpg`, width: 1200, height: 630, alt: t('meta.title') }],
    },
    twitter: { card: 'summary_large_image', title: t('meta.title'), description: t('meta.description'), images: [`/og/${locale}.jpg`] },
  };
}
