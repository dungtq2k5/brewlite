import { applyDecorators, SetMetadata } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import type { Permission, RateLimitClass } from '@brewlite/contracts';

/**
 * Route markers — live in nest-common, not the gateway, because nest-common's
 * `OpsController` must carry one too. On backend services they are inert: nothing there
 * reads them.
 */
export const AUTH_KEY = 'brewlite:auth';
export const PERMISSION_KEY = 'brewlite:permission';
export const RATE_LIMIT_KEY = 'brewlite:rate-limit';

export type AuthRule = 'PUBLIC' | 'USER' | 'SIGNATURE';

/** The route's auth rule, and its Swagger security (`@ApiBearerAuth` for `USER`). */
export function Auth(rule: AuthRule): MethodDecorator & ClassDecorator {
  return rule === 'USER'
    ? applyDecorators(SetMetadata(AUTH_KEY, rule), ApiBearerAuth())
    : applyDecorators(SetMetadata(AUTH_KEY, rule));
}

/** The `perm:` rule — a `Permission`, so a typo is a compile error; no-argument is impossible by type. */
export function RequirePermission(code: Permission): MethodDecorator & ClassDecorator {
  return applyDecorators(SetMetadata(PERMISSION_KEY, code), ApiBearerAuth());
}

/** Overrides the marker's default rate-limit class (architecture §5.1). */
export function RateLimit(cls: RateLimitClass | 'NONE'): MethodDecorator & ClassDecorator {
  return SetMetadata(RATE_LIMIT_KEY, cls);
}
