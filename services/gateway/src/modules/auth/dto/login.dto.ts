import { createZodDto } from '@brewlite/nest-common';
import { z } from 'zod';
import { zEmail } from '@brewlite/contracts';

/**
 * Not `zPassword` — login checks the stored hash, not today's rules; an account made
 * under an older rule must still sign in. The 1024 cap only stops a megabyte body from
 * reaching bcrypt.
 */
export const loginSchema = z
  .object({ email: zEmail, password: z.string().min(1).max(1024) })
  .strict();
export class LoginDto extends createZodDto(loginSchema) {}
