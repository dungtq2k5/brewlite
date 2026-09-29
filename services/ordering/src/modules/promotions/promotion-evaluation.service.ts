import { Injectable } from '@nestjs/common';
import { rpcError } from '@brewlite/nest-common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Prisma } from '../../../generated/prisma/client.js';
import { applyPromotion, validatePromotion, type PromotionRule } from './domain/promotion.js';
import { lockPromotion, type LockedPromotionRow } from './domain/lock-promotion.js';

export interface PromotionEvaluation {
  promotionId: string;
  discountVnd: number;
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

  /** Locked and counted — PlaceOrder's step 6, inside the order transaction (§3.3). */
  async evaluateLocked(
    tx: Prisma.TransactionClient,
    code: string,
    subtotalVnd: number,
    userId: string,
    now: Date,
  ): Promise<PromotionEvaluation> {
    const promo = await lockPromotion(tx, code);
    const usesByThisCustomer = promo ? await this.countNonCancelledUses(tx, promo.id, userId) : 0;
    const evaluation = evaluateOrThrow(promo, { subtotalVnd, now, usesByThisCustomer });
    await tx.promotion.update({
      where: { id: evaluation.promotionId },
      data: { usedCount: { increment: 1 } },
    });
    return evaluation;
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
