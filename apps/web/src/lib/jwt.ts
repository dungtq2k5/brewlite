export interface JwtClaims {
  exp?: number;
  role?: string;
}

/**
 * Reads a JWT's payload **without verifying it** — the gateway verifies. Used only to decide
 * whether to refresh and as a hint for a redirect; never as an authorization.
 */
export function decodeJwt(token: string): JwtClaims | undefined {
  const part = token.split('.')[1];
  if (!part) return undefined;
  try {
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const claims: unknown = JSON.parse(new TextDecoder().decode(bytes));
    return typeof claims === 'object' && claims !== null ? (claims as JwtClaims) : undefined;
  } catch {
    return undefined;
  }
}

/** Seconds until `exp`; `-Infinity`-like (negative) when unreadable so the caller refreshes. */
export function secondsUntilExpiry(token: string, nowMs = Date.now()): number {
  const exp = decodeJwt(token)?.exp;
  return typeof exp === 'number' ? exp - nowMs / 1000 : Number.NEGATIVE_INFINITY;
}
