import { createZodDto } from '@brewlite/nest-common';
import { z } from 'zod';
import { zLocalizedTextResponse, zUuidV7 } from '@brewlite/contracts';

export const staffProductResponseSchema = z.object({
  id: zUuidV7,
  categoryId: zUuidV7,
  name: zLocalizedTextResponse,
  isAvailable: z.boolean(),
  stockQty: z.number().int().nullable(),
  version: z.number().int(),
});
export class StaffProductResponseDto extends createZodDto(staffProductResponseSchema) {}

export const staffToppingResponseSchema = z.object({
  id: zUuidV7,
  name: zLocalizedTextResponse,
  priceVnd: z.number().int(),
  isAvailable: z.boolean(),
});
export class StaffToppingResponseDto extends createZodDto(staffToppingResponseSchema) {}
