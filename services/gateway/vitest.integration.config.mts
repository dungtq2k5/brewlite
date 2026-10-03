import { defineConfig } from 'vitest/config';
import { nestProject } from '../../packages/config/vitest.preset.js';

// The specs that need the real Redis (rate limiting) and the real test broker (the SSE
// source) — run after the infra stack is up, never inside `pnpm test`.
export default defineConfig(
  nestProject('.', {
    test: {
      name: 'gateway-integration',
      include: ['test/integration/**/*.spec.ts'],
      environment: 'node',
      setupFiles: ['test/setup/global.ts'],
      fileParallelism: false,
    },
  }),
);
