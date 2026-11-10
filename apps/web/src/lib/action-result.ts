import { ApiClientError } from '@brewlite/api-client';

/** What every Server Action returns (conventions §11.1) — an API error never throws into the UI. */
export type ActionResult<T = void> =
  { ok: true; data: T } | { ok: false; code: string; details?: unknown };

/** Runs a call to the API; an `ApiClientError` becomes `{ ok: false }`, anything else `INTERNAL`. */
export async function toResult<T>(call: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await call() };
  } catch (error) {
    if (error instanceof ApiClientError) {
      return { ok: false, code: error.code, details: error.details };
    }
    // Name and message only — never a request, header or body (conventions §9.3).
    console.error('action failed', error instanceof Error ? error.name : typeof error);
    return { ok: false, code: 'INTERNAL' };
  }
}
