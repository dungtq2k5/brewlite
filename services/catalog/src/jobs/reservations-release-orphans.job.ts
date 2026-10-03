import { Injectable, Logger } from '@nestjs/common';
import { isGrpcServiceError, readErrorCode, type RunnableJob } from '@brewlite/nest-common';
import { OrderStatus, RESERVATION_ORPHAN_TTL_MS, ReservationStatus } from '@brewlite/contracts';
import { PrismaService } from '../modules/prisma/prisma.service.js';
import { StockService } from '../modules/stock/stock.service.js';
import { OrderingOrderGrpcClient } from '../modules/stock/ordering-order-grpc.client.js';

const BATCH_SIZE = 100;
const RELEASED_RETENTION_MS = 30 * 24 * 60 * 60_000;
const PAID_OR_LATER = new Set<string>([
  OrderStatus.PAID,
  OrderStatus.PREPARING,
  OrderStatus.READY,
  OrderStatus.COMPLETED,
]);

/**
 * A `HELD` row this old has an order that either never got written (a crash before the
 * commit) or is genuinely still unpaid. `GetOrderStatus` is the only source of truth —
 * the sweep never guesses from the reservation's own age alone (rdm-spec C-6).
 */
@Injectable()
export class ReservationsReleaseOrphansJob implements RunnableJob {
  private readonly logger = new Logger(ReservationsReleaseOrphansJob.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stock: StockService,
    private readonly ordering: OrderingOrderGrpcClient,
  ) {}

  async run(now: Date = new Date()): Promise<void> {
    const cutoff = new Date(now.getTime() - RESERVATION_ORPHAN_TTL_MS);
    const orphans = await this.prisma.stockReservation.findMany({
      where: { status: ReservationStatus.HELD, createdAt: { lt: cutoff } },
      distinct: ['orderId'],
      select: { orderId: true },
      orderBy: { createdAt: 'asc' },
      take: BATCH_SIZE,
    });

    for (const { orderId } of orphans) {
      await this.resolveOne(orderId);
    }

    await this.prisma.stockReservation.deleteMany({
      where: {
        status: ReservationStatus.RELEASED,
        updatedAt: { lt: new Date(now.getTime() - RELEASED_RETENTION_MS) },
      },
    });
  }

  private async resolveOne(orderId: string): Promise<void> {
    let status: string;
    try {
      const response = await this.ordering.getOrderStatus({ id: orderId });
      status = response.status;
    } catch (error) {
      if (isGrpcServiceError(error) && readErrorCode(error) === 'RESOURCE_NOT_FOUND') {
        status = 'NOT_FOUND';
      } else {
        // The call itself failed (ordering down, timeout, …) — never guess; next run retries.
        this.logger.debug(`orphan sweep: GetOrderStatus(${orderId}) failed, skipping`);
        return;
      }
    }

    if (status === 'NOT_FOUND' || status === OrderStatus.CANCELLED) {
      await this.stock.releaseForOrder(orderId);
    } else if (PAID_OR_LATER.has(status)) {
      await this.stock.confirmForOrder(orderId);
    }
    // Still unpaid (PENDING/PAYMENT_FAILED) — leave it; not a genuine orphan yet.
  }
}
