import { Inject, Injectable, Logger } from '@nestjs/common';
import { isUniqueConstraintViolation, OutboxService, PoisonMessage } from '@brewlite/nest-common';
import { newId, PaymentStatus, RefundReason, RefundStatus } from '@brewlite/contracts';
import type { Prisma, Refund } from '../../../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  PAYMENT_PROVIDER_TOKEN,
  type PaymentProvider,
} from '../../providers/payment/payment-provider.interface.js';

export type RefundOutcome = RefundStatus.SUCCEEDED | RefundStatus.FAILED;

@Injectable()
export class RefundService {
  private readonly logger = new Logger(RefundService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
    @Inject(PAYMENT_PROVIDER_TOKEN) private readonly provider: PaymentProvider,
  ) {}

  /**
   * Our row first (conventions §10.2), committed on its own; the provider call follows with
   * the row's id as its idempotency key — so a redelivery after a crash between the two
   * finds the `PENDING` row and completes it, never refunding twice. Always the full amount.
   */
  async refund(paymentId: string, reason: RefundReason): Promise<void> {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment || payment.status !== PaymentStatus.SUCCEEDED) {
      throw new PoisonMessage('a refund for a payment that never succeeded');
    }

    let row: Refund;
    try {
      row = await this.prisma.refund.create({
        data: {
          id: newId(),
          paymentId,
          orderId: payment.orderId,
          amountVnd: payment.amountVnd,
          reason,
          status: RefundStatus.PENDING,
        },
      });
    } catch (error) {
      if (!isUniqueConstraintViolation(error, 'refunds_payment_id_key')) throw error;
      row = await this.prisma.refund.findUniqueOrThrow({ where: { paymentId } });
    }
    if (row.status !== RefundStatus.PENDING) return; // a redelivery

    const result = await this.provider.refund({
      refundId: row.id,
      paymentIntentId: payment.stripePaymentIntentId,
      amountVnd: row.amountVnd,
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.refund.updateMany({
        where: { id: row.id, status: RefundStatus.PENDING },
        data: { stripeRefundId: result.stripeRefundId },
      });
      if (result.status !== 'PENDING')
        await this.applyOutcome(tx, row, RefundStatus[result.status]);
    });
  }

  /** A conditional update from `PENDING` plus one outbox row — shared by `refund()` and the `refund.updated` webhook. */
  async applyOutcome(
    tx: Prisma.TransactionClient,
    refund: Pick<Refund, 'id' | 'paymentId' | 'orderId' | 'amountVnd'>,
    outcome: RefundOutcome,
  ): Promise<void> {
    const { count } = await tx.refund.updateMany({
      where: { id: refund.id, status: RefundStatus.PENDING },
      data: { status: outcome },
    });
    if (count === 0) return; // already resolved — a duplicate

    if (outcome === RefundStatus.SUCCEEDED) {
      await this.outbox.add(tx, 'payment.refund.succeeded', refund.paymentId, {
        refundId: refund.id,
        paymentId: refund.paymentId,
        orderId: refund.orderId,
        amountVnd: refund.amountVnd,
      });
      return;
    }
    // An admin resolves it in the Stripe Dashboard (api §8).
    this.logger.error(
      { refundId: refund.id, paymentId: refund.paymentId, orderId: refund.orderId },
      'refund failed',
    );
    await this.outbox.add(tx, 'payment.refund.failed', refund.paymentId, {
      refundId: refund.id,
      paymentId: refund.paymentId,
      orderId: refund.orderId,
    });
  }
}
