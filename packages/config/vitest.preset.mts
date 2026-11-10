import swc from 'unplugin-swc';
import { fileURLToPath } from 'node:url';
import type { UserProjectConfigExport } from 'vitest/config';

// packages/contracts and packages/nest-common are always siblings of this preset file,
// regardless of which project consumes it — resolved from this file's own location, not
// the consumer's.
const CONTRACTS_SRC = fileURLToPath(new URL('../contracts/src', import.meta.url));
const NEST_COMMON_SRC = fileURLToPath(new URL('../nest-common/src', import.meta.url));
const SETUP = fileURLToPath(new URL('./vitest.setup.mts', import.meta.url));

/**
 * The shared Vitest project shape for a Nest package or service: SWC transform with
 * decorator metadata on (Nest DI needs it), and `@brewlite/*` aliased to source so
 * `test` never depends on `^build`. `root` is the project's own filesystem directory.
 *
 * Tests are silent: pino gets `LOG_LEVEL=silent` (Vitest's per-worker env, which `@nestjs/config`
 * prefers over `.env`) and Nest's own `Logger` is switched off in `vitest.setup.mts`.
 * `TEST_LOGS=1` brings both back. The `test` block merges with the project's own.
 */
export function nestProject(
  root: string,
  overrides: Partial<UserProjectConfigExport> & {
    test?: { env?: Record<string, string>; setupFiles?: string[] } & Record<string, unknown>;
  } = {},
) {
  const { test = {}, ...rest } = overrides;
  return {
    root,
    resolve: {
      alias: {
        '@brewlite/contracts': CONTRACTS_SRC,
        '@brewlite/nest-common': NEST_COMMON_SRC,
      },
    },
    plugins: [
      swc.vite({
        module: { type: 'es6' },
        jsc: { transform: { legacyDecorator: true, decoratorMetadata: true } },
      }),
    ],
    ...rest,
    test: {
      globals: false,
      environment: 'node',
      ...test,
      env: { LOG_LEVEL: process.env.TEST_LOGS ? 'debug' : 'silent', ...test.env },
      setupFiles: [SETUP, ...(test.setupFiles ?? [])],
    },
  };
}
