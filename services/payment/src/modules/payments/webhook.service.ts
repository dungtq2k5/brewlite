import { Inject, Injectable, Logger } from '@nestjs/common';
import { isUniqueConstraintViolation, localErrorCode, rpcError } from '@brewlite/nest-common';
import { PaymentFailureReason, RefundStatus } from '@brewlite/contracts';
import type { HandleStripeEventRequest } from '@brewlite/contracts/generated/brewlite/payment/webhook_service.js';
import type { Prisma } from '../../../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PaymentOutcomeService, type PaymentOutcome } from './payment-outcome.service.js';
import { RefundService } from './refund.service.js';
import {
  PAYMENT_PROVIDER_TOKEN,
  type PaymentProvider,
} from '../../providers/payment/payment-provider.interface.js';
import {
  StripePaymentProvider,
  type ProviderEvent,
} from '../../providers/payment/stripe.payment-provider.js';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly outcome: PaymentOutcomeService,
    private readonly refunds: RefundService,
    @Inject(PAYMENT_PROVIDER_TOKEN) private readonly provider: PaymentProvider,
  ) {}

  /**
   * Signature first, before any other work. The P-3 row and the event's effect share one
   * transaction: a crash or a failed effect leaves no P-3 row, so Stripe's retry processes
   * the event again; a handled event is never handled twice.
   */
  async handleStripeEvent(request: HandleStripeEventRequest): Promise<Record<string, never>> {
    // Only the Stripe provider verifies webhooks; with the fake there is nothing to trust.
    if (!(this.provider instanceof StripePaymentProvider)) {
      throw rpcError('WEBHOOK_SIGNATURE_INVALID');
    }
    const provider = this.provider;
    const event = provider.verifyEvent(Buffer.from(request.payload), request.signature);

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.stripeEvent.create({ data: { id: event.id, type: event.name } });
        await this.apply(tx, provider, event);
      });
    } catch (error) {
      if (isUniqueConstraintViolation(error, 'stripe_events_pkey')) return {}; // already handled
      throw error;
    }
    return {};
  }

  private async apply(
    tx: Prisma.TransactionClient,
    provider: StripePaymentProvider,
    event: ProviderEvent,
  ): Promise<void> {
    if (event.type === 'other') return;

    if (event.type === 'refund') {
      const refund = await tx.refund.findUnique({
        where: { stripeRefundId: event.stripeRefundId },
      });
      if (!refund) return this.unknown(event, event.stripeRefundId);
      if (event.status === 'succeeded') {
        await this.refunds.applyOutcome(tx, refund, RefundStatus.SUCCEEDED);
      } else if (event.status === 'failed' || event.status === 'canceled') {
        await this.refunds.applyOutcome(tx, refund, RefundStatus.FAILED);
      }
      return;
    }

    const payment = await tx.payment.findUnique({
      where: { stripeCheckoutSessionId: event.sessionId },
    });
    if (!payment) return this.unknown(event, event.sessionId);

    let outcome: PaymentOutcome;
    switch (event.name) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded': {
        // An asynchronous method is still settling — its own event follows.
        if (!event.paid || !event.paymentIntentId) return;
        await tx.payment.update({
          where: { id: payment.id },
          data: { stripePaymentIntentId: event.paymentIntentId },
        });
        outcome = {
          kind: 'SUCCEEDED',
          method: await provider.readPaymentMethod(event.paymentIntentId),
        };
        break;
      }
      case 'checkout.session.async_payment_failed':
        outcome = { kind: 'FAILED', reason: PaymentFailureReason.ASYNC_FAILED };
        break;
      case 'checkout.session.expired':
        outcome = { kind: 'EXPIRED', reason: PaymentFailureReason.EXPIRED };
        break;
      default:
        return;
    }

    try {
      await this.outcome.apply(tx, payment.id, outcome);
    } catch (error) {
      // A payment already out of PENDING: a late duplicate — success, not a retry.
      if (localErrorCode(error) !== 'INVALID_STATE') throw error;
    }
  }

  /** Permanent — answered `200`, or Stripe would retry it for days (api §4). */
  private unknown(event: ProviderEvent, reference: string): void {
    this.logger.warn(
      { eventId: event.id, type: event.name, reference },
      'Stripe event for an unknown object',
    );
  }
}
