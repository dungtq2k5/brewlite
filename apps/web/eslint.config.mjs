import baseConfig from '@brewlite/config/eslint.config.mjs';
export default [
  ...baseConfig,
  { ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts'] },
];