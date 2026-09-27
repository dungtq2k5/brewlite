import { baseConfig } from './packages/config/eslint.config.mjs';

export default [
  ...baseConfig,
  {
    ignores: ['**/dist/**', '**/generated/**', '**/.turbo/**', '**/coverage/**', 'docs/**'],
  },
];
