import swc from 'unplugin-swc';
import { fileURLToPath } from 'node:url';
import type { UserProjectConfigExport } from 'vitest/config';

/**
 * The shared Vitest project shape for a Nest package or service: SWC transform with
 * decorator metadata on (Nest DI needs it), and `@brewlite/*` aliased to source so
 * `test` never depends on `^build`.
 */
export function nestProject(root: string, overrides: Partial<UserProjectConfigExport> = {}) {
  return {
    root,
    resolve: {
      alias: {
        '@brewlite/contracts': fileURLToPath(new URL('../../packages/contracts/src', root)),
        '@brewlite/nest-common': fileURLToPath(new URL('../../packages/nest-common/src', root)),
      },
    },
    plugins: [
      swc.vite({
        module: { type: 'es6' },
        jsc: { transform: { legacyDecorator: true, decoratorMetadata: true } },
      }),
    ],
    test: {
      globals: false,
      environment: 'node',
    },
    ...overrides,
  };
}
