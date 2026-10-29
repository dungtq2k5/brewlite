/** Rows per page for the admin ledger tables; the gateway caps `pageSize` at 100. */
export const ADMIN_PAGE_SIZE = 12;

/** `?page=` is user input: accept only a positive integer, otherwise start at 1. */
export function parsePageParam(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

/** Cursors are opaque base64url values; anything else is treated as the first page. */
export function parseCursorParam(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw && /^[A-Za-z0-9_-]{1,64}$/.test(raw) ? raw : undefined;
}
