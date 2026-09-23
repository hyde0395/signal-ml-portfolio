import { describe, expect, it } from 'vitest';
import config from '../../next.config';

describe('next config', () => {
  it('정적 export와 trailing slash를 쓴다', () => {
    expect(config.output).toBe('export');
    expect(config.trailingSlash).toBe(true);
  });
});
