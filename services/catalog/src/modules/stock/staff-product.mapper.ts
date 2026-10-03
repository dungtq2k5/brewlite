import type {
  StaffProduct,
  StaffTopping,
} from '@brewlite/contracts/generated/brewlite/catalog/stock_service.js';
import type { Prisma } from '../../../generated/prisma/client.js';

export const STAFF_PRODUCT_SELECT = {
  id: true,
  categoryId: true,
  nameEn: true,
  nameVi: true,
  isAvailable: true,
  stockQty: true,
  version: true,
} satisfies Prisma.ProductSelect;

export type StaffProductRow = Prisma.ProductGetPayload<{ select: typeof STAFF_PRODUCT_SELECT }>;

export function toProtoStaffProduct(row: StaffProductRow): StaffProduct {
  return {
    id: row.id,
    categoryId: row.categoryId,
    name: { en: row.nameEn, vi: row.nameVi },
    isAvailable: row.isAvailable,
    stockQty: row.stockQty ?? undefined,
    version: row.version,
  };
}

export const STAFF_TOPPING_SELECT = {
  id: true,
  nameEn: true,
  nameVi: true,
  priceVnd: true,
  isAvailable: true,
} satisfies Prisma.ToppingSelect;

export type StaffToppingRow = Prisma.ToppingGetPayload<{ select: typeof STAFF_TOPPING_SELECT }>;

export function toProtoStaffTopping(row: StaffToppingRow): StaffTopping {
  return {
    id: row.id,
    name: { en: row.nameEn, vi: row.nameVi },
    priceVnd: row.priceVnd,
    isAvailable: row.isAvailable,
  };
}
