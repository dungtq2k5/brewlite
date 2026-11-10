import { createZodDto } from '@brewlite/nest-common';
import { z } from 'zod';
import { zPassword } from '@brewlite/contracts';

// 8–72 bytes, the registration rule (bcrypt reads at most 72). `currentPassword` is required by
// identity when the account has a password; a Google-only account sets its first one without it.
export const changePasswordSchema = z
  .object({
    currentPassword: zPassword.optional(),
    newPassword: zPassword,
  })
  .strict();
export class ChangePasswordDto extends createZodDto(changePasswordSchema) {}
