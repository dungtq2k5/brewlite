import type { Redis } from 'ioredis';
import type { ReadinessCheck } from './readiness.js';

const DEFAULT_TIMEOUT_MS = 500;

/** `PING`s `redis`, bounded by `timeoutMs` — a hung connection must not hang readiness (api-endpoints-plan §11). */
export function redisPingCheck(redis: Redis, timeoutMs = DEFAULT_TIMEOUT_MS): ReadinessCheck {
  return () =>
    new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => resolve(false), timeoutMs);
      redis
        .ping()
        .then(() => resolve(true))
        .catch(() => resolve(false))
        .finally(() => clearTimeout(timer));
    });
}
