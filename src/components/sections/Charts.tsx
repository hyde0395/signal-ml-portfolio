// ④ 발견·⑤ 검증(설계 2026-09-25 §3.4, 2026-09-29 이야기 흐름 §2·§3.1). 두 섹션이 블록 그리기를 공유한다 — 차트 1·2·4는
// 그림 판(ChartStage) 블록으로, 판이 화면에 고정되고 배경 점이 출발일 점 그래프·구간별 벌떼·불확실성 구름으로 모인다(3D가
// 꺼지면 같은 그림을 2D로). 글은 판 아래 자막 띠에서 문단을 차례로 보여 준다(설계 2026-09-28 §2). 차트 3(R² 거품)은 큰 숫자 두 장 카드,
// 한계는 글 카드(.chapter), 평가 방식은 검증 설계 판(계획 8-1) 뒤 대표값 카드(설계 2026-10-08). 장면은 블록의 data-scene으로 고르므로 블록을 어느 섹션에 두든 3D 장면
// 대응은 같다(three/activeScene.ts).
import type React from 'react';
import { ChartStage } from '../charts/ChartStage';
import { LimitsFigures } from './LimitsFigures';
import { R2Figures } from './R2Figures';
import { ValidationTable } from './ValidationTable';
import { SPLIT } from '@/charts/split';
import type { ChartKey } from '@/charts/types';
import { dictionaries, getT } from '@/lib/content';
import { codeUrl, facts, type CodeChapter } from '@/lib/facts';
import { formatValue, prefill, type Locale } from '@/lib/i18n';
import { eyebrow } from '@/lib/sections';
import type { SceneKey } from '@/three/scenes';

// paras = content의 charts.<id>.body1..N 개수. tag는 플립 글자판 머리표(세 언어 공통). 없으면 머리표 없음 —
// ⑤ 검증 설계 판은 번호 차트가 아니고 섹션 머리표(05 — VALIDATION)와 겹쳐 빼었다(정보 전달 2 §5)
type Common = { id: string; tag?: string; code: CodeChapter; paras: number };
type Block =
  | (Common & { kind: 'stage'; chart: ChartKey; axis?: true; stages?: number; subs?: readonly number[]; subMs?: number; subLoopMs?: number })
  | (Common & { kind: 'card'; scene: SceneKey })
  // 큰 숫자 카드(설계 2026-10-08): 가운데 정렬 글 카드에 제목 아래 큰 숫자 묶음이 붙는다 — r2 = R² 전→후 두 장, limits = 기준선 대 모델
  | (Common & { kind: 'figures'; scene: SceneKey; figs: 'r2' | 'limits' })
  // 표만 있는 카드(계획 8-1): ⑤ 검증 설계 판 뒤 평가 방식 비교표. 제목 없이 표 caption이 이름이다
  | { kind: 'table'; id: string; scene: SceneKey; code: CodeChapter };

const FINDINGS_BLOCKS: Block[] = [
  { kind: 'stage', id: 'depart', tag: 'CHART 01', chart: 'chartDepart', code: 'features', paras: 1, axis: true },
  { kind: 'stage', id: 'curve', tag: 'CHART 02', chart: 'chartCurve', code: 'insight', paras: 1, axis: true },
];

const VALIDATION_BLOCKS: Block[] = [
  // 차트 3: 아령 판은 "눈이 여러 번 간다"(교수님 2026-10-08)고 해서 큰 숫자 두 장으로(설계 2026-10-08 §1). 뒤에 점 없음(blank)
  { kind: 'figures', figs: 'r2', id: 'bubble', tag: 'CHART 03', scene: 'blank', code: 'bubble', paras: 3 },
  // 세 평가 방식이 데이터를 나누는 점 그림(계획 8-1) — TSS 칸은 폴드가 저절로 넘어가고 마지막에서 머문 뒤 반복한다(설계 2026-10-07 §5).
  // 판 위 수치는 점수판(정보 전달 2 §5)
  { kind: 'stage', id: 'validation', chart: 'chartSplit', code: 'validation', paras: 3, axis: true,
    stages: SPLIT.stages, subs: SPLIT.subs, subMs: SPLIT.subMs, subLoopMs: SPLIT.loopHoldMs },
  // 판 바로 뒤 카드: 운영 기준 대표값을 크게, 다른 두 방식은 작은 참고 표로(설계 2026-10-08 §2). 뒤에 점 없음(blank)
  { kind: 'table', id: 'validationTable', scene: 'blank', code: 'validation' },
  { kind: 'stage', id: 'band', tag: 'CHART 04', chart: 'chartCloud', code: 'interval', paras: 3, axis: true },
  // 한계: 뒤에 점 없음(blank) — 지형 점이 문장 끝과 겹쳤다. 글만으로는 휑해 기준선 대 모델 평균 오차를 큰 숫자로(사용자 2026-10-08, 시안 A)
  { kind: 'figures', figs: 'limits', id: 'limits', tag: 'LIMITS', scene: 'blank', code: 'limits', paras: 2 },
];

