import type { Category as CategoryProto } from '@brewlite/contracts/generated/brewlite/catalog/menu_service.js';
import type { Prisma } from '../../../generated/prisma/client.js';

export const CATEGORY_MENU_SELECT = {
  id: true,
  nameEn: true,
  nameVi: true,
} satisfies Prisma.CategorySelect;

export type CategoryMenuRow = Prisma.CategoryGetPayload<{ select: typeof CATEGORY_MENU_SELECT }>;

export function toProtoCategory(row: CategoryMenuRow): CategoryProto {
  return {
    id: row.id,
    name: { en: row.nameEn, vi: row.nameVi },
  };
}
