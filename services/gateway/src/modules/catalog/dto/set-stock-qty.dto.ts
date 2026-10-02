import { createZodDto } from '@brewlite/nest-common';
import { z } from 'zod';

export const setStockQtySchema = z
  .object({
    stockQty: z.number().int().min(0).max(2147483647).nullable(),
    expectedVersion: z.number().int(),
  })
  .strict();
export class SetStockQtyDto extends createZodDto(setStockQtySchema) {}
