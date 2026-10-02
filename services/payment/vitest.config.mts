import { defineProject } from 'vitest/config';
import { nestProject } from '../../packages/config/vitest.preset.js';

// Unit tier only — this is the project the root aggregator and `pnpm test` run.
// `test:integration` (integration + contract, needs the stack) uses vitest.integration.config.mts directly.
export default defineProject(
  nestProject('.', {
    test: {
      name: 'payment',
      include: ['src/**/*.spec.ts'],
      environment: 'node',
    },
  }),
);
