/** Its own file so `auth.module.ts` and `rate-limit.guard.ts` don't import each other. */
export const RATE_LIMIT_REDIS_CLIENT = Symbol('RATE_LIMIT_REDIS_CLIENT');
