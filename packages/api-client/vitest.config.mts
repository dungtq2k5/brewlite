import { fileURLToPath } from 'node:url';
import { defineProject } from 'vitest/config';

export default defineProject({
  resolve: {
    alias: {
      // `server-only` throws outside Next's `react-server` condition; this package's own
      // tests run in plain Node, so it is aliased to an empty module here.
      'server-only': fileURLToPath(new URL('./test/empty.ts', import.meta.url)),
    },
  },
  test: {
    name: 'api-client',
    include: ['src/**/*.spec.ts'],
  },
});
