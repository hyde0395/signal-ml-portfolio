import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { resumeHref } from '@/lib/resume';

describe('resumeHref', () => {
  const dir = mkdtempSync(join(tmpdir(), 'resume-'));
  mkdirSync(join(dir, 'resume'));
  writeFileSync(join(dir, 'resume', 'ko.pdf'), '%PDF-1.4');

  it('파일이 있으면 경로', () => expect(resumeHref('ko', dir)).toBe('/resume/ko.pdf'));
  it('파일이 없으면 null', () => expect(resumeHref('ja', dir)).toBeNull());
});
