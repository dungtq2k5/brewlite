import { MAX_TOPPINGS_PER_LINE, PRODUCT_SIZES } from '@brewlite/contracts';
import type {
  ProductDetail,
  ProductSummary,
} from '@brewlite/contracts/generated/brewlite/catalog/menu_service.js';
import type { Prisma } from '../../../generated/prisma/client.js';

export const PRODUCT_SUMMARY_SELECT = {
  id: true,
  categoryId: true,
  nameEn: true,
  nameVi: true,
  basePriceVnd: true,
  isAvailable: true,
  stockQty: true,
  sizes: { select: { priceDeltaVnd: true } },
} satisfies Prisma.ProductSelect;

export type ProductSummaryRow = Prisma.ProductGetPayload<{ select: typeof PRODUCT_SUMMARY_SELECT }>;

export const PRODUCT_DETAIL_SELECT = {
  ...PRODUCT_SUMMARY_SELECT,
  descriptionEn: true,
  descriptionVi: true,
  sizes: { select: { size: true, priceDeltaVnd: true } },
  toppings: {
    where: { topping: { deletedAt: null, isAvailable: true } },
    select: { topping: { select: { id: true, nameEn: true, nameVi: true, priceVnd: true } } },
  },
} satisfies Prisma.ProductSelect;

export type ProductDetailRow = Prisma.ProductGetPayload<{ select: typeof PRODUCT_DETAIL_SELECT }>;

function isSoldOut(row: { isAvailable: boolean; stockQty: number | null }): boolean {
  return !row.isAvailable || row.stockQty === 0;
}

function fromPriceVnd(row: { basePriceVnd: number; sizes: { priceDeltaVnd: number }[] }): number {
  const minDelta = Math.min(...row.sizes.map((size) => size.priceDeltaVnd));
  return row.basePriceVnd + minDelta;
}

export function toProtoProductSummary(row: ProductSummaryRow): ProductSummary {
  return {
    id: row.id,
    categoryId: row.categoryId,
    name: { en: row.nameEn, vi: row.nameVi },
    imageUrl: undefined,
    fromPriceVnd: fromPriceVnd(row),
    isSoldOut: isSoldOut(row),
  };
}

export function toProtoProductDetail(row: ProductDetailRow): ProductDetail {
  return {
    summary: toProtoProductSummary(row),
    description:
      row.descriptionEn === null || row.descriptionVi === null
        ? undefined
        : { en: row.descriptionEn, vi: row.descriptionVi },
    basePriceVnd: row.basePriceVnd,
    sizes: [...row.sizes]
      .sort(
        (a, b) =>
          PRODUCT_SIZES.indexOf(a.size as (typeof PRODUCT_SIZES)[number]) -
          PRODUCT_SIZES.indexOf(b.size as (typeof PRODUCT_SIZES)[number]),
      )
      .map((size) => ({ size: size.size, priceDeltaVnd: size.priceDeltaVnd })),
    toppings: row.toppings.map(({ topping }) => ({
      id: topping.id,
      name: { en: topping.nameEn, vi: topping.nameVi },
      priceVnd: topping.priceVnd,
    })),
    maxToppings: MAX_TOPPINGS_PER_LINE,
  };
}
