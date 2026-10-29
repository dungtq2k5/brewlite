import { baseConfig } from './packages/config/eslint.config.mjs';

export default [
  ...baseConfig,
  {
    ignores: ['**/dist/**', '**/generated/**', '**/.turbo/**', '**/coverage/**', 'docs/**'],
  },
  {
    // Next inlines NEXT_PUBLIC_* only on a direct `process.env.X` read, and these
    // server adapters read runtime configuration before a request-scoped schema
    // exists. This mirrors apps/web/eslint.config.mjs: lint-staged runs ESLint
    // from the repo root, so the app config alone never applies to a commit.
    files: [
      'apps/web/src/app/api/events/**/*.ts',
      'apps/web/src/lib/api-server.ts',
      'apps/web/src/lib/api.ts',
      'apps/web/src/lib/auth-cookies.ts',
      'apps/web/src/lib/firebase.ts',
      'apps/web/src/lib/gateway-sse.ts',
      'apps/web/src/middleware.ts',
    ],
    rules: {
      'no-restricted-syntax': 'off',
    },
  },
];
