import { createZodDto } from '@brewlite/nest-common';
import {
  CATEGORY_NAME_MAX_LENGTH,
  zBooleanParam,
  zLocalizedText,
  zLocalizedTextResponse,
  zUuidV7,
} from '@brewlite/contracts';
import { z } from 'zod';

export const adminCategoryResponseSchema = z.object({
  id: zUuidV7,
  name: zLocalizedTextResponse,
  sortOrder: z.number().int(),
  isActive: z.boolean(),
  deletedAt: z.string().nullable(),
  deletedById: z.string().nullable(),
  createdAt: z.string(),
});
export class AdminCategoryResponseDto extends createZodDto(adminCategoryResponseSchema) {}

export const createCategorySchema = z
  .object({
    name: zLocalizedText(CATEGORY_NAME_MAX_LENGTH),
    sortOrder: z.number().int().min(0).max(32767).optional(),
    isActive: z.boolean().optional(),
  })
  .strict();
export class CreateCategoryDto extends createZodDto(createCategorySchema) {}

export const updateCategorySchema = z
  .object({
    name: zLocalizedText(CATEGORY_NAME_MAX_LENGTH).optional(),
    sortOrder: z.number().int().min(0).max(32767).optional(),
    isActive: z.boolean().optional(),
  })
  .strict();
export class UpdateCategoryDto extends createZodDto(updateCategorySchema) {}

export const listCategoriesQuerySchema = z.object({ deleted: zBooleanParam.optional() }).strict();
export class ListCategoriesQueryDto extends createZodDto(listCategoriesQuerySchema) {}
