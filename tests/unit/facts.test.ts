// data/facts.json이 스키마를 지키는지, 대표 수치가 들어 있는지, 코드 링크 조립이 맞는지 확인한다.
import { describe, expect, it } from 'vitest';
import raw from '../../data/facts.json';
import { codeUrl, facts, factsSchema } from '@/lib/facts';

describe('facts.json', () => {
  it('스키마를 통과한다', () => {
    expect(() => factsSchema.parse(raw)).not.toThrow();
  });

  it('필수 수치가 들어 있다', () => {
    expect(facts.data.filteredRows).toBe(242874);
    expect(facts.model.tss.r2).toBe(0.637);
    expect(facts.model.bookingCurve).toHaveLength(8);
    expect(facts.demoDefault.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('숫자 자리에 문자열이 오면 거부한다', () => {
    const broken = structuredClone(raw) as Record<string, any>;
    broken.model.tss.mae = '48,235';
    expect(() => factsSchema.parse(broken)).toThrow();
  });

  it('코드 링크를 기본 주소 + 경로로 만든다', () => {
    expect(codeUrl('bubble')).toBe(
      'https://github.com/hyde0395/airfare-forecasting-ml/blob/main/src/processing/features.py',
    );
  });

  it('노선별 행 수의 합은 필터 후 행 수와 같다(플립 보드 TOTAL)', () => {
    expect(facts.data.byRoute.map((r) => r.pair)).toEqual(['ICN_NRT', 'ICN_KIX', 'ICN_HND']);
    expect(facts.data.byRoute.reduce((s, r) => s + r.rows, 0)).toBe(facts.data.filteredRows);
  });

  // ② 보드는 걸러내기 판보다 먼저 나와 걸러내기 전 모은 행을 보여 준다(2026-10-01). 합계가 걸러내기 판의 시작 수와 같아야 한다
  it('모은 행의 노선별 수는 byRoute와 같은 줄 순서이고 합은 원본 행 수다(플립 보드 TOTAL)', () => {
    expect(facts.data.rawByRoute.map((r) => r.pair)).toEqual(facts.data.byRoute.map((r) => r.pair));
    expect(facts.data.rawByRoute.reduce((s, r) => s + r.rows, 0)).toBe(facts.data.rawRows);
    facts.data.rawByRoute.forEach((r, i) => expect(r.rows).toBeGreaterThanOrEqual(facts.data.byRoute[i].rows));
  });

  it('피처 그룹의 피처 수 합이 featureCount다', () => {
    expect(facts.model.featureGroups.map((g) => g.id)).toEqual(['lookup', 'categorical', 'holiday', 'days', 'flight', 'market']);
    expect(facts.model.featureGroups.reduce((s, g) => s + g.features.length, 0)).toBe(facts.model.featureCount);
  });

  it('피처 섹션 코드 링크', () => {
    expect(codeUrl('features')).toBe('https://github.com/hyde0395/airfare-forecasting-ml/blob/main/src/processing/features.py');
  });
});

describe('site.airport(첫 화면 메타 줄)', () => {
  it('공항 코드와 좌표가 있다', () => {
    expect(facts.site.airport.code).toBe('ICN');
    expect(facts.site.airport.lat).toBeGreaterThan(37);
    expect(facts.site.airport.lon).toBeGreaterThan(126);
  });
});
