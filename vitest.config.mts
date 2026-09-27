import { defineConfig } from 'vitest/config';

// Each workspace package/service that has tests adds its own `root` entry here as it's
// built (§10 of impl doc 01) — Vitest 4's `projects`, not the deprecated workspace file.
export default defineConfig({
  test: {
    projects: [
      'packages/config',
      'packages/contracts',
      'packages/nest-common',
      'services/catalog',
      'services/gateway',
    ],
  },
});
