import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

/**
 * The shared flat config: TypeScript recommended rules, decorator-aware type-import
 * autofix (the DI trap, conventions §2), and the repo's boundary rules (conventions §2.1,
 * §3.2, §5.3, §9.2, §12). Each service's eslint.config.mjs spreads this array and appends
 * its own `ignores`.
 */
export const baseConfig = tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    // Plain JS/MJS scripts run under Node; TS files get no-undef disabled by typescript-eslint.
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: {
      globals: { console: 'readonly', process: 'readonly', Buffer: 'readonly', URL: 'readonly' },
    },
  },
  {
    // Type-aware parsing is scoped to real TS source — root/package config scripts
    // (*.mjs, *.mts, *.cjs) are never part of a tsconfig `include` and don't need it.
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parserOptions: {
        emitDecoratorMetadata: true,
        experimentalDecorators: true,
        projectService: true,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message: 'Math.random() is predictable — use generateToken() (conventions §9.2).',
        },
      ],
    },
  },
  {
    files: ['**/*.ts'],
    ignores: [
      '**/*.service.ts',
      '**/prisma.service.ts',
      '**/prisma/seed/**',
      '**/*.mapper.ts',
      '**/domain/*.ts',
      '**/test/setup/**',
      '**/lock-category.ts',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/generated/prisma*'],
              message:
                'The runtime Prisma client is only imported by *.service.ts, prisma.service.ts and prisma/seed/** (conventions §2.1).',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.mapper.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/generated/prisma*'],
              allowTypeImports: true,
              message:
                'A mapper imports Prisma types only, never the runtime client (conventions §2.1).',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/lock-category.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/generated/prisma*'],
              allowTypeImports: true,
              message:
                'A shared row-lock helper imports Prisma types only, never the runtime client (conventions §2.1).',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/domain/*.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/generated/prisma*'],
              message:
                'domain/*.ts is pure rules — no Prisma import in any form, import type included (conventions §2.1).',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['packages/contracts/**/*.ts'],
    // proto-paths.ts resolves the package's own install location on disk for the gRPC
    // loader — backend-only by nature, never imported by the web app.
    ignores: ['packages/contracts/src/proto-paths.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['node:*'],
              message: 'packages/contracts is client-safe — no Node-only code (conventions §3.2).',
            },
          ],
        },
      ],
    },
  },
  // Both `no-restricted-syntax` selector groups below join every config object that
  // touches this rule name — flat config REPLACES (never merges) a rule set by the same
  // name across matching objects, so a block that forgets a selector silently drops it
  // for any file that block matches (conventions §3.2, §16.4 lint check).
  (() => {
    const SORT_SELECTOR = {
      selector: "CallExpression[callee.property.name='sort'][arguments.length=0]",
      message:
        'A bare .sort() sorts by String(x) in code-unit order, silently wrong for numbers (conventions §3.2).',
    };
    const LOCALE_COMPARE_SELECTOR = {
      selector: "CallExpression[callee.property.name='localeCompare']",
      message:
        'localeCompare() is locale-dependent ordering of a machine string — use compareStrings() (conventions §3.2).',
    };
    // ponytail: no `**/test/**` carve-out for this selector (the doc's spec wants one) —
    // nothing in the repo currently calls delete()/deleteMany() from a test, so the
    // narrower scope adds config complexity with no current payoff. A test that
    // legitimately needs a raw delete gets an inline eslint-disable-next-line with a `//`
    // comment (conventions §13.2's pattern), add the carve-out if that becomes common.
    const HARD_DELETE_SELECTOR = {
      selector:
        'CallExpression[callee.property.name=/^(delete|deleteMany)$/][callee.object.property.name=/^(user|category|product|topping|promotion)$/]',
      message: 'A hard delete of a soft-deletable model is forbidden (conventions §7.3).',
    };
    const SHARED_SYNTAX = [SORT_SELECTOR, LOCALE_COMPARE_SELECTOR, HARD_DELETE_SELECTOR];

    return [
      {
        files: ['**/*.ts'],
        rules: {
          'no-restricted-syntax': ['error', ...SHARED_SYNTAX],
        },
      },
      {
        files: ['**/*.ts'],
        ignores: [
          'packages/nest-common/**',
          '**/env.schema.ts',
          '**/main.ts',
          '**/prisma.config.ts',
          '**/prisma/seed/**',
          '**/vitest.config.mts',
          '**/test/setup/**',
          '**/test/support/**',
          '**/scripts/**',
          // Deliberately redirects a client to an unreachable port for one e2e case.
          '**/catalog-unavailable.e2e.spec.ts',
          // Set JWT_PUBLIC_KEY / NODE_ENV before dynamically importing AppModule, so the
          // test proves a real key pair and a real production/non-production build.
          '**/auth-guard.e2e.spec.ts',
          '**/auth-guard-production.e2e.spec.ts',
          '**/route-markers.e2e.spec.ts',
          '**/rate-limit-redis-down.e2e.spec.ts',
          '**/users-routes.e2e.spec.ts',
          '**/admin-users.e2e.spec.ts',
          '**/staff-routes.e2e.spec.ts',
          '**/admin-catalog.e2e.spec.ts',
          '**/orders-routes.e2e.spec.ts',
          '**/payments-routes.e2e.spec.ts',
          '**/staff-orders-events.e2e.spec.ts',
          '**/promotions-loyalty-routes.e2e.spec.ts',
        ],
        rules: {
          'no-restricted-syntax': [
            'error',
            ...SHARED_SYNTAX,
            {
              selector: "NewExpression[callee.name='RpcException']",
              message:
                'Hand-built gRPC errors are forbidden — throw rpcError() instead (conventions §5.3).',
            },
            {
              selector:
                "MemberExpression[object.object.name='process'][object.property.name='env']",
              message:
                'Read configuration through the zod env schema, not process.env directly (conventions §12).',
            },
          ],
        },
      },
    ];
  })(),
);

export default baseConfig;
