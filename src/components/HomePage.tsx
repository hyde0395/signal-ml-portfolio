import { Header } from './Header';
import { About } from './sections/About';
import { CaseStudy } from './sections/CaseStudy';
import { Contact } from './sections/Contact';
import { Hero } from './sections/Hero';
import { Stack } from './sections/Stack';
import type { Locale } from '@/lib/i18n';

export function HomePage({ locale }: { locale: Locale }) {
  return (
    <>
      <Header locale={locale} />
      <main id="main" data-locale={locale}>
        <Hero locale={locale} />
        <About locale={locale} />
        <CaseStudy locale={locale} />
        {/* 계획 2: 데모 섹션이 여기에 들어간다 */}
        <Stack locale={locale} />
        <Contact locale={locale} />
      </main>
    </>
  );
}
