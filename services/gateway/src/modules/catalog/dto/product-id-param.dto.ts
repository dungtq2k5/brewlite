import { createZodDto } from '@brewlite/nest-common';
import { zUuidV7 } from '@brewlite/contracts';
import { z } from 'zod';

export const productIdParamSchema = z.object({ id: zUuidV7 }).strict();
export class ProductIdParamDto extends createZodDto(productIdParamSchema) {}
