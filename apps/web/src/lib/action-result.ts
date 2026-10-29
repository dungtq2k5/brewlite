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

/**
 * Turns anything thrown by the generated client (or by the network) into the one
 * envelope every Server Action returns. The gateway sends codes, never UI text.
 */
export function actionFailure(error: unknown): ActionFailure {
  if (isRecord(error) && typeof error.code === 'string') {
    return {
      ok: false,
      code: error.code,
      details: isRecord(error.details) ? error.details : {},
    };
  }
  return { ok: false, code: 'INTERNAL', details: {} };
}
