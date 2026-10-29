function decodeBase64Url(value: string): string {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
  return atob(padded);
}

function expirySeconds(token: string): number | null {
  const payload = token.split('.')[1];
  if (!payload) return null;
  try {
    const claims: unknown = JSON.parse(decodeBase64Url(payload));
    if (
      typeof claims === 'object' &&
      claims !== null &&
      'exp' in claims &&
      typeof claims.exp === 'number'
    ) {
      return claims.exp;
    }
  } catch {
    // A malformed token is treated as expired; the gateway remains the authority.
  }
  return null;
}

/** True once the token is at or past `exp` (no signature check — the gateway verifies). */
export function isAccessTokenExpired(token: string, skewSeconds = 0): boolean {
  const exp = expirySeconds(token);
  if (exp === null) return true;
  return exp <= Math.floor(Date.now() / 1000) + skewSeconds;
}

/** Refreshes slightly before expiry so a navigation never carries a dead token. */
export function isAccessTokenExpiring(token: string, skewSeconds = 30): boolean {
  return isAccessTokenExpired(token, skewSeconds);
}
