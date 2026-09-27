import { z } from 'zod';

/**
 * A local copy of the gRPC status numbers — `@grpc/grpc-js` is Node-only and this
 * package is client-safe (conventions §3.2), so the numbers are inlined instead of
 * imported.
 */
export const GrpcStatus = {
  OK: 0,
  CANCELLED: 1,
  UNKNOWN: 2,
  INVALID_ARGUMENT: 3,
  DEADLINE_EXCEEDED: 4,
  NOT_FOUND: 5,
  ALREADY_EXISTS: 6,
  PERMISSION_DENIED: 7,
  RESOURCE_EXHAUSTED: 8,
  FAILED_PRECONDITION: 9,
  ABORTED: 10,
  OUT_OF_RANGE: 11,
  UNIMPLEMENTED: 12,
  INTERNAL: 13,
  UNAVAILABLE: 14,
  DATA_LOSS: 15,
  UNAUTHENTICATED: 16,
} as const;

export const zIssues = z.object({
  issues: z.array(z.object({ path: z.string(), code: z.string() })),
});

interface ErrorDefinition {
  http: number;
  grpc: (typeof GrpcStatus)[keyof typeof GrpcStatus];
  details?: z.ZodTypeAny;
}

/**
 * One entry per error code — the shape every later code joins, so a code can never
 * travel with two statuses (conventions §5.3). 01a adds every other code of
 * api-endpoints-plan §7; this is the skeleton subset.
 */
export const ERRORS = {
  VALIDATION_FAILED: { http: 400, grpc: GrpcStatus.INVALID_ARGUMENT, details: zIssues },
  MALFORMED_REQUEST: { http: 400, grpc: GrpcStatus.INVALID_ARGUMENT, details: undefined },
  ROUTE_NOT_FOUND: { http: 404, grpc: GrpcStatus.NOT_FOUND, details: undefined },
  INTERNAL: { http: 500, grpc: GrpcStatus.INTERNAL, details: undefined },
  UPSTREAM_UNAVAILABLE: { http: 503, grpc: GrpcStatus.UNAVAILABLE, details: undefined },
  UPSTREAM_TIMEOUT: { http: 504, grpc: GrpcStatus.DEADLINE_EXCEEDED, details: undefined },
} as const satisfies Record<string, ErrorDefinition>;

export type ErrorCode = keyof typeof ERRORS;
