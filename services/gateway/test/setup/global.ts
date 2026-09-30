import { testEnv } from './env.js';

// Runs before every e2e spec file (`vitest.config.mts` setupFiles). AppModule's
// AuthPipelineModule builds a Redis client from REDIS_URL unconditionally, so every
// spec that imports AppModule would otherwise dial the development Redis — this
// redirects them all to database 14, never touched outside tests (conventions §16.2).
// Database 15 is catalog's; a spec that needs a different REDIS_URL (e.g.
// rate-limit-redis-down.e2e.spec.ts) overrides it again after this runs.
process.env.REDIS_URL = testEnv.REDIS_URL_TEST;
// Same idea for the SSE source: every spec importing AppModule dials the test broker.
process.env.NATS_URL = testEnv.NATS_URL_TEST;
