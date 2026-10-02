import type { Metadata } from '@grpc/grpc-js';
import { parseEnum, Role, zUuidV7 } from '@brewlite/contracts';
import { rpcError } from '../errors/rpc-error.js';

export type Caller =
  { kind: 'USER'; userId: string; role: Role } | { kind: 'ANONYMOUS' } | { kind: 'SYSTEM' };

export const SYSTEM_CALLER: Caller = Object.freeze({ kind: 'SYSTEM' });

/**
 * Reads `x-user-id` / `x-user-role` from gRPC metadata the gateway set. Neither present
 * → `ANONYMOUS`. A malformed pair (one present, or either fails its own type) **throws**
 * rather than degrading to `ANONYMOUS` — that shape can only come from a gateway bug,
 * which is a `500`, never a silent downgrade to "nobody's signed in".
 */
export function callerFrom(metadata: Metadata | undefined): Caller {
  const userId = metadata?.get('x-user-id')[0] as string | undefined;
  const role = metadata?.get('x-user-role')[0] as string | undefined;
  if (userId === undefined && role === undefined) return { kind: 'ANONYMOUS' };
  return { kind: 'USER', userId: zUuidV7.parse(userId), role: parseEnum(Role, role ?? '') };
}

/** The `USER` variant, or `rpcError('UNAUTHENTICATED')` — for a method that must have one. */
export function requireUser(caller: Caller): Extract<Caller, { kind: 'USER' }> {
  if (caller.kind !== 'USER') throw rpcError('UNAUTHENTICATED');
  return caller;
}
