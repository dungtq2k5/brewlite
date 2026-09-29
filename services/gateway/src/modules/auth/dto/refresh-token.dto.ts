import { createZodDto } from '@brewlite/nest-common';
import { z } from 'zod';

export const refreshTokenSchema = z.object({ refreshToken: z.string().min(1).max(256) }).strict();
export class RefreshTokenDto extends createZodDto(refreshTokenSchema) {}
