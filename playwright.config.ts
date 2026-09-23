// e2e 테스트 설정. 정적 export 결과물(out/)을 그대로 로컬 서버로 띄워서(npm run build 이후) 실제
// 배포와 같은 정적 파일 서빙 환경에서 테스트한다.
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  use: { baseURL: 'http://localhost:4173' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  // out/ 폴더를 정적 서버로 서빙한다. CI가 아니면 이미 떠 있는 서버를 재사용한다.
  webServer: { command: 'npx serve out -l 4173 --no-clipboard', port: 4173, reuseExistingServer: !process.env.CI },
});
