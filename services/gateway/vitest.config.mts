import { defineProject } from 'vitest/config';
import { nestProject } from '../../packages/config/vitest.preset.js';

// Unit + e2e tier: gRPC peers stubbed, no infrastructure. The specs that need the real
// Redis or the test broker live in test/integration (vitest.integration.config.mts).
export default defineProject(
  nestProject('.', {
    test: {
      name: 'gateway',
      include: ['src/**/*.spec.ts', 'test/e2e/**/*.spec.ts'],
      environment: 'node',
      setupFiles: ['test/setup/global.ts'],
      fileParallelism: false,
    },
  }),
);
