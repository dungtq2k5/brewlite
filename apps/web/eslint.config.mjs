import { baseConfig } from '../../packages/config/eslint.config.mjs';

export default [
  ...baseConfig,
  {
    ignores: [
      '.next/**',
      '.turbo/**',
      'node_modules/**',
      'public/sw.js',
      'next-env.d.ts',
      'tsconfig.tsbuildinfo',
    ],
  },
  {
    // Next inlines NEXT_PUBLIC_* only when it sees a direct `process.env.X` read at
    // build time, and these server adapters (gateway URL, cookie flags, proxy refresh)
    // read runtime configuration before a request-scoped schema exists. The remaining
    // no-restricted-syntax selectors (sort, localeCompare, hard delete) do not apply
    // to these files, so the rule is off here rather than restated.
    files: [
      'src/app/api/events/**/*.ts',
      'src/lib/api-server.ts',
      'src/lib/api.ts',
      'src/lib/auth-cookies.ts',
      'src/lib/firebase.ts',
      'src/lib/gateway-sse.ts',
      'src/middleware.ts',
    ],
    rules: {
      'no-restricted-syntax': 'off',
    },
  },
];
