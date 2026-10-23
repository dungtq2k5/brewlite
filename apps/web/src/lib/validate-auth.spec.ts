import { describe, expect, it } from 'vitest';
import { validateLogin, validateRegister } from './validate-auth';

describe('validateLogin', () => {
  it('accepts a shaped email and any non-empty password', () => {
    expect(validateLogin({ email: 'a@b.co', password: 'x' })).toBeUndefined();
  });
  it('flags a malformed email and an empty password', () => {
    expect(validateLogin({ email: 'nope', password: '' })).toEqual({
      email: 'emailInvalid',
      password: 'passwordEmpty',
    });
  });
});

describe('validateRegister', () => {
  const ok = { email: 'a@b.co', fullName: 'Lan Anh', password: 'a'.repeat(8) };
  it('accepts 8 to 72 bytes', () => {
    expect(validateRegister(ok)).toBeUndefined();
    expect(validateRegister({ ...ok, password: 'a'.repeat(72) })).toBeUndefined();
  });
  it('counts bytes, not characters', () => {
    // 25 × 3-byte characters = 75 bytes
    expect(validateRegister({ ...ok, password: 'ệ'.repeat(25) })?.password).toBe('passwordTooLong');
    expect(validateRegister({ ...ok, password: 'ệ'.repeat(3) })).toBeUndefined(); // 9 bytes
  });
  it('flags short, empty and a missing name', () => {
    expect(validateRegister({ ...ok, password: 'a'.repeat(7) })?.password).toBe('passwordTooShort');
    expect(validateRegister({ ...ok, password: '' })?.password).toBe('passwordEmpty');
    expect(validateRegister({ ...ok, fullName: '  ' })?.fullName).toBe('fullNameEmpty');
  });
});
