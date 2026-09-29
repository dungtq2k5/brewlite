import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { Permission } from '@brewlite/contracts';
import { apiError, PERMISSION_KEY } from '@brewlite/nest-common';
import { getRequestContext, isUserContext } from './request-context.js';

/** APP_GUARD #2 (conventions §6.3). A no-op on any route without `@RequirePermission`. */
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const permission = this.reflector.getAllAndOverride<Permission | undefined>(PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!permission) return true;

    const req = context.switchToHttp().getRequest<Request>();
    const ctx = getRequestContext(req);
    if (!ctx || !isUserContext(ctx) || !ctx.permissions.includes(permission)) {
      throw apiError('PERMISSION_DENIED', { required: [permission] });
    }
    return true;
  }
}
