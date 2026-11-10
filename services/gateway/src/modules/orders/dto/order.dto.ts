import { createZodDto } from '@brewlite/nest-common';
import {
  MAX_LINES_PER_ORDER,
  MAX_QTY_PER_LINE,
  MAX_TOPPINGS_PER_LINE,
  ORDER_NOTE_MAX_LENGTH,
  ORDER_STATUSES,
  POINTS_CAP_REASONS,
  PRODUCT_SIZES,
  PROMO_CODE_PATTERN,
  zCursorQuery,
  zLocalizedTextResponse,
  zText,
  zUuidV7,
} from '@brewlite/contracts';
import { z } from 'zod';

const zCartLine = z
  .object({
    productId: zUuidV7,
    size: z.enum(PRODUCT_SIZES),
    toppingIds: z.array(zUuidV7).max(MAX_TOPPINGS_PER_LINE),
    qty: z.number().int().min(1).max(MAX_QTY_PER_LINE),
  })
  .strict();

// Trimmed and upper-cased before the pattern check, so "save10" and " SAVE10 " both
// normalize the same way a customer would expect (rdm-spec §2.3).
const zPromoCode = z
  .string()
  .transform((s) => s.trim().toUpperCase())
  .pipe(z.string().regex(PROMO_CODE_PATTERN));

// Points to spend (ADR 0035): above the cap the quote clips; above the balance placing refuses.
const zPointsToRedeem = z.number().int().min(1).max(1_000_000);

export const quoteSchema = z
  .object({
    items: z.array(zCartLine).min(1).max(MAX_LINES_PER_ORDER),
    promoCode: zPromoCode.optional(),
    pointsToRedeem: zPointsToRedeem.optional(),
  })
  .strict();
export class QuoteDto extends createZodDto(quoteSchema) {}

export const placeOrderSchema = z
  .object({
    items: z.array(zCartLine).min(1).max(MAX_LINES_PER_ORDER),
    promoCode: zPromoCode.optional(),
    pointsToRedeem: zPointsToRedeem.optional(),
    note: zText(ORDER_NOTE_MAX_LENGTH).optional(),
  })
  .strict();
export class PlaceOrderDto extends createZodDto(placeOrderSchema) {}

export const listMyOrdersQuerySchema = zCursorQuery
  .extend({ status: z.enum(ORDER_STATUSES).optional() })
  .strict();
export class ListMyOrdersQueryDto extends createZodDto(listMyOrdersQuerySchema) {}

const orderLineToppingResponseSchema = z.object({
  toppingId: zUuidV7,
  name: zLocalizedTextResponse,
  priceVnd: z.number().int(),
});

const orderLineResponseSchema = z.object({
  productId: zUuidV7,
  productName: zLocalizedTextResponse,
  size: z.enum(PRODUCT_SIZES),
  toppings: z.array(orderLineToppingResponseSchema),
  unitPriceVnd: z.number().int(),
  qty: z.number().int(),
  lineTotalVnd: z.number().int(),
});

// What a quote and an order share (api-endpoints-plan §3.1).
const pricedResponseSchema = z.object({
  lines: z.array(orderLineResponseSchema),
  subtotalVnd: z.number().int(),
  promoDiscountVnd: z.number().int(),
  pointsDiscountVnd: z.number().int(),
  totalVnd: z.number().int(),
  promoCode: z.string().nullable(),
  pointsEarnable: z.number().int(),
});

export const quoteResponseSchema = pricedResponseSchema.extend({
  // The caller's balance, the most this cart can take and which limit set it — shown even when
  // no points were asked for — and the points actually applied.
  pointsBalance: z.number().int(),
  pointsRedeemable: z.number().int(),
  pointsCapReason: z.enum(POINTS_CAP_REASONS),
  pointsRedeemed: z.number().int(),
});
export class QuoteResponseDto extends createZodDto(quoteResponseSchema) {}

export const orderHistoryEntryResponseSchema = z.object({
  fromStatus: z.string().nullable(),
  toStatus: z.string(),
  actorType: z.string(),
  note: z.string().nullable(),
  createdAt: z.string(),
});

// `Order = Quote & {...}` (api-endpoints-plan §3.1) — `history` is `[]` on a list row.
export const orderResponseSchema = pricedResponseSchema.extend({
  id: zUuidV7,
  orderNo: z.string(),
  status: z.string(),
  note: z.string().nullable(),
  expiresAt: z.string().nullable(),
  paidAt: z.string().nullable(),
  createdAt: z.string(),
  cancelReason: z.string().nullable(),
  cancelNote: z.string().nullable(),
  // O-1 `cancelled_at`: set by every cancel (the table's CHECK says so), `null` otherwise.
  cancelledAt: z.string().nullable(),
  refundStatus: z.string(),
  pointsEarned: z.number().int(),
  // O-1 `points_redeemed` — points spent on this order; their value is `pointsDiscountVnd`.
  pointsRedeemed: z.number().int(),
  // The payment in progress, or the one that paid it (`GET /payments/:id`).
  currentPaymentId: zUuidV7.nullable(),
  history: z.array(orderHistoryEntryResponseSchema),
});
export class OrderResponseDto extends createZodDto(orderResponseSchema) {}
