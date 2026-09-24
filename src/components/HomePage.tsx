// 한 페이지 스크롤 홈 화면. 헤더와 섹션들을 로케일 하나로 조립한다.
import { Backdrop } from './Backdrop';
import { Header } from './Header';
import { Loader } from './Loader';
import { Motion } from './Motion';
import { About } from './sections/About';
import { CaseStudy } from './sections/CaseStudy';
import { Contact } from './sections/Contact';
import { Demo } from './sections/Demo';
import { Hero } from './sections/Hero';
import { Stack } from './sections/Stack';
import { facts } from '@/lib/facts';
import type { Locale } from '@/lib/i18n';

export function HomePage({ locale }: { locale: Locale }) {
  return (
    <>
      <Loader rows={new Intl.NumberFormat('en-US').format(facts.data.filteredRows)} />
      <Backdrop dataVersion={facts.dataVersion} />
      <Header locale={locale} />
      <main id="main" data-locale={locale}>
        <Hero locale={locale} />
        <About locale={locale} />
        <CaseStudy locale={locale} />
        <Demo locale={locale} />
        <Stack locale={locale} />
        <Contact locale={locale} />
      </main>
      <Motion />
    </>
  );
}
