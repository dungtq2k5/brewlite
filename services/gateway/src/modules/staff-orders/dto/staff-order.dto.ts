import { createZodDto } from '@brewlite/nest-common';
import { CANCEL_NOTE_MAX_LENGTH, STAFF_BOARD_STATUSES, zText, zUuidV7 } from '@brewlite/contracts';
import { z } from 'zod';

export const listBoardQuerySchema = z
  .object({ status: z.enum(STAFF_BOARD_STATUSES).optional() })
  .strict();
export class ListBoardQueryDto extends createZodDto(listBoardQuerySchema) {}

export const advanceStatusSchema = z
  .object({ to: z.enum(['PREPARING', 'READY', 'COMPLETED']) })
  .strict();
export class AdvanceStatusDto extends createZodDto(advanceStatusSchema) {}

export const cancelPaidSchema = z.object({ note: zText(CANCEL_NOTE_MAX_LENGTH) }).strict();
export class CancelPaidDto extends createZodDto(cancelPaidSchema) {}

export const staffOrderIdParamSchema = z.object({ id: zUuidV7 }).strict();
export class StaffOrderIdParamDto extends createZodDto(staffOrderIdParamSchema) {}
