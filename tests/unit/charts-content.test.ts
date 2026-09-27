// 차트 문구 검사: charts.json 이름표의 공휴일 코드마다 세 언어 이름이 있고, 그림 판 블록마다 요약 문단(alt)이 있다.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { dictionaries } from '@/lib/content';
import { facts } from '@/lib/facts';
import { LOCALES } from '@/lib/i18n';

const charts = JSON.parse(readFileSync(`public/data/charts.${facts.dataVersion}.json`, 'utf8')) as { labels: { code: string }[] };

describe('차트 문구', () => {
  for (const locale of LOCALES) {
    const c = dictionaries[locale].charts as unknown as Record<string, Record<string, string>>;
    it(`${locale}: 점 달력 이름표의 공휴일 이름이 모두 있다(재추출로 코드가 바뀌면 여기서 멈춘다)`, () => {
      for (const { code } of charts.labels) expect(c.holidays[code], code).toBeTruthy();
    });
    it(`${locale}: 그림 판 블록(depart·curve·band)마다 요약 문단이 있다`, () => {
      for (const id of ['depart', 'curve', 'band']) expect(c[id].alt, id).toBeTruthy();
    });
  }
});
