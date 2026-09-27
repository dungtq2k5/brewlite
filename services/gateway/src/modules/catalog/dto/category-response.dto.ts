import { createZodDto } from '@brewlite/nest-common';
import { z } from 'zod';
import { zLocalizedTextResponse, zUuidV7 } from '@brewlite/contracts';

export const categoryResponseSchema = z.object({
  id: zUuidV7,
  name: zLocalizedTextResponse,
});

export class CategoryResponseDto extends createZodDto(categoryResponseSchema) {}
