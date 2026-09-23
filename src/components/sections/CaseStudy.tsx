import { ValidationTable } from './ValidationTable';
import { getT } from '@/lib/content';
import { codeUrl, type CodeChapter } from '@/lib/facts';
import type { Locale } from '@/lib/i18n';

const CHAPTERS: { id: CodeChapter; gate: string; paras: number }[] = [
  { id: 'problem', gate: 'GATE 01 — PROBLEM', paras: 3 },
  { id: 'insight', gate: 'GATE 02 — INSIGHT', paras: 2 },
  { id: 'bubble', gate: 'GATE 03 — R² BUBBLE', paras: 3 },
  { id: 'validation', gate: 'GATE 04 — VALIDATION', paras: 2 },
  { id: 'interval', gate: 'GATE 05 — INTERVAL', paras: 2 },
  { id: 'limits', gate: 'GATE 06 — LIMITS', paras: 3 },
];

export function CaseStudy({ locale }: { locale: Locale }) {
  const t = getT(locale);
  return (
    <section id="case" data-section="case" className="wrap" aria-labelledby="case-h">
      <p className="eyebrow">CASE STUDY</p>
      <h2 id="case-h" className="display">{t('case.heading')}</h2>
      {CHAPTERS.map((c) => (
        <article key={c.id} data-chapter={c.id} className="chapter" aria-labelledby={`ch-${c.id}`}>
          <p className="eyebrow">{c.gate}</p>
          <h3 id={`ch-${c.id}`}>{t(`case.${c.id}.heading`)}</h3>
          {Array.from({ length: c.paras }, (_, i) => <p key={i}>{t(`case.${c.id}.body${i + 1}`)}</p>)}
          {c.id === 'validation' && <ValidationTable locale={locale} />}
          <a className="code-link mono" href={codeUrl(c.id)} target="_blank" rel="noopener noreferrer">
            {t('case.codeLink')} ↗
          </a>
        </article>
      ))}
    </section>
  );
}
