import { Metadata } from '@grpc/grpc-js';
import { describe, expect, it } from 'vitest';
import { newId, Role } from '@brewlite/contracts';
import { callerFrom, requireUser, SYSTEM_CALLER } from './caller.js';

describe('callerFrom', () => {
  it('builds a USER caller from both headers', () => {
    const userId = newId();
    const metadata = new Metadata();
    metadata.set('x-user-id', userId);
    metadata.set('x-user-role', Role.STAFF);
    expect(callerFrom(metadata)).toEqual({ kind: 'USER', userId, role: 'STAFF' });
  });

  it('ANONYMOUS when neither header is present', () => {
    expect(callerFrom(new Metadata())).toEqual({ kind: 'ANONYMOUS' });
    expect(callerFrom(undefined)).toEqual({ kind: 'ANONYMOUS' });
  });

  it('throws, never degrades to ANONYMOUS, on a bad role', () => {
    const metadata = new Metadata();
    metadata.set('x-user-id', newId());
    metadata.set('x-user-role', 'NOT_A_ROLE');
    expect(() => callerFrom(metadata)).toThrow();
  });

  it('throws on a malformed user id', () => {
    const metadata = new Metadata();
    metadata.set('x-user-id', 'not-a-uuid');
    metadata.set('x-user-role', 'CUSTOMER');
    expect(() => callerFrom(metadata)).toThrow();
  });

  it('throws when only one header is present', () => {
    const metadata = new Metadata();
    metadata.set('x-user-id', newId());
    expect(() => callerFrom(metadata)).toThrow();
  });
});

describe('SYSTEM_CALLER', () => {
  it('is frozen', () => {
    expect(Object.isFrozen(SYSTEM_CALLER)).toBe(true);
    expect(SYSTEM_CALLER).toEqual({ kind: 'SYSTEM' });
  });
});

describe('requireUser', () => {
  it('returns the USER variant', () => {
    const caller = { kind: 'USER' as const, userId: newId(), role: Role.CUSTOMER };
    expect(requireUser(caller)).toBe(caller);
  });

  it('throws UNAUTHENTICATED for ANONYMOUS', () => {
    expect(() => requireUser({ kind: 'ANONYMOUS' })).toThrow();
  });

  it('throws UNAUTHENTICATED for SYSTEM', () => {
    expect(() => requireUser(SYSTEM_CALLER)).toThrow();
  });
});
