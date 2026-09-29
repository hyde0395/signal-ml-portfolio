// 섹션 목록 검사: 순서대로 번호가 매겨지고, 머리표가 "NN — 이름" 모양이며, id가 겹치지 않는다.
import { describe, expect, it } from 'vitest';
import { eyebrow, sectionNumber, SECTIONS } from '@/lib/sections';

describe('섹션 목록', () => {
  it('설계 순서(①~⑤, 설계 2026-09-29 이야기 흐름 §2)', () => {
    expect(SECTIONS.map((s) => s.id)).toEqual(['project', 'data', 'features', 'findings', 'validation']);
  });
  it('번호는 목록 순서로 두 자리', () => {
    expect(SECTIONS.map((s) => sectionNumber(s.id))).toEqual(['01', '02', '03', '04', '05']);
  });
  it('머리표', () => {
    expect(eyebrow('data')).toBe('02 — DATA COLLECTION');
    expect(eyebrow('features')).toBe('03 — MODEL & FEATURES');
    expect(eyebrow('findings')).toBe('04 — FINDINGS');
    expect(eyebrow('validation')).toBe('05 — VALIDATION');
  });
  it('id가 겹치지 않는다', () => {
    expect(new Set(SECTIONS.map((s) => s.id)).size).toBe(SECTIONS.length);
  });
});
