import { Injectable } from '@nestjs/common';
import { rpcError } from '@brewlite/nest-common';
import type { DiscountType } from '@brewlite/contracts';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Prisma } from '../../../generated/prisma/client.js';
import { applyPromotion, validatePromotion, type PromotionRule } from './domain/promotion.js';

export interface PromotionEvaluation {
  promotionId: string;
  discountVnd: number;
}

interface LockedPromotionRow {
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

type PromotionQueryClient = Pick<Prisma.TransactionClient, 'promotion' | 'order'>;

function toRule(row: LockedPromotionRow): PromotionRule {
  return {
    discountType: row.discountType,
    discountValue: row.discountValue,
    maxDiscountVnd: row.maxDiscountVnd,
    minSubtotalVnd: row.minSubtotalVnd,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    maxUses: row.maxUses,
    usedCount: row.usedCount,
    perUserLimit: row.perUserLimit,
    isActive: row.isActive,
  };
}

function evaluateOrThrow(
  promo: LockedPromotionRow | null,
  ctx: { subtotalVnd: number; now: Date; usesByThisCustomer: number },
): PromotionEvaluation {
  const rule = promo ? toRule(promo) : null;
  const reason = validatePromotion(rule, ctx);
  if (reason) {
    throw rpcError('PROMO_CODE_INVALID', {
      reason,
      ...(reason === 'MIN_SUBTOTAL' && { minSubtotalVnd: rule!.minSubtotalVnd }),
    });
  }
  return { promotionId: promo!.id, discountVnd: applyPromotion(rule!, ctx.subtotalVnd) };
}

@Injectable()
export class PromotionEvaluationService {
  constructor(private readonly prisma: PrismaService) {}

  /** Read-only — Quote, and PlaceOrder's early step-4 refusal before stock is reserved (api §6.1). */
  async evaluate(
    code: string,
    subtotalVnd: number,
    userId: string,
    now: Date,
  ): Promise<PromotionEvaluation> {
    const promo = await this.prisma.promotion.findFirst({ where: { code, deletedAt: null } });
    const usesByThisCustomer = promo
      ? await this.countNonCancelledUses(this.prisma, promo.id, userId)
      : 0;
    return evaluateOrThrow(promo as LockedPromotionRow | null, {
      subtotalVnd,
      now,
      usesByThisCustomer,
    });
  }

  /** Locked and counted — PlaceOrder's step 6, inside the order transaction. */
  async evaluateLocked(
    tx: Prisma.TransactionClient,
    code: string,
    subtotalVnd: number,
    userId: string,
    now: Date,
  ): Promise<PromotionEvaluation> {
    const promo = await this.lockPromotion(tx, code);
    const usesByThisCustomer = promo ? await this.countNonCancelledUses(tx, promo.id, userId) : 0;
    const evaluation = evaluateOrThrow(promo, { subtotalVnd, now, usesByThisCustomer });
    await tx.promotion.update({
      where: { id: evaluation.promotionId },
      data: { usedCount: { increment: 1 } },
    });
    return evaluation;
  }

  /**
   * Serialises every order using this code — the per-customer limit counts rows in
   * `orders`, which a conditional `UPDATE` alone cannot make exact. Taken first in the
   * caller's transaction, before any insert, so two orders never hold locks in opposite
   * orders. Raw SQL with physical names, so this stays a service method, never `domain/`
   * (conventions §2.1 — no I/O, no Prisma import, there).
   */
  private async lockPromotion(
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

  private async countNonCancelledUses(
    client: PromotionQueryClient,
    promotionId: string,
    userId: string,
  ): Promise<number> {
    return client.order.count({
      where: { userId, promotionId, status: { not: 'CANCELLED' } },
    });
  }
}
