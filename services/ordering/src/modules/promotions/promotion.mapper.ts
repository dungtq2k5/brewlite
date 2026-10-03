import type { Promotion } from '@brewlite/contracts/generated/brewlite/ordering/promotion_service.js';
import type { Prisma } from '../../../generated/prisma/client.js';

export const PROMOTION_SELECT = {
  id: true,
  code: true,
  description: true,
  discountType: true,
  discountValue: true,
  maxDiscountVnd: true,
  minSubtotalVnd: true,
  startsAt: true,
  endsAt: true,
  maxUses: true,
  usedCount: true,
  perUserLimit: true,
  isActive: true,
  deletedAt: true,
  deletedById: true,
  createdAt: true,
} satisfies Prisma.PromotionSelect;

export type PromotionRow = Prisma.PromotionGetPayload<{ select: typeof PROMOTION_SELECT }>;

export function toProtoPromotion(row: PromotionRow): Promotion {
  return {
    id: row.id,
    code: row.code,
    description: row.description ?? undefined,
    discountType: row.discountType,
    discountValue: row.discountValue,
    maxDiscountVnd: row.maxDiscountVnd ?? undefined,
    minSubtotalVnd: row.minSubtotalVnd,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    maxUses: row.maxUses ?? undefined,
    usedCount: row.usedCount,
    perUserLimit: row.perUserLimit ?? undefined,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
  };
}
