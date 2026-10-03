import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { JWT_AUDIENCE, JWT_ISSUER, parseEnum, permissionsFor, Role } from '@brewlite/contracts';
import { apiError, AUTH_KEY, PERMISSION_KEY, type AuthRule } from '@brewlite/nest-common';
import type { Env } from '../config/env.schema.js';
import { setRequestContext } from './request-context.js';

interface AccessTokenClaims {
  sub: string;
  role: string;
  sid: string;
}

/**
 * APP_GUARD #1 (conventions §6.3). `PUBLIC` and `SIGNATURE` ignore any `Authorization`
 * header entirely — a stale token must never break a public route. `USER` and `perm:`
 * routes require a valid ES256 access token, verified with `JWT_PUBLIC_KEY` only — the
 * gateway never mints (architecture §5). No session lookup per request: the token is
 * trusted until it expires.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const base = { requestId: req.id !== undefined ? String(req.id) : 'unknown', ip: req.ip ?? '' };

    const rule = this.resolveRule(context);
    if (rule === 'PUBLIC' || rule === 'SIGNATURE') {
      setRequestContext(req, base);
      return true;
    }

    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw apiError('UNAUTHENTICATED');
    const token = header.slice('Bearer '.length);

    try {
      const publicKey = Buffer.from(
        this.config.get('JWT_PUBLIC_KEY', { infer: true }),
        'base64',
      ).toString('utf8');
      const payload = this.jwt.verify<AccessTokenClaims>(token, {
        algorithms: ['ES256'],
        publicKey,
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
      });
      const role = parseEnum(Role, payload.role);
      setRequestContext(req, {
        ...base,
        userId: payload.sub,
        role,
        sessionId: payload.sid,
        permissions: permissionsFor(role),
      });
    } catch {
      throw apiError('UNAUTHENTICATED');
    }
    return true;
  }

  /** The route's effective marker — a `perm:` marker implies `USER`. Method overrides class (Nest's own `getAllAndOverride`). */
  private resolveRule(context: ExecutionContext): AuthRule {
    const permission = this.reflector.getAllAndOverride<string | undefined>(PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (permission) return 'USER';
    const rule = this.reflector.getAllAndOverride<AuthRule | undefined>(AUTH_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    // The boot-time marker check refuses to start the app otherwise — this is a defensive default.
    return rule ?? 'USER';
  }
}
