import { defineConfig, devices } from '@playwright/test';

/**
 * The browser suite runs against the dev stack (`pnpm dev` at the repo root):
 * web on :23000, gateway on :23100, payment provider FAKE.
 *
 * `globalSetup` fails fast with a readable message when the stack is not up,
 * instead of letting every spec time out on the first navigation.
 */
export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: true,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: 'http://localhost:23000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    viewport: { width: 1440, height: 900 },
    timezoneId: 'Asia/Ho_Chi_Minh',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
