import { createZodDto } from '@brewlite/nest-common';
import { zBusinessDayRange, zLocalizedTextResponse, zUuidV7 } from '@brewlite/contracts';
import { z } from 'zod';

/** `from`, `to`: business days, inclusive, at most 93 days — anything else is `400 VALIDATION_FAILED`. */
export const salesReportQuerySchema = zBusinessDayRange;
export class SalesReportQueryDto extends createZodDto(salesReportQuerySchema) {}

export const salesReportResponseSchema = z.object({
  days: z.array(
    z.object({ day: z.string(), orders: z.number().int(), revenueVnd: z.number().int() }),
  ),
  topProducts: z.array(
    z.object({
      productId: zUuidV7,
      productName: zLocalizedTextResponse,
      qty: z.number().int(),
      revenueVnd: z.number().int(),
    }),
  ),
});
export class SalesReportResponseDto extends createZodDto(salesReportResponseSchema) {}
