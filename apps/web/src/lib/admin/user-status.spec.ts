import { describe, expect, it } from 'vitest';
import { userStatus } from './user-status';

const now = new Date('2026-11-10T00:00:00Z');
const user = { deletedAt: null, isLocked: false, lockedUntil: null };

describe('userStatus', () => {
  it('is active by default', () => {
    expect(userStatus(user, now)).toEqual({ kind: 'active' });
  });
  it('is locked until a future date, or until unlocked', () => {
    expect(
      userStatus({ ...user, isLocked: true, lockedUntil: '2026-11-15T17:00:00Z' }, now),
    ).toEqual({
      kind: 'locked',
      until: '2026-11-15T17:00:00Z',
    });
    expect(userStatus({ ...user, isLocked: true }, now)).toEqual({ kind: 'locked', until: null });
  });
  it('reads a lapsed lock as active', () => {
    expect(
      userStatus({ ...user, isLocked: true, lockedUntil: '2026-11-09T17:00:00Z' }, now),
    ).toEqual({
      kind: 'active',
    });
  });
  it('puts deactivated before a lock', () => {
    expect(
      userStatus({ deletedAt: '2026-11-01T00:00:00Z', isLocked: true, lockedUntil: null }, now),
    ).toEqual({
      kind: 'deactivated',
    });
  });
});
