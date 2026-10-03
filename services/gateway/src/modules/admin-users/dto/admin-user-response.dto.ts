import { createZodDto } from '@brewlite/nest-common';
import { z } from 'zod';
import { PERMISSIONS, ROLES, SUPPORTED_LOCALES, zEmail, zUuidV7 } from '@brewlite/contracts';

export const adminUserResponseSchema = z.object({
  id: zUuidV7,
  email: zEmail,
  fullName: z.string(),
  role: z.enum(ROLES),
  permissions: z.array(z.enum(PERMISSIONS)),
  hasPassword: z.boolean(),
  preferredLocale: z.enum(SUPPORTED_LOCALES),
  createdAt: z.string(),
  isLocked: z.boolean(),
  lockedUntil: z.string().nullable(),
  lockReason: z.string().nullable(),
  deletedAt: z.string().nullable(),
  deletedById: z.string().nullable(),
  lastLoginAt: z.string().nullable(),
});
export class AdminUserResponseDto extends createZodDto(adminUserResponseSchema) {}
