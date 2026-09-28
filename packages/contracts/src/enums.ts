/**
 * Every enumerated column of rdm-spec §3 — a string `enum` plus a derived `readonly`
 * array (conventions §3.2). ADR 0010: never a Prisma `enum`.
 */

/** I-1 `role` */
export enum Role {
  CUSTOMER = 'CUSTOMER',
  STAFF = 'STAFF',
  ADMIN = 'ADMIN',
}
export const ROLES = Object.values(Role);

/** I-1 `preferred_locale` */
export enum Locale {
  EN = 'en',
  VI = 'vi',
}
export const SUPPORTED_LOCALES = Object.values(Locale);
export const DEFAULT_LOCALE = Locale.EN;

/** C-3 `size`, O-2 `size` — in display order */
export enum ProductSize {
  S = 'S',
  M = 'M',
  L = 'L',
}
export const PRODUCT_SIZES = Object.values(ProductSize);

/** C-6 `status` */
export enum ReservationStatus {
  HELD = 'HELD',
  CONFIRMED = 'CONFIRMED',
  RELEASED = 'RELEASED',
}
export const RESERVATION_STATUSES = Object.values(ReservationStatus);

/** O-1 `status`, O-3 `from_status` / `to_status` */
export enum OrderStatus {
  PENDING = 'PENDING',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  PAID = 'PAID',
  PREPARING = 'PREPARING',
  READY = 'READY',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}
export const ORDER_STATUSES = Object.values(OrderStatus);

/** The staff board's columns — a subset of OrderStatus, never retyped as strings. */
export const STAFF_BOARD_STATUSES = [
  OrderStatus.PAID,
  OrderStatus.PREPARING,
  OrderStatus.READY,
] as const;

/** O-1 `cancel_reason` */
export enum CancelReason {
  CUSTOMER = 'CUSTOMER',
  EXPIRED = 'EXPIRED',
  STAFF = 'STAFF',
}
export const CANCEL_REASONS = Object.values(CancelReason);

/** O-1 `refund_status` — the order's view. See RefundStatus for the refund row's. */
export enum OrderRefundStatus {
  NONE = 'NONE',
  PENDING = 'PENDING',
  REFUNDED = 'REFUNDED',
  FAILED = 'FAILED',
}
export const ORDER_REFUND_STATUSES = Object.values(OrderRefundStatus);

/** O-3 `actor_type` */
export enum OrderActorType {
  CUSTOMER = 'CUSTOMER',
  STAFF = 'STAFF',
  SYSTEM = 'SYSTEM',
  PAYMENT = 'PAYMENT',
}
export const ORDER_ACTOR_TYPES = Object.values(OrderActorType);

/** O-4 `discount_type` */
export enum DiscountType {
  PERCENT = 'PERCENT',
  FIXED = 'FIXED',
}
export const DISCOUNT_TYPES = Object.values(DiscountType);

/** O-6 `kind` */
export enum LoyaltyKind {
  EARN = 'EARN',
  EARN_REVERSED = 'EARN_REVERSED',
  REDEEM = 'REDEEM',
  REDEEM_RETURNED = 'REDEEM_RETURNED',
}
export const LOYALTY_KINDS = Object.values(LoyaltyKind);

/** P-1 `provider` */
export enum PaymentProvider {
  STRIPE = 'STRIPE',
  FAKE = 'FAKE',
}
export const PAYMENT_PROVIDERS = Object.values(PaymentProvider);

/** P-1 `status` */
export enum PaymentStatus {
  PENDING = 'PENDING',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
  EXPIRED = 'EXPIRED',
}
export const PAYMENT_STATUSES = Object.values(PaymentStatus);

/** P-1 `method` */
export enum PaymentMethod {
  CARD = 'CARD',
  GOOGLE_PAY = 'GOOGLE_PAY',
  APPLE_PAY = 'APPLE_PAY',
  LINK = 'LINK',
  OTHER = 'OTHER',
  FAKE = 'FAKE',
}
export const PAYMENT_METHODS = Object.values(PaymentMethod);

/** P-1 `failure_reason` */
export enum PaymentFailureReason {
  ASYNC_FAILED = 'ASYNC_FAILED',
  EXPIRED = 'EXPIRED',
  SIMULATED = 'SIMULATED',
}
export const PAYMENT_FAILURE_REASONS = Object.values(PaymentFailureReason);

/** P-2 `reason` */
export enum RefundReason {
  STAFF_CANCELLED = 'STAFF_CANCELLED',
  ORDER_NOT_PAYABLE = 'ORDER_NOT_PAYABLE',
}
export const REFUND_REASONS = Object.values(RefundReason);

/** P-2 `status` — the refund row's view. See OrderRefundStatus for the order's. */
export enum RefundStatus {
  PENDING = 'PENDING',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
}
export const REFUND_STATUSES = Object.values(RefundStatus);

/**
 * Returns `value` typed to `enumObject`, or throws a plain `Error` naming the enum and
 * the value. `contracts` cannot import `rpcError`; in a service, an unknown stored value
 * is a bug, and a plain error becomes `500 INTERNAL` at the gateway — which is what a bug
 * should be. A proto enum's `..._UNSPECIFIED` value is refused here too, since it is not
 * a member of the TS enum (conventions §5.1).
 */
export function parseEnum<T extends Record<string, string>>(
  enumObject: T,
  value: string,
): T[keyof T] {
  if ((Object.values(enumObject) as string[]).includes(value)) {
    return value as T[keyof T];
  }
  throw new Error(`Unknown value "${value}" for enum ${JSON.stringify(Object.values(enumObject))}`);
}
