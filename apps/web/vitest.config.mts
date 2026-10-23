import { fileURLToPath } from 'node:url';
import { defineProject } from 'vitest/config';

const at = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineProject({
  resolve: {
    alias: {
      '@': at('./src'),
      // Source, not dist, so `test` never depends on `^build` (same as the Nest projects).
      '@brewlite/contracts': at('../../packages/contracts/src/index.ts'),
      // `server-only` throws outside Next's `react-server` condition.
      'server-only': at('./test/empty.ts'),
    },
  },
  test: {
    name: 'web',
    include: ['src/**/*.spec.ts', 'src/**/*.spec.tsx', 'scripts/**/*.spec.ts', 'test/**/*.spec.ts'],
    environment: 'node',
  },
});
