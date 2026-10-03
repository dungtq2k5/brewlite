import { createZodDto } from '@brewlite/nest-common';
import {
  MAX_PRICE_VND,
  TOPPING_NAME_MAX_LENGTH,
  zBooleanParam,
  zLocalizedText,
  zLocalizedTextResponse,
  zUuidV7,
} from '@brewlite/contracts';
import { z } from 'zod';

export const adminToppingResponseSchema = z.object({
  id: zUuidV7,
  name: zLocalizedTextResponse,
  priceVnd: z.number().int(),
  isAvailable: z.boolean(),
  deletedAt: z.string().nullable(),
  deletedById: z.string().nullable(),
  createdAt: z.string(),
});
export class AdminToppingResponseDto extends createZodDto(adminToppingResponseSchema) {}

export const createToppingSchema = z
  .object({
    name: zLocalizedText(TOPPING_NAME_MAX_LENGTH),
    priceVnd: z.number().int().min(0).max(MAX_PRICE_VND),
  })
  .strict();
export class CreateToppingDto extends createZodDto(createToppingSchema) {}

export const updateToppingSchema = z
  .object({
    name: zLocalizedText(TOPPING_NAME_MAX_LENGTH).optional(),
    priceVnd: z.number().int().min(0).max(MAX_PRICE_VND).optional(),
    isAvailable: z.boolean().optional(),
  })
  .strict();
export class UpdateToppingDto extends createZodDto(updateToppingSchema) {}

export const listToppingsQuerySchema = z.object({ deleted: zBooleanParam.optional() }).strict();
export class ListToppingsQueryDto extends createZodDto(listToppingsQuerySchema) {}
