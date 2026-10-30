import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';
import i18next from 'eslint-plugin-i18next';
import { baseConfig } from '../../packages/config/eslint.config.mjs';

const config = [
  ...baseConfig,
  ...nextCoreWebVitals,
  ...nextTypescript,
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
