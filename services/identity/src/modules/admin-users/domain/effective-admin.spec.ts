import { describe, expect, it } from 'vitest';
import { isEffectiveAdmin } from './effective-admin.js';

describe('isEffectiveAdmin', () => {
  const now = new Date('2026-01-01T00:00:00Z');

  it('is true when not locked', () => {
    expect(isEffectiveAdmin({ isLocked: false, lockedUntil: null }, now)).toBe(true);
  });

  it('is false when locked with no end date (indefinite)', () => {
    expect(isEffectiveAdmin({ isLocked: true, lockedUntil: null }, now)).toBe(false);
  });

  it('is false when locked until a future time', () => {
    const future = new Date(now.getTime() + 1000);
    expect(isEffectiveAdmin({ isLocked: true, lockedUntil: future }, now)).toBe(false);
  });

  it('is true when locked but the lock already expired — it will lift at next sign-in', () => {
    const past = new Date(now.getTime() - 1000);
    expect(isEffectiveAdmin({ isLocked: true, lockedUntil: past }, now)).toBe(true);
  });

  it('is true when the lock expires exactly now', () => {
    expect(isEffectiveAdmin({ isLocked: true, lockedUntil: now }, now)).toBe(true);
  });
});
