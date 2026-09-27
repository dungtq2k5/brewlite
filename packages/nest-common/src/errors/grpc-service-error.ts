import type { Metadata, ServiceError } from '@grpc/grpc-js';

/**
 * On the client, a failed gRPC call rejects with a grpc-js `ServiceError`
 * (`code`, `details`, `metadata`), not an `RpcException` — matched by shape.
 */
export function isGrpcServiceError(error: unknown): error is ServiceError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as { code: unknown }).code === 'number' &&
    'metadata' in error
  );
}

export function readErrorCode(error: ServiceError): string | undefined {
  return error.metadata?.get('bl-error-code')[0]?.toString();
}

export function readErrorDetails(error: ServiceError): unknown {
  const raw = error.metadata?.get('bl-error-details-bin')[0];
  if (raw === undefined) return undefined;
  const buffer = Buffer.isBuffer(raw) ? raw : Buffer.from(raw as string, 'binary');
  try {
    return JSON.parse(buffer.toString('utf8'));
  } catch {
    return undefined;
  }
}

export type { Metadata };
