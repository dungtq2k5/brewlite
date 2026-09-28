import { createZodDto } from '@brewlite/nest-common';
import { z } from 'zod';
import { PRODUCT_SIZES, zLocalizedTextResponse, zUuidV7 } from '@brewlite/contracts';

const zMoney = z.number().int().nonnegative();

export const productSummaryResponseSchema = z.object({
  id: zUuidV7,
  categoryId: zUuidV7,
  name: zLocalizedTextResponse,
  imageUrl: z.string().nullable(),
  fromPriceVnd: zMoney,
  isSoldOut: z.boolean(),
});
export class ProductSummaryResponseDto extends createZodDto(productSummaryResponseSchema) {}

export const productDetailResponseSchema = productSummaryResponseSchema.extend({
  description: zLocalizedTextResponse.nullable(),
  basePriceVnd: zMoney,
  sizes: z.array(z.object({ size: z.enum(PRODUCT_SIZES), priceDeltaVnd: zMoney })),
  toppings: z.array(z.object({ id: zUuidV7, name: zLocalizedTextResponse, priceVnd: zMoney })),
  maxToppings: z.number().int().nonnegative(),
});
export class ProductDetailResponseDto extends createZodDto(productDetailResponseSchema) {}
