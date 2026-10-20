import { baseConfig } from './packages/config/eslint.config.mjs';
import webConfig from './apps/web/eslint.config.mjs';

export default [
  ...baseConfig,
  {
    ignores: ['**/dist/**', '**/generated/**', '**/.turbo/**', '**/coverage/**', 'docs/**'],
  },
  ...webConfig,
];
