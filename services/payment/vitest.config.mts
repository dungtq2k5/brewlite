import { fileURLToPath } from 'node:url';
import swc from 'unplugin-swc';
import { defineProject } from 'vitest/config';

// Unit tier only — this is the project the root aggregator and `pnpm test` run.
// `test:integration` (integration + contract, needs the stack) uses vitest.integration.config.mts directly.
export default defineProject({
  resolve: {
    alias: {
      '@brewlite/contracts': fileURLToPath(
        new URL('../../packages/contracts/src', import.meta.url),
      ),
    },
  },
  plugins: [
    swc.vite({
      module: { type: 'es6' },
      jsc: { transform: { legacyDecorator: true, decoratorMetadata: true } },
    }),
  ],
  test: {
    name: 'payment',
    include: ['src/**/*.spec.ts'],
    environment: 'node',
  },
});
