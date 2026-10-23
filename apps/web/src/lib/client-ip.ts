/**
 * The visitor's address: the **rightmost** `x-forwarded-for` entry. Next 16 passes a browser's
 * own header through, so this is trustworthy only because Caddy is the sole way in and
 * replaces the header with the socket address (ADR 0033). No fallback.
 */
export function clientIp(headers: Pick<Headers, 'get'>): string | undefined {
  const raw = headers.get('x-forwarded-for');
  if (!raw) return undefined;
  const last = raw.split(',').at(-1)?.trim();
  return last || undefined;
}
