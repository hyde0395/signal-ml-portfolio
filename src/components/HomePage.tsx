import { Header } from './Header';
import type { Locale } from '@/lib/i18n';

export function HomePage({ locale }: { locale: Locale }) {
  return (
    <>
      <Header locale={locale} />
      <main id="main" data-locale={locale} />
    </>
  );
}
