import { z } from 'zod';
import { zUuidV7 } from '../ids.js';
import { PaymentFailureReason, PaymentMethod } from '../enums.js';

/** Every event payload carries these two, added by `outbox.add` (api-endpoints-plan §8). */
const zEventBase = z.object({ eventId: zUuidV7, occurredAt: z.string() });

const zVnd = z.number().int().nonnegative();

export const paymentSucceededPayload = zEventBase.extend({
  paymentId: zUuidV7,
  orderId: zUuidV7,
  userId: zUuidV7,
  amountVnd: zVnd,
  method: z.enum(PaymentMethod),
});

export const paymentFailedPayload = zEventBase.extend({
  paymentId: zUuidV7,
  orderId: zUuidV7,
  reason: z.enum(PaymentFailureReason),
});

export const refundSucceededPayload = zEventBase.extend({
  refundId: zUuidV7,
  paymentId: zUuidV7,
  orderId: zUuidV7,
  amountVnd: zVnd,
});

export const refundFailedPayload = zEventBase.extend({
  refundId: zUuidV7,
  paymentId: zUuidV7,
  orderId: zUuidV7,
});

export const PAYMENT_EVENT_SCHEMAS = {
  'payment.payment.succeeded': paymentSucceededPayload,
  'payment.payment.failed': paymentFailedPayload,
  'payment.refund.succeeded': refundSucceededPayload,
  'payment.refund.failed': refundFailedPayload,
} as const;
