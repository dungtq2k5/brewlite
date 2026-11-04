export type ActionFailure = {
  ok: false;
  code: string;
  details: Record<string, unknown>;
};

export type ActionResult<T> = { ok: true; data: T } | ActionFailure;

export type ActionInput = Record<string, unknown>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const LOGGED_CODES = new Set(['INTERNAL', 'UPSTREAM_UNAVAILABLE', 'UPSTREAM_TIMEOUT']);

/**
 * Turns anything thrown by the generated client (or by the network) into the one
 * envelope every Server Action returns. The gateway sends codes, never UI text.
 * `ApiClientError.requestId` travels in `details` so support can trace a report
 * without the browser ever seeing the gateway body.
 */
export function actionFailure(error: unknown): ActionFailure {
  if (isRecord(error) && typeof error.code === 'string') {
    const details = isRecord(error.details) ? error.details : {};
    const requestId = typeof error.requestId === 'string' ? error.requestId : undefined;
    if (LOGGED_CODES.has(error.code)) {
      console.error(`[action] ${error.code}${requestId ? ` requestId=${requestId}` : ''}`);
    }
    return {
      ok: false,
      code: error.code,
      details: requestId ? { ...details, requestId } : details,
    };
  }
  return { ok: false, code: 'INTERNAL', details: {} };
}

/** An expired session must leave the console, not just show an inline error. */
function redirectToLogin(): void {
  if (typeof window === 'undefined') return;
  const next = `${window.location.pathname}${window.location.search}`;
  window.location.assign(`/login?next=${encodeURIComponent(next)}&expired=1`);
}

/**
 * A Server Action call can reject before it returns its envelope: the browser lost the
 * connection, the proxy timed out, or the action threw outside its own `try`. Callers
 * still receive an `ActionResult`, so `setBusy(null)` in `finally` always runs.
 */
export async function runAction<T>(call: Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    const result = await call;
    if (!result.ok && result.code === 'UNAUTHENTICATED') redirectToLogin();
    return result;
  } catch {
    return { ok: false, code: 'INTERNAL', details: {} };
  }
}
