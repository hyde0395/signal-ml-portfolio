// 단위 테스트(tests/unit) 설정. src의 '@' 별칭을 tsconfig와 동일하게 맞춰 import 경로가 일치하게 한다.
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: { environment: 'node', include: ['tests/unit/**/*.test.ts'] },
});
