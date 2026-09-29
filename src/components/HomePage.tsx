// 한 페이지 스크롤 홈 화면. 첫 화면 → 머리말 → 번호 섹션(섹션 목록 순서) → 데모 → 연락처를 로케일 하나로 조립한다.
// 번호 섹션을 더하려면 src/lib/sections.ts에 한 줄 + 아래 SECTION_VIEWS에 부품 한 줄(빠뜨리면 타입 오류).
import type { ReactElement } from 'react';
import { Backdrop } from './Backdrop';
import { Captions } from './Captions';
import { Header } from './Header';
import { Loader } from './Loader';
import { Motion } from './Motion';
import { ScrollState } from './ScrollState';
import { SideNav } from './SideNav';
import { Charts } from './sections/Charts';
import { Contact } from './sections/Contact';
import { DataSection } from './sections/DataSection';
import { Demo } from './sections/Demo';
import { Features } from './sections/Features';
import { Hero } from './sections/Hero';
import { Intro } from './sections/Intro';
import { Project } from './sections/Project';
import { getT } from '@/lib/content';
import { facts } from '@/lib/facts';
import type { Locale } from '@/lib/i18n';
import { SECTIONS, type SectionId } from '@/lib/sections';

const SECTION_VIEWS: Record<SectionId, (props: { locale: Locale }) => ReactElement> = {
  project: Project,
  data: DataSection,
  features: Features,
  charts: Charts,
};

export function HomePage({ locale }: { locale: Locale }) {
  return (
    <>
      <Loader rows={new Intl.NumberFormat('en-US').format(facts.data.filteredRows)} />
      <Backdrop dataVersion={facts.dataVersion} />
      <Header locale={locale} />
      <SideNav label={getT(locale)('nav.sections')} />
      <main id="main" data-locale={locale}>
        <Hero locale={locale} />
        <Intro locale={locale} />
        {SECTIONS.map(({ id }) => {
          const View = SECTION_VIEWS[id];
          return <View key={id} locale={locale} />;
        })}
        <Demo locale={locale} />
        <Contact locale={locale} />
      </main>
      <Captions />
      <Motion />
      <ScrollState />
    </>
  );
}
