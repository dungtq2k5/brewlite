import { fileURLToPath } from 'node:url';
import swc from 'unplugin-swc';
import { defineProject } from 'vitest/config';

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
    name: 'gateway',
    include: ['src/**/*.spec.ts', 'test/e2e/**/*.spec.ts'],
    environment: 'node',
    setupFiles: ['test/setup/global.ts'],
    fileParallelism: false,
  },
});
