import { createZodDto } from '@brewlite/nest-common';
import { zUuidV7 } from '@brewlite/contracts';
import { z } from 'zod';

export const promotionIdParamSchema = z.object({ id: zUuidV7 }).strict();
export class PromotionIdParamDto extends createZodDto(promotionIdParamSchema) {}
