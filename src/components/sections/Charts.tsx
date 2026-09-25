// ④ 차트(설계 2026-09-25 §3.4). 블록 하나가 화면 한 장이고 블록마다 data-scene으로 3D 장면을 고른다.
// 이 계획(5-1)은 기존 장면(U자 곡선·떨어지는 점·예측 구간 띠)을 그대로 연결한다. 계획 5-2에서 배경 점이
// 차트 모양으로 모이게 바꾸고, 출발일별 가격(depart)에 자기 장면과 대체 이미지가 생긴다.
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
  { id: 'depart', tag: 'CHART 01', scene: 'limits', code: 'features', paras: 1 },
  { id: 'curve', tag: 'CHART 02', scene: 'insight', code: 'insight', paras: 1, figure: 'insight' },
  { id: 'bubble', tag: 'CHART 03', scene: 'bubble', code: 'bubble', paras: 3, figure: 'bubble' },
  { id: 'validation', tag: 'VALIDATION', scene: 'validation', code: 'validation', paras: 2, table: true },
  { id: 'band', tag: 'CHART 04', scene: 'interval', code: 'interval', paras: 3, figure: 'interval' },
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
