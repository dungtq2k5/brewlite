import { createZodDto } from '@brewlite/nest-common';
import { zBusinessDay, zBusinessDayRange } from '@brewlite/contracts';
import { z } from 'zod';

/** `from`, `to`: business days, inclusive, at most 93 days — anything else is `400 VALIDATION_FAILED`. */
export class StaffStatsQueryDto extends createZodDto(zBusinessDayRange) {}

export const staffStatsResponseSchema = z.object({
  from: zBusinessDay,
  to: zBusinessDay,
  /** Distinct orders the user moved — one that went `PREPARING` → `READY` counts once. */
  ordersHandled: z.number().int(),
  transitions: z.object({
    PREPARING: z.number().int(),
    READY: z.number().int(),
    COMPLETED: z.number().int(),
    CANCELLED: z.number().int(),
  }),
});
export class StaffStatsResponseDto extends createZodDto(staffStatsResponseSchema) {}
