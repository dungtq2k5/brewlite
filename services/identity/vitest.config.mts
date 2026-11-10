import { defineProject } from 'vitest/config';
import { nestProject } from '../../packages/config/vitest.preset.mjs';

// Unit tier only — `test:integration` (integration + contract, needs the stack) uses
// vitest.integration.config.mts directly.
export default defineProject(
  nestProject('.', {
    test: {
      name: 'identity',
      include: ['src/**/*.spec.ts'],
      environment: 'node',
    },
  }),
);
