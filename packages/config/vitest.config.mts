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
        },
      },
      nestProject('.', {
        test: { name: 'guards', include: ['guards/**/*.spec.ts'] },
      }),
    ],
  },
});
