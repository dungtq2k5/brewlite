import { fileURLToPath } from 'node:url';
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';
import i18next from 'eslint-plugin-i18next';
import { baseConfig } from '../../packages/config/eslint.config.mjs';

const config = [
  ...baseConfig,
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    // Next's rules find `app/` relative to the working directory unless told; the pre-commit hook
    // lints from the repo root, where `no-html-link-for-pages` then saw no pages, called a needed
    // `eslint-disable` unused, and its `--fix` deleted it. Anchored here, both places agree.
    settings: { next: { rootDir: fileURLToPath(new URL('.', import.meta.url)) } },
  },
  {
    ignores: [
      '.next/**',
      'playwright-report/**',
      'test-results/**',
      'next-env.d.ts',
      'public/sw.js',
    ],
  },
  {
    // Product photos are plain lazy <img> in a fixed frame — the reason is in ProductImage.
    files: ['src/components/menu/ProductImage.tsx'],
    rules: { '@next/next/no-img-element': 'off' },
  },
  {
    // conventions §11.6: no user-facing literal in JSX text.
    files: ['src/**/*.tsx'],
    ignores: ['**/*.spec.tsx'],
    plugins: { i18next },
    rules: { 'i18next/no-literal-string': ['error', { mode: 'jsx-text-only' }] },
  },
];

export default config;
