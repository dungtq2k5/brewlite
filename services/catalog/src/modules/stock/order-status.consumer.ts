import { Injectable } from '@nestjs/common';
import { OrderStatus, type EventPayload } from '@brewlite/contracts';
import { JetStreamConsumer } from '@brewlite/nest-common';
import { StockService } from './stock.service.js';

const SUBJECT = 'ordering.order.status_changed' as const;

/**
 * Catalog's first consumer (conventions §8.2). Stale events are harmless: a `PAID` arriving after
 * the order's `CANCELLED` finds no `HELD` row; a redelivered `CANCELLED` finds nothing
 * left to release — both effects are the target table's own conditional write, never the
 * `Nats-Msg-Id` (conventions §8.2).
 */
@Injectable()
export class OrderStatusConsumer extends JetStreamConsumer<typeof SUBJECT> {
  readonly service = 'catalog';
  readonly subject = SUBJECT;

  constructor(private readonly stock: StockService) {
    super();
  }

  async handle(payload: EventPayload<typeof SUBJECT>): Promise<void> {
    switch (payload.to) {
      case OrderStatus.PAID:
        await this.stock.confirmForOrder(payload.orderId);
        return;
      case OrderStatus.CANCELLED:
        await this.stock.releaseForOrder(payload.orderId);
        return;
      default:
        return;
    }
  }
}
