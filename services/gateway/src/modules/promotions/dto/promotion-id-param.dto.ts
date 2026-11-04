import { createZodDto } from '@brewlite/nest-common';
import { z } from 'zod';

/**
 * Some seeded and legacy promotion rows are UUIDv4, so this route accepts any UUID
 * shape; new promotions still get a UUIDv7 from `newId()`.
 */
export const promotionIdParamSchema = z.object({ id: z.string().uuid() }).strict();
export class PromotionIdParamDto extends createZodDto(promotionIdParamSchema) {}
