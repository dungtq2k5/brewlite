import { createZodDto } from '@brewlite/nest-common';
import {
  DISCOUNT_TYPES,
  MAX_PRICE_VND,
  PROMO_CODE_PATTERN,
  PROMO_DESCRIPTION_MAX_LENGTH,
  zBooleanParam,
  zPageQuery,
  zText,
} from '@brewlite/contracts';
import { z } from 'zod';

const zMoney = z.number().int().nonnegative();
const zPromoCode = z
  .string()
  .transform((s) => s.trim().toUpperCase())
  .pipe(z.string().regex(PROMO_CODE_PATTERN));

export const listPromotionsQuerySchema = zPageQuery(['createdAt', 'code', 'endsAt'], '-createdAt')
  .extend({
    active: zBooleanParam.optional(),
    deleted: zBooleanParam.optional(),
    q: zText(32).optional(),
  })
  .strict();
export class ListPromotionsQueryDto extends createZodDto(listPromotionsQuerySchema) {}

export const createPromotionSchema = z
  .object({
    code: zPromoCode,
    description: zText(PROMO_DESCRIPTION_MAX_LENGTH).optional(),
    discountType: z.enum(DISCOUNT_TYPES),
    discountValue: z.number().int().min(1).max(MAX_PRICE_VND),
    maxDiscountVnd: zMoney.optional(),
    minSubtotalVnd: zMoney.default(0),
    startsAt: z.iso.datetime(),
    endsAt: z.iso.datetime(),
    maxUses: z.number().int().nonnegative().optional(),
    perUserLimit: z.number().int().nonnegative().optional(),
    isActive: z.boolean().optional(),
  })
  .strict();
export class CreatePromotionDto extends createZodDto(createPromotionSchema) {}

export const updatePromotionSchema = z
  .object({
    description: zText(PROMO_DESCRIPTION_MAX_LENGTH).optional(),
    clearDescription: z.boolean().optional(),
    endsAt: z.iso.datetime().optional(),
    maxUses: z.number().int().nonnegative().optional(),
    perUserLimit: z.number().int().nonnegative().optional(),
    isActive: z.boolean().optional(),
  })
  .strict();
export class UpdatePromotionDto extends createZodDto(updatePromotionSchema) {}

export const promotionResponseSchema = z.object({
  id: z.string(),
  code: z.string(),
  description: z.string().nullable(),
  discountType: z.enum(DISCOUNT_TYPES),
  discountValue: z.number(),
  maxDiscountVnd: zMoney.nullable(),
  minSubtotalVnd: zMoney,
  startsAt: z.string(),
  endsAt: z.string(),
  maxUses: z.number().nullable(),
  usedCount: z.number(),
  perUserLimit: z.number().nullable(),
  isActive: z.boolean(),
  createdAt: z.string(),
});
export class PromotionResponseDto extends createZodDto(promotionResponseSchema) {}
