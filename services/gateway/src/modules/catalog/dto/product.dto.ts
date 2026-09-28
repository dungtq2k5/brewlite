import { createZodDto } from '@brewlite/nest-common';
import { z } from 'zod';
import { zUuidV7 } from '@brewlite/contracts';

export const productQuerySchema = z.object({ categoryId: zUuidV7.optional() }).strict();
export class ProductQueryDto extends createZodDto(productQuerySchema) {}

export const productParamSchema = z.object({ id: zUuidV7 }).strict();
export class ProductParamDto extends createZodDto(productParamSchema) {}
