import { defineConfig } from 'vitest/config';

// Each workspace package/service that has tests adds its own `root` entry here as it's
// built — Vitest 4's `projects`, not the deprecated workspace file. `packages/config`'s
// own vitest.config.mts nests the `config` and `guards` projects, since `pnpm test`
// (turbo → each package's own `test` script) resolves guards through that file, not
// this root aggregator.
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
