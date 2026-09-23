import type { Locale } from '@/lib/i18n';

export function HomePage({ locale }: { locale: Locale }) {
  return <main id="main" data-locale={locale} />;
}
