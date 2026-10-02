import { defineConfig } from 'vitest/config';
import { nestProject } from '../../packages/config/vitest.preset.js';

export default defineConfig(
  nestProject('.', {
    test: {
      name: 'ordering-integration',
      include: ['test/integration/**/*.spec.ts', 'test/contract/**/*.spec.ts'],
      environment: 'node',
      globalSetup: ['test/setup/global.ts'],
      setupFiles: ['test/setup/per-file.ts'],
      fileParallelism: false,
    },
  }),
);
