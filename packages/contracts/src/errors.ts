import { z } from 'zod';
import { PERMISSIONS } from './access.js';
import {
  zFirebaseTokenInvalidReason,
  zImageInvalidReason,
  zOptionInvalidReason,
  zPromoInvalidReason,
  zResourceKind,
} from './error-details.js';
import { Locale, OrderStatus } from './enums.js';
import { zUuidV7 } from './ids.js';

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

const zInt = z.number().int();
const zVnd = zInt.nonnegative();

interface ErrorDefinition {
  http: number;
  grpc: (typeof GrpcStatus)[keyof typeof GrpcStatus];
  details?: z.ZodTypeAny;
}

/**
 * One entry per error code, every code of api-endpoints-plan §7 — the shape every later
 * code joins, so a code can never travel with two statuses (conventions §5.3).
 * `INVALID_STATE.status` is `string`, not `OrderStatus` — payment raises it too, with a
 * payment status. `ORDER_NOT_PAYABLE.status` is always an order's.
 */
export const ERRORS = {
  VALIDATION_FAILED: { http: 400, grpc: GrpcStatus.INVALID_ARGUMENT, details: zIssues },
  MALFORMED_REQUEST: { http: 400, grpc: GrpcStatus.INVALID_ARGUMENT, details: undefined },
  IDEMPOTENCY_KEY_REQUIRED: { http: 400, grpc: GrpcStatus.INVALID_ARGUMENT, details: undefined },
  WEBHOOK_SIGNATURE_INVALID: { http: 400, grpc: GrpcStatus.INVALID_ARGUMENT, details: undefined },

  UNAUTHENTICATED: { http: 401, grpc: GrpcStatus.UNAUTHENTICATED, details: undefined },
  INVALID_CREDENTIALS: { http: 401, grpc: GrpcStatus.UNAUTHENTICATED, details: undefined },
  FIREBASE_TOKEN_INVALID: {
    http: 401,
    grpc: GrpcStatus.UNAUTHENTICATED,
    details: z.object({ reason: zFirebaseTokenInvalidReason }),
  },

  PERMISSION_DENIED: {
    http: 403,
    grpc: GrpcStatus.PERMISSION_DENIED,
    details: z.object({ required: z.array(z.enum(PERMISSIONS)) }),
  },
  ACCOUNT_LOCKED: {
    http: 403,
    grpc: GrpcStatus.PERMISSION_DENIED,
    details: z.object({ lockedUntil: z.iso.datetime().nullable() }),
  },
  ACCOUNT_DEACTIVATED: { http: 403, grpc: GrpcStatus.PERMISSION_DENIED, details: undefined },
  SELF_ACTION_FORBIDDEN: { http: 403, grpc: GrpcStatus.PERMISSION_DENIED, details: undefined },
  CURRENT_PASSWORD_INCORRECT: { http: 403, grpc: GrpcStatus.PERMISSION_DENIED, details: undefined },

  ROUTE_NOT_FOUND: { http: 404, grpc: GrpcStatus.NOT_FOUND, details: undefined },
  RESOURCE_NOT_FOUND: {
    http: 404,
    grpc: GrpcStatus.NOT_FOUND,
    details: z.object({ resource: zResourceKind }),
  },

  INVALID_STATE: {
    http: 409,
    grpc: GrpcStatus.FAILED_PRECONDITION,
    details: z.object({ status: z.string() }),
  },
  EMAIL_TAKEN: { http: 409, grpc: GrpcStatus.ALREADY_EXISTS, details: undefined },
  LAST_ADMIN: { http: 409, grpc: GrpcStatus.FAILED_PRECONDITION, details: undefined },
  CATEGORY_NAME_TAKEN: {
    http: 409,
    grpc: GrpcStatus.ALREADY_EXISTS,
    details: z.object({ locale: z.enum(Locale) }),
  },
  PRODUCT_NAME_TAKEN: {
    http: 409,
    grpc: GrpcStatus.ALREADY_EXISTS,
    details: z.object({ locale: z.enum(Locale) }),
  },
  TOPPING_NAME_TAKEN: {
    http: 409,
    grpc: GrpcStatus.ALREADY_EXISTS,
    details: z.object({ locale: z.enum(Locale) }),
  },
  PROMO_CODE_TAKEN: { http: 409, grpc: GrpcStatus.ALREADY_EXISTS, details: undefined },
  CATEGORY_IN_USE: { http: 409, grpc: GrpcStatus.FAILED_PRECONDITION, details: undefined },
  STOCK_VERSION_CONFLICT: {
    http: 409,
    grpc: GrpcStatus.FAILED_PRECONDITION,
    details: z.object({ currentVersion: zInt, currentStockQty: zInt.nullable() }),
  },
  OUT_OF_STOCK: {
    http: 409,
    grpc: GrpcStatus.FAILED_PRECONDITION,
    details: z.object({
      products: z.array(z.object({ productId: zUuidV7, available: zInt.nonnegative() })),
    }),
  },
  STOCK_CONTENDED: { http: 409, grpc: GrpcStatus.FAILED_PRECONDITION, details: undefined },
  ORDER_NOT_PAYABLE: {
    http: 409,
    grpc: GrpcStatus.FAILED_PRECONDITION,
    details: z.object({ status: z.enum(OrderStatus) }),
  },

  IDEMPOTENCY_KEY_REUSED: { http: 422, grpc: GrpcStatus.FAILED_PRECONDITION, details: undefined },
  PRODUCT_UNAVAILABLE: {
    http: 422,
    grpc: GrpcStatus.FAILED_PRECONDITION,
    details: z.object({ productIds: z.array(zUuidV7) }),
  },
  OPTION_INVALID: {
    http: 422,
    grpc: GrpcStatus.FAILED_PRECONDITION,
    details: z.object({ lineIndex: zInt.nonnegative(), reason: zOptionInvalidReason }),
  },
  PROMO_CODE_INVALID: {
    http: 422,
    grpc: GrpcStatus.FAILED_PRECONDITION,
    details: z.object({ reason: zPromoInvalidReason, minSubtotalVnd: zVnd.optional() }),
  },
  PROMO_MAX_USES_BELOW_USED: {
    http: 422,
    grpc: GrpcStatus.FAILED_PRECONDITION,
    details: z.object({ usedCount: zInt.nonnegative() }),
  },
  POINTS_INSUFFICIENT: {
    http: 422,
    grpc: GrpcStatus.FAILED_PRECONDITION,
    details: z.object({ balance: zInt.nonnegative() }),
  },
  ORDER_TOTAL_TOO_LOW: {
    http: 422,
    grpc: GrpcStatus.FAILED_PRECONDITION,
    details: z.object({ minimumVnd: zVnd }),
  },
  IMAGE_INVALID: {
    http: 422,
    grpc: GrpcStatus.FAILED_PRECONDITION,
    details: z.object({ reason: zImageInvalidReason }),
  },
  RESOURCE_REFERENCE_INVALID: {
    http: 422,
    grpc: GrpcStatus.FAILED_PRECONDITION,
    details: z.object({ field: z.string() }),
  },

  RATE_LIMITED: {
    http: 429,
    grpc: GrpcStatus.RESOURCE_EXHAUSTED,
    details: z.object({ retryAfterSeconds: zInt.nonnegative() }),
  },

  INTERNAL: { http: 500, grpc: GrpcStatus.INTERNAL, details: undefined },
  UPSTREAM_UNAVAILABLE: { http: 503, grpc: GrpcStatus.UNAVAILABLE, details: undefined },
  PAYMENT_PROVIDER_UNAVAILABLE: { http: 503, grpc: GrpcStatus.UNAVAILABLE, details: undefined },
  UPSTREAM_TIMEOUT: { http: 504, grpc: GrpcStatus.DEADLINE_EXCEEDED, details: undefined },
} as const satisfies Record<string, ErrorDefinition>;

export type ErrorCode = keyof typeof ERRORS;

/**
 * The input type of a code's `details` schema, or `never` for a code with none.
 * `rpcError` and, in 03, `apiError` use it so a call site cannot forget or invent details.
 */
export type ErrorDetails<C extends ErrorCode> = (typeof ERRORS)[C]['details'] extends z.ZodType
  ? z.input<(typeof ERRORS)[C]['details']>
  : never;