type ChartSectionProps = {
  locale: Locale; id: 'findings' | 'validation'; headingKey: 'charts.heading' | 'charts.validationHeading'; blocks: Block[];
  headScene: SceneKey;
};

function ChartSection({ locale, id, headingKey, blocks, headScene }: ChartSectionProps) {
  const t = getT(locale);
  const dict = dictionaries[locale];
  // 출발일 점 그래프(charts.holidays)와 구름(데모 공휴일 이름)이 쓰는 공휴일 이름을 한 표로
  const holidays = { ...dict.demo.holidays, ...dict.charts.holidays } as Record<string, string>;
  // 표시 상자 문장 틀: t()는 {v.…}를 facts에서 찾다가 throw하므로, 데모 문구(demoTexts)처럼 prefill로 facts 자리표시만
  // 채우고 {v.…}는 남긴 채 넘긴다 — 클라이언트의 배치 코드(charts/build.ts)가 짚은 항목 값으로 채운다
  const tipOf = (blockId: string, key = 'tip') => prefill((dict.charts as unknown as Record<string, Record<string, string>>)[blockId][key], facts, locale);
  const body = (b: Extract<Block, { kind: 'card' | 'figures' }>) => Array.from({ length: b.paras }, (_, i) => <p key={i}>{t(`charts.${b.id}.body${i + 1}`)}</p>);
  // 그림 판 블록은 문단마다 칸 하나 — 자막 띠에서 한 칸씩 바꿔 보여 준다(motion/caption.ts)
  const paraCells = (b: Extract<Block, { kind: 'stage' }>) => (
    <div className="chart-paras">
      {Array.from({ length: b.paras }, (_, i) => <div key={i} className="chart-para"><p>{t(`charts.${b.id}.body${i + 1}`)}</p></div>)}
    </div>
  );
  const link = (b: { code: CodeChapter }) => (
    <a className="code-link mono" href={codeUrl(b.code)} target="_blank" rel="noopener noreferrer">{t('common.codeLink')} ↗</a>
  );
  // ⑤ 검증 설계 판 위 수치(계획 8-1): 방식 이름(공통 영어)·R²·MAE·짧은 설명. 표와 같은 facts 값.
  // 판 위 이름은 옆 칸 폭 때문에 TSS(표·낭독 문단은 전체 이름)
  const num = (v: number) => formatValue(v, undefined, locale);
  const unit = t('charts.validation.table.maeUnit');
  // 영어 단위(KRW)는 글자라 숫자와 띄운다. ko "원"·ja "ウォン"은 붙여 쓴다
  const method = (name: string, sc: { r2: number; mae: number }, tag: string) => ({ name, r2: `R² ${num(sc.r2)}`, mae: `MAE ${num(sc.mae)}${locale === 'en' ? ' ' : ''}${unit}`, tag });
  const splitStrings = {
    axisX: t('charts.validation.axisX'),
    legend: [t('charts.validation.legendTrain'), t('charts.validation.legendTest'), t('charts.validation.legendUnused')] as [string, string, string],
    methods: [
      method('K-FOLD', facts.model.kfold, t('charts.validation.tagKf')),
      method('GROUPKFOLD', facts.model.gkfNoLookup, t('charts.validation.tagGkf')),
      method('TSS', facts.model.tss, t('charts.validation.tagTss')),
    ] as const,
  };
  return (
    <section id={id} className="wrap" aria-labelledby={`${id}-h`}>
      {/* 머리 자리의 장면 — 장면이 없는 머리 위에서는 3D가 앞 섹션의 차트 배치에 멈춘 채 제목 위에 남는다(2026-09-30) */}
      <div className="charts-head" data-scene={headScene}>
        <p className="eyebrow" data-flip-on-enter>{eyebrow(id)}</p>
        <h2 id={`${id}-h`} className="display" data-reveal>{t(headingKey)}</h2>
      </div>
      {blocks.map((b) => b.kind === 'stage' ? (
        <article key={b.id} data-scene={b.chart} className="chart-block" aria-labelledby={`chart-${b.id}`}
          style={{ '--paras': b.paras } as React.CSSProperties}>
          <ChartStage
            chartKey={b.chart}
            dataVersion={facts.dataVersion}
            stages={b.stages}
            subs={b.subs}
            subMs={b.subMs}
            subLoopMs={b.subLoopMs}
            strings={{
              locale, holidays, axis: b.axis ? t(`charts.${b.id}.axis${b.chart === 'chartSplit' ? 'Y' : ''}`) : undefined,
              weekdayTitle: b.id === 'depart' ? t('charts.depart.weekdays') : undefined,
              // 표시 상자는 조작 층이 있는 차트(1·2·4)만 — 검증 설계 판에는 틀(tip)이 없다
              tip: b.chart === 'chartSplit' ? undefined : tipOf(b.id),
              tipHoliday: b.id === 'depart' ? tipOf('depart', 'tipHoliday') : undefined,
              ...(b.id === 'curve' ? { zero: t('charts.curve.zero'), callLast: t('charts.curve.callLast'), callMin: tipOf('curve', 'callMin') } : {}),
              ...(b.id === 'band' ? { panelHead: tipOf('band', 'panelHead'), panelNote: tipOf('band', 'panelNote') } : {}),
              ...(b.chart === 'chartSplit' ? splitStrings : {}),
            }}
            errorText={t('charts.error')}
            label={`${t(`charts.${b.id}.heading`)} · ${t('charts.touch')}`}
            hint={t('charts.touchHint')}
          />
          <div className="chart-copy">
            {b.tag && <p className="eyebrow" data-flip-on-enter>{b.tag}</p>}
            <h3 id={`chart-${b.id}`}>{t(`charts.${b.id}.heading`)}</h3>
            <p className="sr-only">{t(`charts.${b.id}.alt`)}</p>
            {paraCells(b)}
            {link(b)}
          </div>
        </article>
      ) : b.kind === 'table' ? (
        <article key={b.id} data-scene={b.scene} className="chapter figs-chapter" aria-label={t('charts.validation.table.caption')}>
          {/* 장면은 화면 가운데선에 걸린 블록으로 정해져, 카드가 아래에서 올라오는 동안 앞 판(검증 설계)의 점이 카드 뒤에 남았다 —
              카드 위로 15vh 뻗은 보이지 않는 띠가 더 짧은 후보라서 그동안 blank가 이긴다(activeScene.ts). 30vh는 판 이름표가
              아직 보이는데 점만 먼저 사라졌고, 15vh면 큰 숫자가 화면 아래로 들어올 즈음 바뀐다 */}
          <span className="scene-reach" data-scene="blank" aria-hidden="true" />
          <ValidationTable locale={locale} />
          {link(b)}
        </article>
      ) : (
        <article key={b.id} data-scene={b.scene} className={b.kind === 'figures' ? 'chapter figs-chapter' : 'chapter'} aria-labelledby={`chart-${b.id}`}>
          {b.tag && <p className="eyebrow" data-flip-on-enter>{b.tag}</p>}
          <h3 id={`chart-${b.id}`}>{t(`charts.${b.id}.heading`)}</h3>
          {b.kind === 'figures' && (b.figs === 'r2' ? <R2Figures locale={locale} /> : <LimitsFigures locale={locale} />)}
          {body(b)}
          {link(b)}
        </article>
      ))}
    </section>
  );
}

export const Findings = ({ locale }: { locale: Locale }) => (
  // ④ 머리는 첫 판의 차트 장면: ③ 와플에서 지형을 거치지 않고 제목이 올라오는 동안 곧장 출발일 판으로 옮겨 간다
  <ChartSection locale={locale} id="findings" headingKey="charts.heading" blocks={FINDINGS_BLOCKS} headScene="chartDepart" />
);

export const Validation = ({ locale }: { locale: Locale }) => (
  // ⑤ 머리도 점 없음(blank): 첫 블록이 큰 숫자 카드라, 머리가 지형이면 카드가 화면 아래에서 올라오는 동안(가운데선을 넘기 전)
  // 카드 윗부분 뒤에 지형이 남았다(사용자 2026-10-08)
  <ChartSection locale={locale} id="validation" headingKey="charts.validationHeading" blocks={VALIDATION_BLOCKS} headScene="blank" />
);
