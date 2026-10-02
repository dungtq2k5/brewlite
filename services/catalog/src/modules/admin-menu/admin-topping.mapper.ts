import type { AdminTopping } from '@brewlite/contracts/generated/brewlite/catalog/admin_menu_service.js';
import type { Prisma } from '../../../generated/prisma/client.js';

export const ADMIN_TOPPING_SELECT = {
  id: true,
  nameEn: true,
  nameVi: true,
  priceVnd: true,
  isAvailable: true,
  deletedAt: true,
  deletedById: true,
  createdAt: true,
} satisfies Prisma.ToppingSelect;

export type AdminToppingRow = Prisma.ToppingGetPayload<{ select: typeof ADMIN_TOPPING_SELECT }>;

export function toProtoAdminTopping(row: AdminToppingRow): AdminTopping {
  return {
    id: row.id,
    name: { en: row.nameEn, vi: row.nameVi },
    priceVnd: row.priceVnd,
    isAvailable: row.isAvailable,
    deletedAt: row.deletedAt?.toISOString(),
    deletedById: row.deletedById ?? undefined,
    createdAt: row.createdAt.toISOString(),
  };
}
