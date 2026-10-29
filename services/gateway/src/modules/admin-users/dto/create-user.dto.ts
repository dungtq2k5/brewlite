import { createZodDto } from '@brewlite/nest-common';
import {
  FULL_NAME_MAX_LENGTH,
  ROLES,
  SUPPORTED_LOCALES,
  zEmail,
  zPassword,
  zText,
} from '@brewlite/contracts';
import { z } from 'zod';

export const createUserSchema = z
  .object({
    email: zEmail,
    password: zPassword,
    fullName: zText(FULL_NAME_MAX_LENGTH),
    role: z.enum(ROLES),
    preferredLocale: z.enum(SUPPORTED_LOCALES).optional(),
  })
  .strict();
export class CreateUserDto extends createZodDto(createUserSchema) {}
