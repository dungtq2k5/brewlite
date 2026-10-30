import { z } from 'zod';

/**
 * zod 4 probes whether it may compile parsers with `Function("")`. Under a Content-Security-
 * Policy without `unsafe-eval` that probe is *caught* — the schemas still work — but the browser
 * reports it as a violation. In a browser zod therefore runs without the JIT; on a server (no
 * CSP, and the speed matters) it keeps it. Imported first by `index.ts`, so it runs before any
 * schema in this package is built.
 */
if (typeof window !== 'undefined') z.config({ jitless: true });
