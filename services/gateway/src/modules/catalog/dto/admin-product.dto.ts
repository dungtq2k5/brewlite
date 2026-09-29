import { createZodDto } from '@brewlite/nest-common';
import {
  MAX_ADMIN_TOPPINGS,
  MAX_PRICE_VND,
  PRODUCT_DESCRIPTION_MAX_LENGTH,
  PRODUCT_NAME_MAX_LENGTH,
  PRODUCT_SIZES,
  zBooleanParam,
  zLocalizedText,
  zLocalizedTextResponse,
  zPageQuery,
  zUuidV7,
} from '@brewlite/contracts';
import { z } from 'zod';

const zStockQty = z.number().int().min(0).max(2147483647).nullable();
const zSortOrder = z.number().int().min(0).max(32767);
const zBasePriceVnd = z.number().int().min(0).max(MAX_PRICE_VND);

const zSizes = z
  .array(z.object({ size: z.enum(PRODUCT_SIZES), priceDeltaVnd: zBasePriceVnd }).strict())
  .min(1)
  .max(3)
  .refine((sizes) => new Set(sizes.map((s) => s.size)).size === sizes.length, {
    message: 'a size cannot repeat',
  });

const zToppingIds = z
  .array(zUuidV7)
  .max(MAX_ADMIN_TOPPINGS)
  .refine((ids) => new Set(ids).size === ids.length, { message: 'a topping cannot repeat' });

export const adminProductListItemSchema = z.object({
  id: zUuidV7,
  categoryId: zUuidV7,
  categoryName: zLocalizedTextResponse,
  name: zLocalizedTextResponse,
  basePriceVnd: z.number().int(),
  imageUrl: z.string().nullable(),
  isAvailable: z.boolean(),
  stockQty: z.number().int().nullable(),
  version: z.number().int(),
  sortOrder: z.number().int(),
  createdAt: z.string(),
  deletedAt: z.string().nullable(),
});
export class AdminProductListItemResponseDto extends createZodDto(adminProductListItemSchema) {}

export const adminProductResponseSchema = z.object({
  id: zUuidV7,
  categoryId: zUuidV7,
  categoryName: zLocalizedTextResponse,
  name: zLocalizedTextResponse,
  description: zLocalizedTextResponse.nullable(),
  basePriceVnd: z.number().int(),
  imageUrl: z.string().nullable(),
  isAvailable: z.boolean(),
  stockQty: z.number().int().nullable(),
  version: z.number().int(),
  sortOrder: z.number().int(),
  sizes: z.array(z.object({ size: z.enum(PRODUCT_SIZES), priceDeltaVnd: z.number().int() })),
  toppingIds: z.array(zUuidV7),
  createdAt: z.string(),
  deletedAt: z.string().nullable(),
  deletedById: z.string().nullable(),
});
export class AdminProductResponseDto extends createZodDto(adminProductResponseSchema) {}

export const listAdminProductsQuerySchema = zPageQuery(
  ['sortOrder', 'nameEn', 'createdAt', 'basePriceVnd'],
  'sortOrder',
)
  .extend({
    q: z.string().min(1).max(100).optional(),
    categoryId: zUuidV7.optional(),
    deleted: zBooleanParam.optional(),
  })
  .strict();
export class ListAdminProductsQueryDto extends createZodDto(listAdminProductsQuerySchema) {}

export const createProductSchema = z
  .object({
    categoryId: zUuidV7,
    name: zLocalizedText(PRODUCT_NAME_MAX_LENGTH),
    description: zLocalizedText(PRODUCT_DESCRIPTION_MAX_LENGTH).optional(),
    basePriceVnd: zBasePriceVnd,
    sizes: zSizes,
    toppingIds: zToppingIds,
    stockQty: zStockQty.optional(),
    sortOrder: zSortOrder.optional(),
  })
  .strict();
export class CreateProductDto extends createZodDto(createProductSchema) {}

export const updateProductSchema = z
  .object({
    categoryId: zUuidV7.optional(),
    name: zLocalizedText(PRODUCT_NAME_MAX_LENGTH).optional(),
    description: zLocalizedText(PRODUCT_DESCRIPTION_MAX_LENGTH).nullable().optional(),
    basePriceVnd: zBasePriceVnd.optional(),
    sortOrder: zSortOrder.optional(),
  })
  .strict();
export class UpdateProductDto extends createZodDto(updateProductSchema) {}

export const replaceSizesSchema = z.object({ sizes: zSizes }).strict();
export class ReplaceSizesDto extends createZodDto(replaceSizesSchema) {}

export const replaceToppingsSchema = z.object({ toppingIds: zToppingIds }).strict();
export class ReplaceToppingsDto extends createZodDto(replaceToppingsSchema) {}

export const setProductImageResponseSchema = z.object({ imageUrl: z.string().nullable() });
export class SetProductImageResponseDto extends createZodDto(setProductImageResponseSchema) {}
