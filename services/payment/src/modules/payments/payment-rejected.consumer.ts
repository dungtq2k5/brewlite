import { Injectable } from '@nestjs/common';
import { RefundReason, type EventPayload } from '@brewlite/contracts';
import { JetStreamConsumer } from '@brewlite/nest-common';
import { RefundService } from './refund.service.js';

const SUBJECT = 'ordering.payment.rejected' as const;

/** A payment that succeeded after its order was no longer payable (product-overview §6.4). */
@Injectable()
export class PaymentRejectedConsumer extends JetStreamConsumer<typeof SUBJECT> {
  readonly service = 'payment';
  readonly subject = SUBJECT;

  constructor(private readonly refunds: RefundService) {
    super();
  }

  handle(payload: EventPayload<typeof SUBJECT>): Promise<void> {
    return this.refunds.refund(payload.paymentId, RefundReason.ORDER_NOT_PAYABLE);
  }
}
