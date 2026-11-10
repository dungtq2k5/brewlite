import { baseConfig } from './packages/config/eslint.config.mjs';

export default [
  ...baseConfig,
  {
    ignores: [
      '**/dist/**',
      '**/generated/**',
      '**/.turbo/**',
      '**/coverage/**',
      'docs/**',
      // The service worker runs in a ServiceWorkerGlobalScope; apps/web's own config ignores it too.
      'apps/web/public/sw.js',
    ],
  },
];
