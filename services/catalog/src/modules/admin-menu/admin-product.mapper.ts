import { PRODUCT_SIZES } from '@brewlite/contracts';
import type {
  AdminProduct,
  AdminProductListItem,
} from '@brewlite/contracts/generated/brewlite/catalog/admin_menu_service.js';
import type { Prisma } from '../../../generated/prisma/client.js';

export const ADMIN_PRODUCT_LIST_SELECT = {
  id: true,
  categoryId: true,
  category: { select: { nameEn: true, nameVi: true } },
  nameEn: true,
  nameVi: true,
  basePriceVnd: true,
  imagePath: true,
  isAvailable: true,
  stockQty: true,
  version: true,
  sortOrder: true,
  createdAt: true,
  deletedAt: true,
} satisfies Prisma.ProductSelect;

export type AdminProductListRow = Prisma.ProductGetPayload<{
  select: typeof ADMIN_PRODUCT_LIST_SELECT;
}>;

/** `imageUrl` is built by the caller (`domain/image-url.ts`, which needs config) and passed in. */
export function toProtoAdminProductListItem(
  row: AdminProductListRow,
  imageUrl: string | undefined,
): AdminProductListItem {
  return {
    id: row.id,
    categoryId: row.categoryId,
    categoryNameEn: row.category.nameEn,
    categoryNameVi: row.category.nameVi,
    name: { en: row.nameEn, vi: row.nameVi },
    basePriceVnd: row.basePriceVnd,
    imageUrl,
    isAvailable: row.isAvailable,
    stockQty: row.stockQty ?? undefined,
    version: row.version,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
    deletedAt: row.deletedAt?.toISOString(),
  };
}

export const ADMIN_PRODUCT_SELECT = {
  id: true,
  categoryId: true,
  category: { select: { nameEn: true, nameVi: true } },
  nameEn: true,
  nameVi: true,
  descriptionEn: true,
  descriptionVi: true,
  basePriceVnd: true,
  imagePath: true,
  isAvailable: true,
  stockQty: true,
  version: true,
  sortOrder: true,
  sizes: { select: { size: true, priceDeltaVnd: true } },
  toppings: { select: { toppingId: true } },
  createdAt: true,
  deletedAt: true,
  deletedById: true,
} satisfies Prisma.ProductSelect;

export type AdminProductRow = Prisma.ProductGetPayload<{ select: typeof ADMIN_PRODUCT_SELECT }>;

export function toProtoAdminProduct(
  row: AdminProductRow,
  imageUrl: string | undefined,
): AdminProduct {
  return {
    id: row.id,
    categoryId: row.categoryId,
    categoryNameEn: row.category.nameEn,
    categoryNameVi: row.category.nameVi,
    name: { en: row.nameEn, vi: row.nameVi },
    description:
      row.descriptionEn === null || row.descriptionVi === null
        ? undefined
        : { en: row.descriptionEn, vi: row.descriptionVi },
    basePriceVnd: row.basePriceVnd,
    imageUrl,
    isAvailable: row.isAvailable,
    stockQty: row.stockQty ?? undefined,
    version: row.version,
    sortOrder: row.sortOrder,
    sizes: [...row.sizes]
      .sort(
        (a, b) =>
          PRODUCT_SIZES.indexOf(a.size as (typeof PRODUCT_SIZES)[number]) -
          PRODUCT_SIZES.indexOf(b.size as (typeof PRODUCT_SIZES)[number]),
      )
      .map((size) => ({ size: size.size, priceDeltaVnd: size.priceDeltaVnd })),
    toppingIds: row.toppings.map((t) => t.toppingId),
    createdAt: row.createdAt.toISOString(),
    deletedAt: row.deletedAt?.toISOString(),
    deletedById: row.deletedById ?? undefined,
  };
}
