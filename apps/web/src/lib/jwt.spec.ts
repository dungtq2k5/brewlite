import { describe, expect, it } from 'vitest';
import { decodeJwt, secondsUntilExpiry } from './jwt';

const token = (claims: object) =>
  `h.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.s`;

describe('jwt exp read', () => {
  it('reads claims without verifying', () => {
    expect(decodeJwt(token({ role: 'STAFF', exp: 10 }))).toEqual({ role: 'STAFF', exp: 10 });
  });
  it('is undefined for junk', () => {
    expect(decodeJwt('nope')).toBeUndefined();
    expect(decodeJwt('a.%%%.c')).toBeUndefined();
  });
  it('counts seconds to expiry; unreadable means "refresh now"', () => {
    expect(secondsUntilExpiry(token({ exp: 1100 }), 1_000_000)).toBe(100);
    expect(secondsUntilExpiry(token({ exp: 900 }), 1_000_000)).toBeLessThan(0);
    expect(secondsUntilExpiry('nope')).toBeLessThan(0);
  });
});
