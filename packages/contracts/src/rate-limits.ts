/**
 * Values only — 03 wires `@nestjs/throttler` to them. `AUTH`'s two keys are two buckets,
 * both enforced: one per IP, one per email, so rotating addresses cannot hammer one
 * account and one address cannot walk through many accounts.
 */
export const RATE_LIMITS = {
  PUBLIC_READ: { keys: ['ip'], limit: 120, ttlMs: 60_000 },
  AUTH: { keys: ['ip', 'email'], limit: 10, ttlMs: 15 * 60_000 },
  SESSION: { keys: ['ip'], limit: 60, ttlMs: 60_000 },
  ORDER_WRITE: { keys: ['user'], limit: 20, ttlMs: 60_000 },
  PAYMENT: { keys: ['user'], limit: 10, ttlMs: 60_000 },
  AUTHENTICATED: { keys: ['user'], limit: 300, ttlMs: 60_000 },
} as const;
export type RateLimitClass = keyof typeof RATE_LIMITS;
