// ④ 차트(설계 2026-09-25 §3.4, 2026-09-27 개정). 차트 1·2·4는 그림 판(ChartStage) 블록이다 — 판이 화면에 고정되고
// 배경 점이 점 달력·구간별 벌떼·불확실성 구름으로 모인다(3D가 꺼지면 같은 그림을 2D로). 차트 3(R² 거품)과 검증 표·
// 한계는 지금 장면을 쓰는 글 카드(.chapter)로 둔다(차트 3의 산점도는 별도 계획).
import { ChartStage } from '../charts/ChartStage';
import { ChapterFigure, type FigureKey } from './ChapterFigure';
import { ValidationTable } from './ValidationTable';
import type { ChartKey } from '@/charts/types';
import { dictionaries, getT } from '@/lib/content';
import { codeUrl, facts, type CodeChapter } from '@/lib/facts';
import type { Locale } from '@/lib/i18n';
import { eyebrow } from '@/lib/sections';
import type { SceneKey } from '@/three/scenes';

// paras = content의 charts.<id>.body1..N 개수. tag는 플립 글자판 머리표(세 언어 공통)
type Common = { id: string; tag: string; code: CodeChapter; paras: number };
type Block =
  | (Common & { kind: 'stage'; chart: ChartKey; axis?: true })
  | (Common & { kind: 'card'; scene: SceneKey; figure?: FigureKey; table?: true });

const BLOCKS: Block[] = [
  { kind: 'stage', id: 'depart', tag: 'CHART 01', chart: 'chartDepart', code: 'features', paras: 1 },
  { kind: 'stage', id: 'curve', tag: 'CHART 02', chart: 'chartCurve', code: 'insight', paras: 1, axis: true },
  { kind: 'card', id: 'bubble', tag: 'CHART 03', scene: 'bubble', code: 'bubble', paras: 3, figure: 'bubble' },
  { kind: 'card', id: 'validation', tag: 'VALIDATION', scene: 'validation', code: 'validation', paras: 2, table: true },
  { kind: 'stage', id: 'band', tag: 'CHART 04', chart: 'chartCloud', code: 'interval', paras: 3, axis: true },
  { kind: 'card', id: 'limits', tag: 'LIMITS', scene: 'limits', code: 'limits', paras: 3 },
];

export function Charts({ locale }: { locale: Locale }) {
  const t = getT(locale);
  const dict = dictionaries[locale];
  // 점 달력(charts.holidays)과 구름(데모 공휴일 이름)이 쓰는 공휴일 이름을 한 표로
  const holidays = { ...dict.demo.holidays, ...dict.charts.holidays } as Record<string, string>;
  const body = (b: Block) => Array.from({ length: b.paras }, (_, i) => <p key={i}>{t(`charts.${b.id}.body${i + 1}`)}</p>);
  const link = (b: Block) => (
    <a className="code-link mono" href={codeUrl(b.code)} target="_blank" rel="noopener noreferrer">{t('common.codeLink')} ↗</a>
  );
  return (
    <section id="charts" className="wrap" aria-labelledby="charts-h">
      <div className="charts-head text-scrim">
        <p className="eyebrow" data-flip-on-enter>{eyebrow('charts')}</p>
        <h2 id="charts-h" className="display" data-reveal>{t('charts.heading')}</h2>
      </div>
      {BLOCKS.map((b) => b.kind === 'stage' ? (
        <article key={b.id} data-scene={b.chart} className="chart-block" aria-labelledby={`chart-${b.id}`}>
          <ChartStage
            chartKey={b.chart}
            dataVersion={facts.dataVersion}
            strings={{ locale, holidays, axis: b.axis ? t(`charts.${b.id}.axis`) : undefined }}
            errorText={t('charts.error')}
          />
          <div className="chart-copy">
            <p className="eyebrow" data-flip-on-enter>{b.tag}</p>
            <h3 id={`chart-${b.id}`}>{t(`charts.${b.id}.heading`)}</h3>
            <p className="sr-only">{t(`charts.${b.id}.alt`)}</p>
            {body(b)}
            {link(b)}
          </div>
        </article>
      ) : (
        <article key={b.id} data-scene={b.scene} className="chapter" aria-labelledby={`chart-${b.id}`}>
          <p className="eyebrow" data-flip-on-enter>{b.tag}</p>
          <h3 id={`chart-${b.id}`}>{t(`charts.${b.id}.heading`)}</h3>
          {b.figure && <ChapterFigure locale={locale} sceneKey={b.figure} />}
          {body(b)}
          {b.table && <ValidationTable locale={locale} />}
          {link(b)}
        </article>
      ))}
    </section>
  );
}
