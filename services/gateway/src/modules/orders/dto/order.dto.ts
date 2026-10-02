import { createZodDto } from '@brewlite/nest-common';
import {
  MAX_LINES_PER_ORDER,
  MAX_QTY_PER_LINE,
  MAX_TOPPINGS_PER_LINE,
  ORDER_NOTE_MAX_LENGTH,
  ORDER_STATUSES,
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

export const quoteSchema = z
  .object({
    items: z.array(zCartLine).min(1).max(MAX_LINES_PER_ORDER),
    promoCode: zPromoCode.optional(),
  })
  .strict();
export class QuoteDto extends createZodDto(quoteSchema) {}

// No `pointsToRedeem` — P1; `.strict()` refuses it until then (conventions §1.3).
export const placeOrderSchema = z
  .object({
    items: z.array(zCartLine).min(1).max(MAX_LINES_PER_ORDER),
    promoCode: zPromoCode.optional(),
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

export const quoteResponseSchema = z.object({
  lines: z.array(orderLineResponseSchema),
  subtotalVnd: z.number().int(),
  promoDiscountVnd: z.number().int(),
  pointsDiscountVnd: z.number().int(),
  totalVnd: z.number().int(),
  promoCode: z.string().nullable(),
  pointsEarnable: z.number().int(),
});
export class QuoteResponseDto extends createZodDto(quoteResponseSchema) {}

const orderHistoryEntryResponseSchema = z.object({
  fromStatus: z.string().nullable(),
  toStatus: z.string(),
  actorType: z.string(),
  note: z.string().nullable(),
  createdAt: z.string(),
});

// `Order = Quote & {...}` (api-endpoints-plan §3.1) — `history` is `[]` on a list row.
export const orderResponseSchema = quoteResponseSchema.extend({
  id: zUuidV7,
  orderNo: z.string(),
  status: z.string(),
  note: z.string().nullable(),
  expiresAt: z.string().nullable(),
  paidAt: z.string().nullable(),
  createdAt: z.string(),
  cancelReason: z.string().nullable(),
  cancelNote: z.string().nullable(),
  refundStatus: z.string(),
  pointsEarned: z.number().int(),
  history: z.array(orderHistoryEntryResponseSchema),
});
export class OrderResponseDto extends createZodDto(orderResponseSchema) {}
