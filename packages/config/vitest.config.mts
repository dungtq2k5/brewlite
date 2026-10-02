import { defineConfig } from 'vitest/config';
import { nestProject } from './vitest.preset.js';

/**
 * `pnpm test` (via `turbo run test`) runs this package's own `test` script, which is
 * `vitest run` against this file — so the `guards` project has to live here, not only in
 * the root aggregator, or `pnpm test` would never run it (conventions §16.4).
 */
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'config',
          include: ['**/*.spec.ts'],
          exclude: ['**/node_modules/**', 'guards/**'],
          // Each ESLint case builds a TypeScript project service from cold (~2 s here); on a
          // CI runner sharing its CPUs with other packages' tests that passes the 5 s default.
          testTimeout: 30_000,
        },
      },
      nestProject('.', {
        test: { name: 'guards', include: ['guards/**/*.spec.ts'] },
      }),
    ],
  },
});
