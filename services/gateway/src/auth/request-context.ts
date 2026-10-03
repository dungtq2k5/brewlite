import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { Permission, Role } from '@brewlite/contracts';

export interface AnonymousContext {
  requestId: string;
  ip: string;
}

export interface UserContext {
  requestId: string;
  ip: string;
  userId: string;
  role: Role;
  sessionId: string;
  permissions: readonly Permission[];
}

export type RequestContext = AnonymousContext | UserContext;

export function isUserContext(ctx: RequestContext): ctx is UserContext {
  return 'userId' in ctx;
}

const CONTEXT_KEY = 'brewliteContext';

export function setRequestContext(req: Request, ctx: RequestContext): void {
  (req as unknown as Record<string, RequestContext>)[CONTEXT_KEY] = ctx;
}

export function getRequestContext(req: Request): RequestContext | undefined {
  return (req as unknown as Record<string, RequestContext | undefined>)[CONTEXT_KEY];
}

/** Handlers take `UserContext` only on `USER` / `perm:` routes — never a cast (conventions §4.1). */
export const Ctx = createParamDecorator((_data: unknown, executionContext: ExecutionContext) => {
  const req = executionContext.switchToHttp().getRequest<Request>();
  return (req as unknown as Record<string, RequestContext>)[CONTEXT_KEY];
});
