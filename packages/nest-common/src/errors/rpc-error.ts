import { Metadata } from '@grpc/grpc-js';
import type { status as GrpcStatus } from '@grpc/grpc-js';
import { RpcException } from '@nestjs/microservices';
import { ERRORS, type ErrorCode } from '@brewlite/contracts';

/**
 * The only way to throw across gRPC (conventions §5.3). Builds an `RpcException`
 * carrying `ERRORS[code].grpc` and a real grpc-js `Metadata` with `bl-error-code` and,
 * when there are details, `bl-error-details-bin` — `-bin` because metadata values are
 * otherwise ASCII-only, so the details travel as UTF-8 JSON.
 */
export function rpcError(code: ErrorCode, details?: unknown): RpcException {
  const definition = ERRORS[code];
  const metadata = new Metadata();
  metadata.set('bl-error-code', code);
  if (details !== undefined) {
    metadata.set('bl-error-details-bin', Buffer.from(JSON.stringify(details), 'utf8'));
  }
  return new RpcException({
    code: definition.grpc as unknown as (typeof GrpcStatus)[keyof typeof GrpcStatus],
    message: code,
    metadata,
  });
}
