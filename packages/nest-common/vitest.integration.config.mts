import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    swc.vite({
      module: { type: 'es6' },
      jsc: { transform: { legacyDecorator: true, decoratorMetadata: true } },
    }),
  ],
  test: {
    name: 'nest-common-integration',
    include: ['test/integration/**/*.spec.ts'],
    environment: 'node',
    fileParallelism: false,
  },
});
