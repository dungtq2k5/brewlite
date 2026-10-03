import { createZodDto } from '@brewlite/nest-common';
import { z } from 'zod';
import {
  FULL_NAME_MAX_LENGTH,
  SUPPORTED_LOCALES,
  zEmail,
  zPassword,
  zText,
} from '@brewlite/contracts';

export const registerSchema = z
  .object({
    email: zEmail,
    password: zPassword,
    fullName: zText(FULL_NAME_MAX_LENGTH),
    preferredLocale: z.enum(SUPPORTED_LOCALES).optional(),
  })
  .strict();
export class RegisterDto extends createZodDto(registerSchema) {}
