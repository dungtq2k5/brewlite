import { Injectable, Logger } from '@nestjs/common';
import type { RunnableJob } from '@brewlite/nest-common';
import { CancelReason, OrderActorType, OrderStatus } from '@brewlite/contracts';
import { PrismaService } from '../modules/prisma/prisma.service.js';
import { OrdersService } from '../modules/orders/orders.service.js';

const BATCH_SIZE = 100;

/**
 * Cancels unpaid orders past their deadline, one transaction each — a bad row never
 * blocks the other 99. `expiresAt <= now` is inside `transition()`'s conditional `WHERE`,
 * not just this select: a future payment attempt raises `expires_at` when it starts,
 * and only the `WHERE` version can't win a race it started after this job already read
 * the row (conventions §8.3).
 */
@Injectable()
export class OrdersExpireJob implements RunnableJob {
  private readonly logger = new Logger(OrdersExpireJob.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrdersService,
  ) {}

  async run(now: Date = new Date()): Promise<void> {
    const candidates = await this.prisma.order.findMany({
      where: {
        status: { in: [OrderStatus.PENDING, OrderStatus.PAYMENT_FAILED] },
        expiresAt: { lte: now },
      },
      select: { id: true },
      orderBy: { expiresAt: 'asc' },
      take: BATCH_SIZE,
    });

    for (const { id } of candidates) {
      try {
        await this.prisma.$transaction((tx) =>
          this.orders.transition(
            tx,
            id,
            {
              status: { in: [OrderStatus.PENDING, OrderStatus.PAYMENT_FAILED] },
              expiresAt: { lte: now },
            },
            OrderStatus.CANCELLED,
            { type: OrderActorType.SYSTEM },
            { cancelReason: CancelReason.EXPIRED, cancelledAt: now },
          ),
        );
      } catch (error) {
        // A concurrent payment attempt moved expires_at forward, or the order otherwise
        // changed under us — the conditional update already refused; nothing to fix
        // here, next tick reconsiders whatever is still actually expired.
        this.logger.debug(
          `order ${id} not expired: ${error instanceof Error ? error.message : error}`,
        );
      }
    }
  }
}
