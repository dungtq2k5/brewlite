import type { Metadata } from '@grpc/grpc-js';
import { newId } from '@brewlite/contracts';

/** Reads `x-request-id` from incoming gRPC metadata into the service's log context. */
export function requestIdFromMetadata(metadata: Metadata | undefined): string {
  return (metadata?.get('x-request-id')[0] as string | undefined) ?? newId();
}
