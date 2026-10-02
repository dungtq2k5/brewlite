import { createZodDto } from '@brewlite/nest-common';
import { z } from 'zod';
import { FULL_NAME_MAX_LENGTH, SUPPORTED_LOCALES, zText } from '@brewlite/contracts';

export const updateMeSchema = z
  .object({
    fullName: zText(FULL_NAME_MAX_LENGTH).optional(),
    preferredLocale: z.enum(SUPPORTED_LOCALES).optional(),
  })
  .strict();
export class UpdateMeDto extends createZodDto(updateMeSchema) {}
