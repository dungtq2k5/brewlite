import { Injectable } from '@nestjs/common';
import { LoyaltyKind, newId, pointsEarnable } from '@brewlite/contracts';
import { isUniqueConstraintViolation } from '@brewlite/nest-common';
import type {
  GetLoyaltyForUserResponse,
  GetMyLoyaltyResponse,
} from '@brewlite/contracts/generated/brewlite/ordering/promotion_service.js';
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
   * Called by the transaction that makes an order `PAID`. Idempotent by
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

  /** The balance now, without a lock — what a quote and the placing pre-check read (no row → 0). */
  async balanceOf(userId: string): Promise<number> {
    const account = await this.prisma.loyaltyAccount.findUnique({
      where: { userId },
      select: { balance: true },
    });
    return account?.balance ?? 0;
  }

  /**
   * The balance under a row lock, for a transaction that will change it (no row → 0, nothing to
   * lock). Lock order is always promotion row → loyalty account row (rdm-spec O-5).
   */
  async lockedBalance(tx: Prisma.TransactionClient, userId: string): Promise<number> {
    const rows = await tx.$queryRaw<{ balance: number }[]>`
      SELECT balance FROM loyalty_accounts WHERE user_id = ${userId}::uuid FOR UPDATE`;
    return rows[0]?.balance ?? 0;
  }

  /** Spends `points` on an order being placed: one `REDEEM` row, the balance down. The caller locked the account. */
  async spend(
    tx: Prisma.TransactionClient,
    order: CancellableOrder,
    points: number,
  ): Promise<void> {
    if (points <= 0) return;
    await tx.loyaltyTransaction.create({
      data: {
        id: newId(),
        userId: order.userId,
        orderId: order.id,
        kind: LoyaltyKind.REDEEM,
        points: -points,
      },
    });
    await tx.loyaltyAccount.update({
      where: { userId: order.userId },
      data: { balance: { decrement: points } },
    });
  }

  /**
   * Called from `transition()` on every cancel, before `reverse()`: the points the order spent
   * come back whole (ADR 0035). Once, by `UNIQUE (order_id, kind)`.
   */
  async returnRedeemed(tx: Prisma.TransactionClient, order: CancellableOrder): Promise<void> {
    const redeemed = await tx.loyaltyTransaction.findUnique({
      where: { orderId_kind: { orderId: order.id, kind: LoyaltyKind.REDEEM } },
    });
    if (!redeemed) return;
    const points = Math.abs(redeemed.points);

    try {
      await tx.loyaltyTransaction.create({
        data: {
          id: newId(),
          userId: order.userId,
          orderId: order.id,
          kind: LoyaltyKind.REDEEM_RETURNED,
          points,
        },
      });
    } catch (error) {
      if (isUniqueConstraintViolation(error, 'loyalty_transactions_order_id_kind_key')) return;
      throw error;
    }

    await tx.loyaltyAccount.update({
      where: { userId: order.userId },
      data: { balance: { increment: points } },
    });
  }

  /**
   * Called from `transition()` on every cancel, after `returnRedeemed()`. Removes
   * `min(earned, balance)` under the account lock — the shortfall is forgiven and the row
   * records what was actually removed (ADR 0035); nothing removed → no row (`points <> 0`).
   * `lifetime_earned` is not reduced — it counts what was ever earned.
   */
  async reverse(tx: Prisma.TransactionClient, order: CancellableOrder): Promise<void> {
    const earned = await tx.loyaltyTransaction.findUnique({
      where: { orderId_kind: { orderId: order.id, kind: LoyaltyKind.EARN } },
    });
    if (!earned) return;

    const balance = await this.lockedBalance(tx, order.userId);
    const removed = Math.min(earned.points, balance);
    if (removed <= 0) return;

    try {
      await tx.loyaltyTransaction.create({
        data: {
          id: newId(),
          userId: order.userId,
          orderId: order.id,
          kind: LoyaltyKind.EARN_REVERSED,
          points: -removed,
        },
      });
    } catch (error) {
      if (isUniqueConstraintViolation(error, 'loyalty_transactions_order_id_kind_key')) return;
      throw error;
    }

    await tx.loyaltyAccount.update({
      where: { userId: order.userId },
      data: { balance: { decrement: removed } },
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

  /** The same ledger for any user (an admin's view); a user with no rows has zeros, as above. */
  getLoyaltyForUser(userId: string): Promise<GetLoyaltyForUserResponse> {
    return this.getMyLoyalty(userId);
  }
}
