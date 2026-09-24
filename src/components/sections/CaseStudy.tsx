// 케이스 스터디 섹션: 챕터 6개(GATE 01~06)를 나열하고, 챕터마다 근거 코드 링크를 붙인다.
import { ChapterFigure, FIGURE_KEYS, type FigureKey } from './ChapterFigure';
import { ValidationTable } from './ValidationTable';
import { getT } from '@/lib/content';
import { codeUrl, type CodeChapter } from '@/lib/facts';
import type { Locale } from '@/lib/i18n';

// gate 라벨과 문단 수(paras)는 플립 글자판 제목과 content/*.json의 case.<id>.body1..N 개수에 맞춘다.
const CHAPTERS: { id: CodeChapter; gate: string; paras: number }[] = [
  { id: 'problem', gate: 'GATE 01 — PROBLEM', paras: 3 },
  { id: 'insight', gate: 'GATE 02 — INSIGHT', paras: 2 },
  { id: 'bubble', gate: 'GATE 03 — R² BUBBLE', paras: 3 },
  { id: 'validation', gate: 'GATE 04 — VALIDATION', paras: 2 },
  { id: 'interval', gate: 'GATE 05 — INTERVAL', paras: 3 },
  { id: 'limits', gate: 'GATE 06 — LIMITS', paras: 3 },
];

export function CaseStudy({ locale }: { locale: Locale }) {
  const t = getT(locale);
  return (
    <section id="case" data-section="case" className="wrap" aria-labelledby="case-h">
      <div className="case-head text-scrim">
        <p className="eyebrow">CASE STUDY</p>
        <h2 id="case-h" className="display" data-reveal>{t('case.heading')}</h2>
      </div>
      {/* data-chapter: 계획 3의 3D 카메라가 스크롤에 맞춰 챕터별 지점으로 이동할 때 쓸 자리(hook) */}
      {CHAPTERS.map((c) => (
        <article key={c.id} data-chapter={c.id} className="chapter" aria-labelledby={`ch-${c.id}`}>
          <p className="eyebrow" data-flip-on-enter>{c.gate}</p>
          <h3 id={`ch-${c.id}`}>{t(`case.${c.id}.heading`)}</h3>
          {(FIGURE_KEYS as readonly string[]).includes(c.id) && (
            <ChapterFigure locale={locale} sceneKey={c.id as FigureKey} />
          )}
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
