import { ERRORS, type ErrorCode, type ErrorDetails } from '@brewlite/contracts';

/** Thrown by a gateway guard, which runs before any service and so cannot use `rpcError`. */
export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly details: unknown;

  constructor(code: ErrorCode, details: unknown) {
    super(code);
    this.code = code;
    this.details = details;
  }
}

/**
 * The guard-side twin of `rpcError` (conventions §5.3, §6.3), typed exactly the same
 * way: `apiError('UNAUTHENTICATED')` (no details) and `apiError('RATE_LIMITED')` (missing
 * required details) are compile errors. Details are parsed with the code's schema right
 * here, not later in `ErrorFilter`.
 */
export function apiError<C extends ErrorCode>(
  code: C,
  ...args: [ErrorDetails<C>] extends [never] ? [] : [details: ErrorDetails<C>]
): ApiError {
  const definition = ERRORS[code];
  if (definition.details) {
    return new ApiError(code, definition.details.parse(args[0]));
  }
  if (args[0] !== undefined) {
    throw new Error(`apiError: ${code} takes no details`);
  }
  return new ApiError(code, undefined);
}
