import type { AdminCategory } from '@brewlite/contracts/generated/brewlite/catalog/admin_menu_service.js';
import type { Prisma } from '../../../generated/prisma/client.js';

export const ADMIN_CATEGORY_SELECT = {
  id: true,
  nameEn: true,
  nameVi: true,
  sortOrder: true,
  isActive: true,
  deletedAt: true,
  deletedById: true,
  createdAt: true,
} satisfies Prisma.CategorySelect;

export type AdminCategoryRow = Prisma.CategoryGetPayload<{ select: typeof ADMIN_CATEGORY_SELECT }>;

export function toProtoAdminCategory(row: AdminCategoryRow): AdminCategory {
  return {
    id: row.id,
    name: { en: row.nameEn, vi: row.nameVi },
    sortOrder: row.sortOrder,
    isActive: row.isActive,
    deletedAt: row.deletedAt?.toISOString(),
    deletedById: row.deletedById ?? undefined,
    createdAt: row.createdAt.toISOString(),
  };
}
