import { Injectable } from '@nestjs/common';
import { OrderStatus, RefundReason, type EventPayload } from '@brewlite/contracts';
import { JetStreamConsumer, PoisonMessage } from '@brewlite/nest-common';
import { RefundService } from './refund.service.js';

const SUBJECT = 'ordering.order.status_changed' as const;

/** A paid order staff cancelled — the only `status_changed` payment cares about (api §6.3). */
@Injectable()
export class OrderCancelledConsumer extends JetStreamConsumer<typeof SUBJECT> {
  readonly service = 'payment';
  readonly subject = SUBJECT;

  constructor(private readonly refunds: RefundService) {
    super();
  }

  async handle(payload: EventPayload<typeof SUBJECT>): Promise<void> {
    if (payload.from !== OrderStatus.PAID || payload.to !== OrderStatus.CANCELLED) return;
    if (!payload.paymentId) throw new PoisonMessage('a paid cancel without the payment to refund');
    await this.refunds.refund(payload.paymentId, RefundReason.STAFF_CANCELLED);
  }
}
