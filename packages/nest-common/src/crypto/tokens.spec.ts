import { describe, expect, it } from 'vitest';
import { generateToken, hashToken, timingSafeEqualHex } from './tokens.js';

describe('generateToken', () => {
  it('is 43 base64url characters', () => {
    expect(generateToken()).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('is different every call', () => {
    expect(generateToken()).not.toBe(generateToken());
  });
});

describe('hashToken', () => {
  it('matches a known SHA-256 vector', () => {
    expect(hashToken('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });
});

describe('timingSafeEqualHex', () => {
  it('true for equal hex strings', () => {
    const hash = hashToken('brewlite');
    expect(timingSafeEqualHex(hash, hash)).toBe(true);
  });

  it('false for unequal length', () => {
    expect(timingSafeEqualHex('ab', 'abcd')).toBe(false);
  });

  it('false for equal length, different content', () => {
    expect(timingSafeEqualHex('aaaa', 'bbbb')).toBe(false);
  });
});
