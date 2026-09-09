import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'tests/ui',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  use: {
    actionTimeout: 10000,
    channel:
      process.env.PLAYWRIGHT_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined),
    baseURL: 'http://127.0.0.1:4322',
    viewport: { width: 360, height: 640 },
  },
  webServer: {
    command: 'npx tsx tests/ui/server.ts',
    url: 'http://127.0.0.1:4322/tests/ui/index.html',
    reuseExistingServer: false,
  },
  reporter: 'list',
});
