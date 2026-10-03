import {
  isGrpcServiceError,
  readErrorCode,
  readErrorDetails,
  rpcError,
} from '@brewlite/nest-common';
import { ERRORS, type ErrorCode } from '@brewlite/contracts';

/**
 * Rebuilds a catalog refusal as ordering's own `rpcError`, so the code and details cross
 * the second hop (catalog → ordering → gateway) unchanged — a fresh `Metadata` object,
 * not the original relayed as-is. Anything not a recognised `bl-error-code` is rethrown
 * as-is (an `UNAVAILABLE`/`DEADLINE_EXCEEDED`, or a bug).
 */
export function rethrowCatalogError(error: unknown): never {
  if (isGrpcServiceError(error)) {
    const code = readErrorCode(error);
    if (code !== undefined && code in ERRORS) {
      const details = readErrorDetails(error);
      const build = rpcError as (code: ErrorCode, details?: unknown) => Error;
      throw build(code as ErrorCode, details);
    }
  }
  throw error;
}
