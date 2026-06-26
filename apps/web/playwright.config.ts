import { defineConfig } from '@playwright/test';

// PLAYWRIGHT_BASE_URL is set in CI to the deployed stage URL.
// When unset (local dev), playwright auto-starts the dev server.
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';
const isRemote = !!process.env.PLAYWRIGHT_BASE_URL;

export default defineConfig({
  testDir: './e2e',
  // Aborts with a clear message if the target URL is another saasflare
  // product (website / onePay also default to :3000) instead of this app.
  globalSetup: './e2e/global-setup.ts',
  timeout: 30000,
  retries: 1,
  expect: { timeout: 10000 },
  // HTML report → apps/web/playwright-report/ (the dir referenced in docs/testing.md).
  // Not generated unless the html reporter is enabled; open: 'never' keeps CI non-interactive.
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL,
    headless: true,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: isRemote
    ? undefined
    : {
        command: 'pnpm run dev',
        cwd: '../../',
        url: 'http://localhost:3000',
        reuseExistingServer: true,
        timeout: 60000,
      },
});
