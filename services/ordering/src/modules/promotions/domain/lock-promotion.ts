import type { DiscountType } from '@brewlite/contracts';
import type { Prisma } from '../../../../generated/prisma/client.js';

export interface LockedPromotionRow {
  id: string;
  discountType: DiscountType;
  discountValue: number;
  maxDiscountVnd: number | null;
  minSubtotalVnd: number;
  startsAt: Date;
  endsAt: Date;
  maxUses: number | null;
  usedCount: number;
  perUserLimit: number | null;
  isActive: boolean;
}

/**
 * Serialises every order using this code — the per-customer limit counts rows in
 * `orders`, which a conditional `UPDATE` alone cannot make exact (§3.3). Taken first in
 * the transaction, before any insert, so two orders never hold locks in opposite orders.
 */
export async function lockPromotion(
  tx: Prisma.TransactionClient,
  code: string,
): Promise<LockedPromotionRow | null> {
  const rows = await tx.$queryRaw<LockedPromotionRow[]>`
    SELECT
      id,
      discount_type AS "discountType",
      discount_value AS "discountValue",
      max_discount_vnd AS "maxDiscountVnd",
      min_subtotal_vnd AS "minSubtotalVnd",
      starts_at AS "startsAt",
      ends_at AS "endsAt",
      max_uses AS "maxUses",
      used_count AS "usedCount",
      per_user_limit AS "perUserLimit",
      is_active AS "isActive"
    FROM promotions
    WHERE code = ${code} AND deleted_at IS NULL
    FOR UPDATE
  `;
  return rows[0] ?? null;
}
