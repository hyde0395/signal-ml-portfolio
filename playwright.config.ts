// e2e 테스트 설정. 정적 export 결과물(out/)을 그대로 로컬 서버로 띄워서(npm run build 이후) 실제
// 배포와 같은 정적 파일 서빙 환경에서 테스트한다.
import { defineConfig, devices } from '@playwright/test';

// E2E_PORT: 여러 작업 폴더(worktree)가 동시에 e2e를 돌릴 때 서로의 out/ 서버를 재사용하지 않게 포트를 바꾼다(기본 4173)
const PORT = Number(process.env.E2E_PORT ?? 4173);

export default defineConfig({
  testDir: 'tests/e2e',
  use: { baseURL: `http://localhost:${PORT}` },
  projects: [
    {
      name: 'desktop',
      // CI의 헤드리스 Chromium은 기본 GPU 백엔드가 없어 WebGL이 꺼진다. swiftshader 소프트웨어
      // 렌더러를 강제로 켜서 3D 배경(data-3d="on")이 로컬과 동일하게 테스트되게 한다.
      use: { ...devices['Desktop Chrome'], launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } },
    },
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'], launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } },
    },
  ],
  // out/ 폴더를 정적 서버로 서빙한다. CI가 아니면 이미 떠 있는 서버를 재사용한다.
  webServer: { command: `npx serve out -l ${PORT} --no-clipboard`, port: PORT, reuseExistingServer: !process.env.CI },
});
