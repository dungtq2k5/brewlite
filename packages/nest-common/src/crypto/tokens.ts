import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/** The only way to make a refresh token (conventions §9.2) — 32 random bytes, base64url. */
export function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

/** SHA-256 hex (rdm-spec §2.6) — for values looked up by value through a unique index. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** `timingSafeEqual` on the decoded hex buffers; `false`, not a throw, on a length mismatch. */
export function timingSafeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'hex');
  const bufB = Buffer.from(b, 'hex');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
