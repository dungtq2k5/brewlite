import { createZodDto } from '@brewlite/nest-common';
import { LOCK_REASON_MAX_LENGTH, zText } from '@brewlite/contracts';
import { z } from 'zod';

export const lockUserSchema = z
  .object({ reason: zText(LOCK_REASON_MAX_LENGTH), lockedUntil: z.iso.datetime().optional() })
  .strict();
export class LockUserDto extends createZodDto(lockUserSchema) {}
