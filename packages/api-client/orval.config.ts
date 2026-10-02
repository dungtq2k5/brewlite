import { defineConfig } from 'orval';

const input = '../../services/gateway/openapi.json';

// No TanStack Query hooks (ADR 0011, architecture §2.4) — plain typed fetch functions plus
// the zod schemas the web app reuses for form validation.
export default defineConfig({
  endpoints: {
    input,
    output: {
      client: 'fetch',
      mode: 'tags-split',
      target: 'src/generated/endpoints',
      schemas: 'src/generated/model',
      clean: true,
      override: { mutator: { path: 'src/mutator.ts', name: 'apiFetch' } },
    },
  },
  zod: {
    input,
    output: {
      client: 'zod',
      mode: 'tags-split',
      target: 'src/generated/zod',
      fileExtension: '.zod.ts',
      clean: true,
    },
  },
});
