import { Injectable } from '@nestjs/common';
import { LoyaltyKind, newId, pointsEarnable } from '@brewlite/contracts';
import { isUniqueConstraintViolation } from '@brewlite/nest-common';
import type { GetMyLoyaltyResponse } from '@brewlite/contracts/generated/brewlite/ordering/promotion_service.js';
import type { Prisma } from '../../../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

const RECENT_LIMIT = 20;

export interface EarnableOrder {
  id: string;
  userId: string;
  totalVnd: number;
}

export interface CancellableOrder {
  id: string;
  userId: string;
}

/** Every method takes `tx` first and never uses `this.prisma` (conventions §2.1). */
@Injectable()
export class LoyaltyService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Called by the transaction that makes an order `PAID` (doc 06). Idempotent by
   * `UNIQUE (order_id, kind)` — a redelivered event earns once.
   */
  async earn(tx: Prisma.TransactionClient, order: EarnableOrder): Promise<void> {
    const points = pointsEarnable(order.totalVnd);
    if (points <= 0) return; // loyalty_transactions_points_ck refuses points = 0 anyway

    try {
      await tx.loyaltyTransaction.create({
        data: {
          id: newId(),
          userId: order.userId,
          orderId: order.id,
          kind: LoyaltyKind.EARN,
          points,
        },
      });
    } catch (error) {
      if (isUniqueConstraintViolation(error, 'loyalty_transactions_order_id_kind_key')) return;
      throw error;
    }

    await tx.loyaltyAccount.upsert({
      where: { userId: order.userId },
      create: { userId: order.userId, balance: points, lifetimeEarned: points },
      update: { balance: { increment: points }, lifetimeEarned: { increment: points } },
    });
    await tx.order.update({ where: { id: order.id }, data: { pointsEarned: points } });
  }

  /**
   * Called from `transition()` on every cancel — a no-op until an order has actually
   * earned (i.e. until 06 exists). `lifetime_earned` is not reduced — it counts what was
   * ever earned.
   */
  async reverse(tx: Prisma.TransactionClient, order: CancellableOrder): Promise<void> {
    const earned = await tx.loyaltyTransaction.findUnique({
      where: { orderId_kind: { orderId: order.id, kind: LoyaltyKind.EARN } },
    });
    if (!earned) return;

    try {
      await tx.loyaltyTransaction.create({
        data: {
          id: newId(),
          userId: order.userId,
          orderId: order.id,
          kind: LoyaltyKind.EARN_REVERSED,
          points: -earned.points,
        },
      });
    } catch (error) {
      if (isUniqueConstraintViolation(error, 'loyalty_transactions_order_id_kind_key')) return;
      throw error;
    }

    await tx.loyaltyAccount.update({
      where: { userId: order.userId },
      data: { balance: { decrement: earned.points } },
    });
  }

  async getMyLoyalty(userId: string): Promise<GetMyLoyaltyResponse> {
    const [account, recent] = await Promise.all([
      this.prisma.loyaltyAccount.findUnique({ where: { userId } }),
      this.prisma.loyaltyTransaction.findMany({
        where: { userId },
        orderBy: { id: 'desc' },
        take: RECENT_LIMIT,
        include: { order: { select: { orderNo: true } } },
      }),
    ]);

    return {
      balance: account?.balance ?? 0,
      lifetimeEarned: account?.lifetimeEarned ?? 0,
      recent: recent.map((row) => ({
        orderId: row.orderId,
        orderNo: row.order.orderNo.toString(),
        kind: row.kind,
        points: row.points,
        at: row.createdAt.toISOString(),
      })),
    };
  }
}
