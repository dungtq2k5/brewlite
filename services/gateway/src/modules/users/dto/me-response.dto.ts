import { createZodDto } from '@brewlite/nest-common';
import { z } from 'zod';
import { PERMISSIONS, SUPPORTED_LOCALES, zEmail, zUuidV7 } from '@brewlite/contracts';

export const meResponseSchema = z.object({
  id: zUuidV7,
  email: zEmail,
  fullName: z.string(),
  role: z.enum(['CUSTOMER', 'STAFF', 'ADMIN']),
  permissions: z.array(z.enum(PERMISSIONS)),
  hasPassword: z.boolean(),
  preferredLocale: z.enum(SUPPORTED_LOCALES),
  createdAt: z.string(),
});
export class MeResponseDto extends createZodDto(meResponseSchema) {}
