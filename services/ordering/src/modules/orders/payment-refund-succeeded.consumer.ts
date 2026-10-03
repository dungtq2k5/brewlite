import { Injectable } from '@nestjs/common';
import { OrderRefundStatus, type EventPayload } from '@brewlite/contracts';
import { JetStreamConsumer } from '@brewlite/nest-common';
import { OrdersService } from './orders.service.js';

const SUBJECT = 'payment.refund.succeeded' as const;

@Injectable()
export class PaymentRefundSucceededConsumer extends JetStreamConsumer<typeof SUBJECT> {
  readonly service = 'ordering';
  readonly subject = SUBJECT;

  constructor(private readonly orders: OrdersService) {
    super();
  }

  handle(payload: EventPayload<typeof SUBJECT>): Promise<void> {
    return this.orders.applyRefundOutcome(payload.orderId, OrderRefundStatus.REFUNDED);
  }
}
