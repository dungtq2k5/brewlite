import { defineConfig } from '@playwright/test';
import { BROWSER_WS } from './e2e/screens/browser-server';

// Chromium, the phone project by default (390 × 844, touch) and a 360 project for the narrow
// checks. Locally `webServer` starts `next start` on a production build, so the service worker
// is real; in CI the `apps` profile is up and the specs go through Caddy, as a browser would.
const phone = { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true };

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  // The smoke project never retries — a smoke that needs a retry is a finding (it overrides below).
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:23000',
    trace: 'retain-on-failure',
  },
  projects: [
    // The smoke journey lives in its own project, run by `pnpm smoke`, never twice in the full suite.
    { name: 'phone', testIgnore: [/smoke\//, /screens\//], use: { ...phone } },
    {
      name: 'narrow',
      testMatch: /shell\.spec\.ts/,
      use: { ...phone, viewport: { width: 360, height: 780 } },
    },
    { name: 'smoke', testMatch: /smoke\//, retries: 0, use: { ...phone } },
    // The screens suite: every designed state, drawn by one pinned browser (a container,
    // started and stopped around the project) and compared with its approved baseline, exactly.
    {
      name: 'screens-browser',
      testMatch: /screens\/browser\.setup\.ts/,
      teardown: 'screens-browser-stop',
    },
    { name: 'screens-browser-stop', testMatch: /screens\/browser\.teardown\.ts/ },
    {
      name: 'screens',
      testMatch: /screens\/.*\.spec\.ts$/,
      dependencies: ['screens-browser'],
      retries: 0, // a screenshot that needs a retry is a finding
      snapshotPathTemplate: '{testDir}/screens/__screenshots__/{arg}{ext}',
      expect: { toHaveScreenshot: { animations: 'disabled', caret: 'hide', scale: 'css' } },
      use: {
        ...phone,
        connectOptions: { wsEndpoint: BROWSER_WS, exposeNetwork: '<loopback>' },
      },
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
