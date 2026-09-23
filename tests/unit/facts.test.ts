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
});
