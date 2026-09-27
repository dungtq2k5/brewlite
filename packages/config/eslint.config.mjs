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
      '**/test/setup/**',
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
  {
    // Both `no-restricted-syntax` selectors live in one config object — flat config
    // replaces (never merges) a rule set by the same name across matching objects, so a
    // second block here would silently drop this one's selector for any overlapping file.
    files: ['**/*.ts'],
    ignores: [
      'packages/nest-common/**',
      '**/env.schema.ts',
      '**/main.ts',
      '**/prisma.config.ts',
      '**/vitest.config.mts',
      '**/test/setup/**',
      '**/scripts/**',
      // Deliberately redirects a client to an unreachable port for one e2e case.
      '**/catalog-unavailable.e2e.spec.ts',
    ],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "NewExpression[callee.name='RpcException']",
          message:
            'Hand-built gRPC errors are forbidden — throw rpcError() instead (conventions §5.3).',
        },
        {
          selector: "MemberExpression[object.object.name='process'][object.property.name='env']",
          message:
            'Read configuration through the zod env schema, not process.env directly (conventions §12).',
        },
      ],
    },
  },
);

export default baseConfig;
