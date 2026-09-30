// 차트 문구 검사: charts.json 이름표의 공휴일 코드마다 세 언어 이름이 있고, 그림 판 블록마다 요약 문단(alt)이 있다.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SHAP_TEXT_KEYS } from '@/charts/build';
import { dictionaries } from '@/lib/content';
import { facts } from '@/lib/facts';
import { LOCALES } from '@/lib/i18n';

const charts = JSON.parse(readFileSync(`public/data/charts.${facts.dataVersion}.json`, 'utf8')) as {
  labels: { code: string }[]; depart: { holiday: (string | null)[] };
};

describe('차트 문구', () => {
  for (const locale of LOCALES) {
    const c = dictionaries[locale].charts as unknown as Record<string, Record<string, string>>;
    it(`${locale}: 출발일 점 그래프 이름표의 공휴일 이름이 모두 있다(재추출로 코드가 바뀌면 여기서 멈춘다)`, () => {
      for (const { code } of charts.labels) expect(c.holidays[code], code).toBeTruthy();
    });
    // 표시 상자(계획 5-3b)는 이름표가 붙지 않는 공휴일 무렵 출발일에도 공휴일 이름을 쓴다 — Charts.tsx와 같이 데모 공휴일 이름표와 합쳐 찾는다
    it(`${locale}: 출발일 점 그래프의 모든 공휴일 코드에 이름이 있다(표시 상자에 코드가 그대로 나오지 않게)`, () => {
      const names = { ...dictionaries[locale].demo.holidays, ...c.holidays } as Record<string, string>;
      for (const code of new Set(charts.depart.holiday)) if (code !== null) expect(names[code], code).toBeTruthy();
    });
    // Features.tsx는 features.shap을 ShapTexts로 바꿔 넘긴다(형 변환) — 키가 빠지거나 더해지면 타입 검사가 못 잡으니 여기서 잡는다
    it(`${locale}: SHAP 벌떼 문구(features.shap) 키가 ShapTexts와 같다`, () => {
      expect(Object.keys(dictionaries[locale].features.shap)).toEqual([...SHAP_TEXT_KEYS]);
    });
    it(`${locale}: 그림 판 블록(depart·curve·band)마다 요약 문단이 있다`, () => {
      for (const id of ['depart', 'curve', 'band']) expect(c[id].alt, id).toBeTruthy();
    });
  }
});
