import {
  Inject,
  Injectable,
  Logger,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import type { Redis } from 'ioredis';
import { normalizeEmail, RATE_LIMITS, type RateLimitClass } from '@brewlite/contracts';
import {
  apiError,
  ApiError,
  AUTH_KEY,
  PERMISSION_KEY,
  RATE_LIMIT_KEY,
  type AuthRule,
} from '@brewlite/nest-common';
import { getRequestContext, isUserContext } from './request-context.js';
import { RATE_LIMIT_REDIS_CLIENT } from './rate-limit-redis.token.js';

/**
 * APP_GUARD #3 (architecture §5.1). A fixed window per key, `INCR` + `PEXPIRE … NX` in
 * one round trip — `NX` keeps the first request's window. Fails **open** on any Redis
 * error: a rate limiter must not take the shop down (api-endpoints-plan §0.8).
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitGuard.name);

  constructor(
    private readonly reflector: Reflector,
    @Inject(RATE_LIMIT_REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const cls = this.resolveClass(context);
    if (cls === 'NONE') return true;

    const req = context.switchToHttp().getRequest<Request>();
    const rule = RATE_LIMITS[cls];

    try {
      for (const kind of rule.keys) {
        const value = this.keyValue(kind, req);
        if (value === undefined) continue;
        const key = `gw:rl:${cls}:${kind}:${value}`;

        const results = await this.redis.multi().incr(key).pexpire(key, rule.ttlMs, 'NX').exec();
        const count = results?.[0]?.[1] as number | undefined;
        if (count !== undefined && count > rule.limit) {
          const ttlMs = await this.redis.pttl(key);
          const retryAfterSeconds = Math.ceil(Math.max(ttlMs, 0) / 1000);
          context
            .switchToHttp()
            .getResponse<Response>()
            .setHeader('Retry-After', String(retryAfterSeconds));
          throw apiError('RATE_LIMITED', { retryAfterSeconds });
        }
      }
    } catch (error) {
      if (error instanceof ApiError) throw error;
      this.logger.error({ err: error }, 'rate limit check failed; allowing the request');
      return true;
    }
    return true;
  }

  /** `@RateLimit(…)` overrides; otherwise the marker's default — PUBLIC → PUBLIC_READ, USER/perm → AUTHENTICATED, SIGNATURE → NONE. */
  private resolveClass(context: ExecutionContext): RateLimitClass | 'NONE' {
    const targets = [context.getHandler(), context.getClass()];
    const override = this.reflector.getAllAndOverride<RateLimitClass | 'NONE' | undefined>(
      RATE_LIMIT_KEY,
      targets,
    );
    if (override) return override;

    const permission = this.reflector.getAllAndOverride<string | undefined>(
      PERMISSION_KEY,
      targets,
    );
    if (permission) return 'AUTHENTICATED';

    const rule = this.reflector.getAllAndOverride<AuthRule | undefined>(AUTH_KEY, targets);
    if (rule === 'PUBLIC') return 'PUBLIC_READ';
    if (rule === 'SIGNATURE') return 'NONE';
    return 'AUTHENTICATED';
  }

  private keyValue(kind: string, req: Request): string | undefined {
    if (kind === 'ip') return req.ip;
    if (kind === 'user') {
      const ctx = getRequestContext(req);
      return ctx && isUserContext(ctx) ? ctx.userId : undefined;
    }
    if (kind === 'email') {
      const body = req.body as Record<string, unknown> | undefined;
      const email = body?.email;
      return typeof email === 'string' ? normalizeEmail(email) : undefined;
    }
    return undefined;
  }
}
