import { describe, expect, it } from 'vitest';
import { isUniqueConstraintViolation } from './unique-violation.js';

const classicShape = (target: string[]) => ({ code: 'P2002', meta: { target } });
const driverAdapterShape = (index: string) => ({
  code: 'P2002',
  meta: { driverAdapterError: { cause: { constraint: { index } } } },
});

describe('isUniqueConstraintViolation', () => {
  it('is false for a non-P2002 error', () => {
    expect(isUniqueConstraintViolation({ code: 'P2025' })).toBe(false);
    expect(isUniqueConstraintViolation(new Error('boom'))).toBe(false);
    expect(isUniqueConstraintViolation(null)).toBe(false);
  });

  it('is true for any P2002 when no target is given', () => {
    expect(isUniqueConstraintViolation(classicShape(['email']))).toBe(true);
  });

  it('narrows by target against the classic meta.target column array', () => {
    expect(isUniqueConstraintViolation(classicShape(['email']), 'email')).toBe(true);
    expect(isUniqueConstraintViolation(classicShape(['firebase_uid']), 'email')).toBe(false);
  });

  it('narrows by target against the driver-adapter constraint index name', () => {
    expect(isUniqueConstraintViolation(driverAdapterShape('users_email_key'), 'email')).toBe(true);
    expect(isUniqueConstraintViolation(driverAdapterShape('users_firebase_uid_key'), 'email')).toBe(
      false,
    );
    expect(
      isUniqueConstraintViolation(driverAdapterShape('users_firebase_uid_key'), 'firebase_uid'),
    ).toBe(true);
  });
});
