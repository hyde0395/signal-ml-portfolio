// ④ 발견·⑤ 검증(설계 2026-09-25 §3.4, 2026-09-29 이야기 흐름 §2·§3.1). 두 섹션이 블록 그리기를 공유한다 — 차트 1·2·4는
// 그림 판(ChartStage) 블록으로, 판이 화면에 고정되고 배경 점이 출발일 점 그래프·구간별 벌떼·불확실성 구름으로 모인다(3D가
// 꺼지면 같은 그림을 2D로). 글은 판 아래 자막 띠에서 문단을 차례로 보여 준다(설계 2026-09-28 §2). 차트 3(R² 거품)과 평가
// 방식 표·한계는 지금 장면을 쓰는 글 카드(.chapter). 장면은 블록의 data-scene으로 고르므로 블록을 어느 섹션에 두든 3D 장면
// 대응은 같다(three/activeScene.ts).
import type React from 'react';
import { ChartStage } from '../charts/ChartStage';
import { ChapterFigure, type FigureKey } from './ChapterFigure';
import { ValidationTable } from './ValidationTable';
import type { ChartKey } from '@/charts/types';
import { dictionaries, getT } from '@/lib/content';
import { codeUrl, facts, type CodeChapter } from '@/lib/facts';
import { prefill, type Locale } from '@/lib/i18n';
import { eyebrow } from '@/lib/sections';
import type { SceneKey } from '@/three/scenes';

// paras = content의 charts.<id>.body1..N 개수. tag는 플립 글자판 머리표(세 언어 공통)
type Common = { id: string; tag: string; code: CodeChapter; paras: number };
type Block =
  | (Common & { kind: 'stage'; chart: ChartKey; axis?: true })
  | (Common & { kind: 'card'; scene: SceneKey; figure?: FigureKey; table?: true });

const FINDINGS_BLOCKS: Block[] = [
  { kind: 'stage', id: 'depart', tag: 'CHART 01', chart: 'chartDepart', code: 'features', paras: 1, axis: true },
  { kind: 'stage', id: 'curve', tag: 'CHART 02', chart: 'chartCurve', code: 'insight', paras: 1, axis: true },
];

const VALIDATION_BLOCKS: Block[] = [
  { kind: 'card', id: 'bubble', tag: 'CHART 03', scene: 'bubble', code: 'bubble', paras: 3, figure: 'bubble' },
  // 머리표는 EVALUATION — 섹션 머리표 "05 — VALIDATION"과 같은 말이 겹치지 않게(사용자 확인 2026-09-30)
  { kind: 'card', id: 'validation', tag: 'EVALUATION', scene: 'validation', code: 'validation', paras: 2, table: true },
  { kind: 'stage', id: 'band', tag: 'CHART 04', chart: 'chartCloud', code: 'interval', paras: 3, axis: true },
  { kind: 'card', id: 'limits', tag: 'LIMITS', scene: 'limits', code: 'limits', paras: 3 },
];

type ChartSectionProps = { locale: Locale; id: 'findings' | 'validation'; headingKey: 'charts.heading' | 'charts.validationHeading'; blocks: Block[] };

function ChartSection({ locale, id, headingKey, blocks }: ChartSectionProps) {
  const t = getT(locale);
  const dict = dictionaries[locale];
  // 출발일 점 그래프(charts.holidays)와 구름(데모 공휴일 이름)이 쓰는 공휴일 이름을 한 표로
  const holidays = { ...dict.demo.holidays, ...dict.charts.holidays } as Record<string, string>;
  // 표시 상자 문장 틀: t()는 {v.…}를 facts에서 찾다가 throw하므로, 데모 문구(demoTexts)처럼 prefill로 facts 자리표시만
  // 채우고 {v.…}는 남긴 채 넘긴다 — 클라이언트의 배치 코드(charts/build.ts)가 짚은 항목 값으로 채운다
  const tipOf = (blockId: string, key = 'tip') => prefill((dict.charts as unknown as Record<string, Record<string, string>>)[blockId][key], facts, locale);
  const body = (b: Block) => Array.from({ length: b.paras }, (_, i) => <p key={i}>{t(`charts.${b.id}.body${i + 1}`)}</p>);
  // 그림 판 블록은 문단마다 칸 하나 — 자막 띠에서 한 칸씩 바꿔 보여 준다(motion/caption.ts)
  const paraCells = (b: Block) => (
    <div className="chart-paras">
      {Array.from({ length: b.paras }, (_, i) => <div key={i} className="chart-para"><p>{t(`charts.${b.id}.body${i + 1}`)}</p></div>)}
    </div>
  );
  const link = (b: Block) => (
    <a className="code-link mono" href={codeUrl(b.code)} target="_blank" rel="noopener noreferrer">{t('common.codeLink')} ↗</a>
  );
  return (
    <section id={id} className="wrap" aria-labelledby={`${id}-h`}>
      <div className="charts-head">
        <p className="eyebrow" data-flip-on-enter>{eyebrow(id)}</p>
        <h2 id={`${id}-h`} className="display" data-reveal>{t(headingKey)}</h2>
      </div>
      {blocks.map((b) => b.kind === 'stage' ? (
        <article key={b.id} data-scene={b.chart} className="chart-block" aria-labelledby={`chart-${b.id}`}
          style={{ '--paras': b.paras } as React.CSSProperties}>
          <ChartStage
            chartKey={b.chart}
            dataVersion={facts.dataVersion}
            strings={{
              locale, holidays, axis: b.axis ? t(`charts.${b.id}.axis`) : undefined,
              weekdayTitle: b.id === 'depart' ? t('charts.depart.weekdays') : undefined,
              tip: tipOf(b.id),
              tipHoliday: b.id === 'depart' ? tipOf('depart', 'tipHoliday') : undefined,
            }}
            errorText={t('charts.error')}
            label={`${t(`charts.${b.id}.heading`)} · ${t('charts.touch')}`}
            hint={t('charts.touchHint')}
          />
          <div className="chart-copy">
            <p className="eyebrow" data-flip-on-enter>{b.tag}</p>
            <h3 id={`chart-${b.id}`}>{t(`charts.${b.id}.heading`)}</h3>
            <p className="sr-only">{t(`charts.${b.id}.alt`)}</p>
            {paraCells(b)}
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

export const Findings = ({ locale }: { locale: Locale }) => (
  <ChartSection locale={locale} id="findings" headingKey="charts.heading" blocks={FINDINGS_BLOCKS} />
);

export const Validation = ({ locale }: { locale: Locale }) => (
  <ChartSection locale={locale} id="validation" headingKey="charts.validationHeading" blocks={VALIDATION_BLOCKS} />
);
