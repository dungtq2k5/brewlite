import { defineConfig } from '@playwright/test';

// Chromium, the phone project by default (390 × 844, touch) and a 360 project for the narrow
// checks. Locally `webServer` starts `next start` on a production build, so the service worker
// is real; in CI the `apps` profile is up and the specs go through Caddy, as a browser would.
const phone = { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true };

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:23000',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'phone', use: { ...phone } },
    {
      name: 'narrow',
      testMatch: /shell\.spec\.ts/,
      use: { ...phone, viewport: { width: 360, height: 780 } },
    },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'pnpm build && pnpm start',
        url: 'http://localhost:23000/offline',
        reuseExistingServer: true,
        timeout: 240_000,
      },
});
