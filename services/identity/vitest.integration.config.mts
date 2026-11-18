import { defineConfig } from 'vitest/config';
import { nestProject } from '../../packages/config/vitest.preset.mjs';

export default defineConfig(
  nestProject('.', {
    test: {
      name: 'identity-integration',
      include: ['test/integration/**/*.spec.ts', 'test/contract/**/*.spec.ts'],
      environment: 'node',
      globalSetup: ['test/setup/global.ts'],
      setupFiles: ['test/setup/per-file.ts'],
      fileParallelism: false,
      // bcrypt cost 12 in pure JS, up to ~8 hashes per test, and V8 coverage on a CI runner.
      testTimeout: 30_000,
    },
  }),
);
