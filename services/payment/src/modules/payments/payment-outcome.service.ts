import { Injectable } from '@nestjs/common';
import { OutboxService, rpcError } from '@brewlite/nest-common';
import { PaymentFailureReason, PaymentMethod, PaymentStatus } from '@brewlite/contracts';
import type { Prisma } from '../../../generated/prisma/client.js';
import type { Payment } from '../../../generated/prisma/client.js';

export type PaymentOutcome =
  | { kind: 'SUCCEEDED'; method: PaymentMethod }
  | { kind: 'FAILED' | 'EXPIRED'; reason: PaymentFailureReason };

/**
 * One method for every outcome — `fake-confirm` and 08's Stripe webhook both call it, so
 * the fake provider produces exactly what Stripe will.
 */
@Injectable()
export class PaymentOutcomeService {
  constructor(private readonly outbox: OutboxService) {}

  async apply(
    tx: Prisma.TransactionClient,
    paymentId: string,
    outcome: PaymentOutcome,
  ): Promise<Payment> {
    const { count } = await tx.payment.updateMany({
      where: { id: paymentId, status: PaymentStatus.PENDING },
      data:
        outcome.kind === 'SUCCEEDED'
          ? { status: PaymentStatus.SUCCEEDED, method: outcome.method, succeededAt: new Date() }
          : { status: outcome.kind, failureReason: outcome.reason },
    });
    if (count === 0) {
      const fresh = await tx.payment.findFirstOrThrow({ where: { id: paymentId } });
      throw rpcError('INVALID_STATE', { status: fresh.status });
    }
    const payment = await tx.payment.findFirstOrThrow({ where: { id: paymentId } });

    if (outcome.kind === 'SUCCEEDED') {
      await this.outbox.add(tx, 'payment.payment.succeeded', paymentId, {
        paymentId,
        orderId: payment.orderId,
        userId: payment.userId,
        amountVnd: payment.amountVnd,
        method: outcome.method,
      });
    } else {
      await this.outbox.add(tx, 'payment.payment.failed', paymentId, {
        paymentId,
        orderId: payment.orderId,
        reason: outcome.reason,
      });
    }
    return payment;
  }
}
