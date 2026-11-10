import { defineConfig } from 'vitest/config';
import { nestProject } from '../config/vitest.preset.mjs';

export default defineConfig(
  nestProject('.', {
    test: {
      name: 'nest-common-integration',
      include: ['test/integration/**/*.spec.ts'],
      environment: 'node',
      fileParallelism: false,
    },
  }),
);
