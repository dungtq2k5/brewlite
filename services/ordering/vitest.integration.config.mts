import { fileURLToPath } from 'node:url';
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
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
    name: 'ordering-integration',
    include: ['test/integration/**/*.spec.ts', 'test/contract/**/*.spec.ts'],
    environment: 'node',
    globalSetup: ['test/setup/global.ts'],
    setupFiles: ['test/setup/per-file.ts'],
    fileParallelism: false,
  },
});
