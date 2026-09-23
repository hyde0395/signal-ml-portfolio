// next.config.ts가 정적 export 설정(output: 'export', trailingSlash: true)을 유지하는지 확인한다.
import { describe, expect, it } from 'vitest';
import config from '../../next.config';

describe('next config', () => {
  it('정적 export와 trailing slash를 쓴다', () => {
    expect(config.output).toBe('export');
    expect(config.trailingSlash).toBe(true);
  });
});
