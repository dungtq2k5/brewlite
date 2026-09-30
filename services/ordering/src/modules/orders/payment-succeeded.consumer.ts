import { Injectable } from '@nestjs/common';
import type { EventPayload } from '@brewlite/contracts';
import { JetStreamConsumer } from '@brewlite/nest-common';
import { OrdersService } from './orders.service.js';

const SUBJECT = 'payment.payment.succeeded' as const;

/** Ordering's first consumer of payment's events. */
@Injectable()
export class PaymentSucceededConsumer extends JetStreamConsumer<typeof SUBJECT> {
  readonly service = 'ordering';
  readonly subject = SUBJECT;

  constructor(private readonly orders: OrdersService) {
    super();
  }

  handle(payload: EventPayload<typeof SUBJECT>): Promise<void> {
    return this.orders.applyPaymentSucceeded(payload);
  }
}
