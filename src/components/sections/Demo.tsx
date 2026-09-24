// 인터랙티브 데모 섹션(스펙 §6): 제목·설명·기준일은 서버 HTML에 두고, 조작 화면(DemoApp)은 브라우저에서 그린다.
// JS가 꺼져 있으면 noscript 안내가 보인다.
import { DemoApp } from '../demo/DemoApp';
import { demoUrl } from '@/demo/types';
import { demoTexts, getT } from '@/lib/content';
import { facts } from '@/lib/facts';
import type { Locale } from '@/lib/i18n';

export function Demo({ locale }: { locale: Locale }) {
  const t = getT(locale);
  return (
    <section id="demo" data-section="demo" className="wrap" aria-labelledby="demo-h">
      <p className="eyebrow">DEMO</p>
      <h2 id="demo-h" className="display" data-reveal>{t('demo.heading')}</h2>
      <p>{t('demo.intro')}</p>
      <p className="muted">{t('demo.basis')}</p>
      <noscript><p className="demo-nojs">{t('demo.noJs')}</p></noscript>
      <DemoApp
        locale={locale}
        texts={demoTexts(locale)}
        dataUrl={demoUrl(facts.dataVersion)}
        initial={facts.demoDefault}
        initialAsOf={facts.dataVersion}
      />
    </section>
  );
}
