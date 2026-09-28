import { Metadata } from '@grpc/grpc-js';
import type { status as GrpcStatus } from '@grpc/grpc-js';
import { RpcException } from '@nestjs/microservices';
import { ERRORS, type ErrorCode, type ErrorDetails } from '@brewlite/contracts';

/**
 * The only way to throw across gRPC (conventions §5.3). Builds an `RpcException`
 * carrying `ERRORS[code].grpc` and a real grpc-js `Metadata` with `bl-error-code` and,
 * when there are details, `bl-error-details-bin` — `-bin` because metadata values are
 * otherwise ASCII-only, so the details travel as UTF-8 JSON.
 *
 * Typed by the code: `rpcError('OUT_OF_STOCK')` (missing details) and
 * `rpcError('INTERNAL', { x: 1 })` (a code with none) are compile errors. Details are
 * parsed with the code's schema right here — a wrong shape throws `ZodError` at the call
 * site, not later in the gateway filter.
 */
export function rpcError<C extends ErrorCode>(
  code: C,
  ...args: [ErrorDetails<C>] extends [never] ? [] : [details: ErrorDetails<C>]
): RpcException {
  const definition = ERRORS[code];
  const metadata = new Metadata();
  metadata.set('bl-error-code', code);
  if (definition.details) {
    const parsed: unknown = definition.details.parse(args[0]);
    metadata.set('bl-error-details-bin', Buffer.from(JSON.stringify(parsed), 'utf8'));
  } else if (args[0] !== undefined) {
    throw new Error(`rpcError: ${code} takes no details`);
  }
  return new RpcException({
    code: definition.grpc as unknown as (typeof GrpcStatus)[keyof typeof GrpcStatus],
    message: code,
    metadata,
  });
}
