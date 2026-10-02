import { createZodDto } from '@brewlite/nest-common';
import { z } from 'zod';
import { meResponseSchema } from '../../users/dto/me-response.dto.js';

export const sessionResponseSchema = z.object({
  user: meResponseSchema,
  accessToken: z.string(),
  accessTokenExpiresAt: z.string(),
  refreshToken: z.string(),
  refreshTokenExpiresAt: z.string(),
});
export class SessionResponseDto extends createZodDto(sessionResponseSchema) {}

export const refreshResponseSchema = z.object({
  accessToken: z.string(),
  accessTokenExpiresAt: z.string(),
});
export class RefreshResponseDto extends createZodDto(refreshResponseSchema) {}
