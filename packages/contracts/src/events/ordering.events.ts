import { z } from 'zod';
import { zUuidV7 } from '../ids.js';
import { CancelReason, OrderActorType, OrderStatus } from '../enums.js';

/** Every event payload carries these two, added by `outbox.add` (api-endpoints-plan §8). */
const zEventBase = z.object({ eventId: zUuidV7, occurredAt: z.string() });

/** One event per *transition* — `cancelReason` only when `to` is `CANCELLED`. */
export const orderStatusChangedPayload = zEventBase.extend({
  orderId: zUuidV7,
  orderNo: z.string(), // int64 as a string (conventions §5.1)
  userId: zUuidV7,
  from: z.enum(OrderStatus),
  to: z.enum(OrderStatus),
  actorType: z.enum(OrderActorType),
  paymentId: zUuidV7.optional(),
  cancelReason: z.enum(CancelReason).optional(),
});

/** A payment succeeded for an order that was no longer payable. */
export const orderPaymentRejectedPayload = zEventBase.extend({
  orderId: zUuidV7,
  paymentId: zUuidV7,
  orderStatus: z.enum(OrderStatus),
});

export const ORDERING_EVENT_SCHEMAS = {
  'ordering.order.status_changed': orderStatusChangedPayload,
  'ordering.payment.rejected': orderPaymentRejectedPayload,
} as const;
