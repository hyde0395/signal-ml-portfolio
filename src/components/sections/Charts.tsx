// ④ 차트(설계 2026-09-25 §3.4). 블록 하나가 화면 한 장이고 블록마다 data-scene으로 3D 장면을 고른다.
// 계획 5-2 Task 2: curve·band 레이어를 지우고 새 차트 장면 이름(chartDepart 등)으로만 바꿨다. 그림 판
// 자체(figure)는 이후 태스크에서 붙인다 — 그때까지 curve·band 블록은 figure 없이 글만 보인다.
import { ChapterFigure, type FigureKey } from './ChapterFigure';
import { ValidationTable } from './ValidationTable';
import { getT } from '@/lib/content';
import { codeUrl, type CodeChapter } from '@/lib/facts';
import type { Locale } from '@/lib/i18n';
import { eyebrow } from '@/lib/sections';
import type { SceneKey } from '@/three/scenes';

type Block = { id: string; tag: string; scene: SceneKey; code: CodeChapter; paras: number; figure?: FigureKey; table?: true };

// paras = content의 charts.<id>.body1..N 개수. tag는 플립 글자판 머리표(세 언어 공통)
const BLOCKS: Block[] = [
  { id: 'depart', tag: 'CHART 01', scene: 'chartDepart', code: 'features', paras: 1 },
  { id: 'curve', tag: 'CHART 02', scene: 'chartCurve', code: 'insight', paras: 1 },
  { id: 'bubble', tag: 'CHART 03', scene: 'bubble', code: 'bubble', paras: 3, figure: 'bubble' },
  { id: 'validation', tag: 'VALIDATION', scene: 'validation', code: 'validation', paras: 2, table: true },
  { id: 'band', tag: 'CHART 04', scene: 'chartCloud', code: 'interval', paras: 3 },
  { id: 'limits', tag: 'LIMITS', scene: 'limits', code: 'limits', paras: 3 },
];

export function Charts({ locale }: { locale: Locale }) {
  const t = getT(locale);
  return (
    <section id="charts" className="wrap" aria-labelledby="charts-h">
      <div className="charts-head text-scrim">
        <p className="eyebrow" data-flip-on-enter>{eyebrow('charts')}</p>
        <h2 id="charts-h" className="display" data-reveal>{t('charts.heading')}</h2>
      </div>
      {BLOCKS.map((b) => (
        <article key={b.id} data-scene={b.scene} className="chapter" aria-labelledby={`chart-${b.id}`}>
          <p className="eyebrow" data-flip-on-enter>{b.tag}</p>
          <h3 id={`chart-${b.id}`}>{t(`charts.${b.id}.heading`)}</h3>
          {b.figure && <ChapterFigure locale={locale} sceneKey={b.figure} />}
          {Array.from({ length: b.paras }, (_, i) => <p key={i}>{t(`charts.${b.id}.body${i + 1}`)}</p>)}
          {b.table && <ValidationTable locale={locale} />}
          <a className="code-link mono" href={codeUrl(b.code)} target="_blank" rel="noopener noreferrer">
            {t('common.codeLink')} ↗
          </a>
        </article>
      ))}
    </section>
  );
}
