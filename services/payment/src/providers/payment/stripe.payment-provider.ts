import { Logger } from '@nestjs/common';
import Stripe from 'stripe';
import {
  CHECKOUT_SESSION_TTL_MS,
  PaymentProvider as PaymentProviderKind,
  type PaymentMethod,
} from '@brewlite/contracts';
import { rpcError } from '@brewlite/nest-common';
import { toPaymentMethod } from '../../modules/payments/domain/payment-method.js';
import { toRefundOutcome } from '../../modules/payments/domain/refund-status.js';
import type {
  PaymentProvider,
  RefundInput,
  RefundResult,
  StartCheckoutInput,
  StartCheckoutResult,
} from './payment-provider.interface.js';

/** The API version this code was written against — the SDK's own pin, never a floating default. */
export const STRIPE_API_VERSION = '2026-08-26.dahlia';

class StripeDeadlineError extends Error {
  readonly type = 'StripeConnectionError';
}

/**
 * The SDK's own `timeout` does not fire while the TCP connection is still being
 * established (an unreachable host hangs far past it), so every call races a deadline of
 * our own — a Stripe that cannot be reached is `PAYMENT_PROVIDER_UNAVAILABLE`, quickly.
 */
function withDeadline<T>(call: Promise<T>): Promise<T> {
  let timer: NodeJS.Timeout;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new StripeDeadlineError('Stripe did not answer in time')),
      STRIPE_TIMEOUT_MS,
    );
  });
  return Promise.race([call, deadline]).finally(() => clearTimeout(timer));
}

/**
 * Shorter than the gateway's `CreatePayment` deadline and the 10 s transaction, so an
 * unreachable Stripe surfaces here as `PAYMENT_PROVIDER_UNAVAILABLE` rather than as the
 * gateway's own timeout. The SDK's default is 80 s. Every call carries an idempotency key,
 * so one retry is safe.
 */
export const STRIPE_TIMEOUT_MS = 6_000;

export function createStripeClient(secretKey: string): Stripe {
  return new Stripe(secretKey, {
    apiVersion: STRIPE_API_VERSION,
    timeout: STRIPE_TIMEOUT_MS,
    maxNetworkRetries: 0,
  });
}

/** What the webhook handler needs from an event — Stripe's own types never leave this file. */
export type ProviderEvent =
  | {
      id: string;
      type: 'checkout.session';
      name: string;
      sessionId: string;
      paid: boolean;
      paymentIntentId: string | null;
    }
  | { id: string; type: 'refund'; name: string; stripeRefundId: string; status: string }
  | { id: string; type: 'other'; name: string };

const CONNECTION_ERRORS = new Set([
  'StripeConnectionError',
  'StripeAPIError',
  'StripeRateLimitError',
]);

/** The only file that imports `stripe` (conventions §10.2). */
export class StripePaymentProvider implements PaymentProvider {
  readonly kind = PaymentProviderKind.STRIPE;
  private readonly logger = new Logger(StripePaymentProvider.name);

  constructor(
    private readonly stripe: Stripe,
    private readonly webUrl: string,
    private readonly webhookSecret: string,
  ) {}

  async startCheckout(input: StartCheckoutInput): Promise<StartCheckoutResult> {
    const metadata = { paymentId: input.paymentId, orderId: input.orderId };
    try {
      const session = await withDeadline(
        this.stripe.checkout.sessions.create(
          {
            mode: 'payment',
            ui_mode: 'embedded_page',
            // VND is zero-decimal — the đồng total as-is, never × 100 (ADR 0002). One line for the
            // whole order, so Stripe's arithmetic can never disagree with ours. No
            // `payment_method_types`: the Dashboard chooses (architecture §6).
            line_items: [
              {
                quantity: 1,
                price_data: {
                  currency: 'vnd',
                  unit_amount: input.amountVnd,
                  product_data: { name: `BrewLite order #${input.orderNo}` },
                },
              },
            ],
            client_reference_id: input.paymentId,
            metadata,
            payment_intent_data: { metadata },
            expires_at: Math.floor((Date.now() + CHECKOUT_SESSION_TTL_MS) / 1000),
            return_url: `${this.webUrl}/orders/${input.orderId}?payment=${input.paymentId}`,
          },
          { idempotencyKey: input.idempotencyKey },
        ),
      );
      return {
        sessionId: session.id,
        clientSecret: session.client_secret,
        expiresAt: new Date(session.expires_at * 1000),
      };
    } catch (error) {
      throw this.translate(error, 'checkout.sessions.create');
    }
  }

  async readClientSecret(sessionId: string): Promise<string | null> {
    try {
      const session = await withDeadline(this.stripe.checkout.sessions.retrieve(sessionId));
      return session.status === 'open' ? session.client_secret : null;
    } catch (error) {
      throw this.translate(error, 'checkout.sessions.retrieve');
    }
  }

  async refund(input: RefundInput): Promise<RefundResult> {
    try {
      const refund = await withDeadline(
        this.stripe.refunds.create(
          { payment_intent: input.paymentIntentId ?? undefined, amount: input.amountVnd },
          { idempotencyKey: input.refundId },
        ),
      );
      return { stripeRefundId: refund.id, status: toRefundOutcome(refund.status) };
    } catch (error) {
      throw this.translate(error, 'refunds.create');
    }
  }

  /** Verifies the signature over the raw bytes — before anything else is done with the event. */
  verifyEvent(payload: Buffer, signature: string): ProviderEvent {
    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(payload, signature, this.webhookSecret);
    } catch {
      throw rpcError('WEBHOOK_SIGNATURE_INVALID');
    }
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded':
      case 'checkout.session.async_payment_failed':
      case 'checkout.session.expired': {
        const session = event.data.object;
        const intent = session.payment_intent;
        return {
          id: event.id,
          type: 'checkout.session',
          name: event.type,
          sessionId: session.id,
          paid: session.payment_status !== 'unpaid',
          paymentIntentId: typeof intent === 'string' ? intent : (intent?.id ?? null),
        };
      }
      case 'refund.updated':
        return {
          id: event.id,
          type: 'refund',
          name: event.type,
          stripeRefundId: event.data.object.id,
          status: event.data.object.status ?? 'pending',
        };
      default:
        return { id: event.id, type: 'other', name: event.type };
    }
  }

  /** One API call: the intent with its latest charge, for how the customer actually paid. */
  async readPaymentMethod(paymentIntentId: string): Promise<PaymentMethod> {
    try {
      const intent = await withDeadline(
        this.stripe.paymentIntents.retrieve(paymentIntentId, {
          expand: ['latest_charge'],
        }),
      );
      const charge = typeof intent.latest_charge === 'object' ? intent.latest_charge : null;
      return toPaymentMethod(charge?.payment_method_details);
    } catch (error) {
      throw this.translate(error, 'paymentIntents.retrieve');
    }
  }

  /**
   * A connection error or Stripe `5xx` is the provider being unavailable (retry). A `4xx`
   * is our bug: logged with Stripe's request id and never the request body (conventions §9.3).
   */
  private translate(error: unknown, operation: string): Error {
    const e = error as { type?: string; requestId?: string; statusCode?: number; message?: string };
    if (e.type && CONNECTION_ERRORS.has(e.type)) return rpcError('PAYMENT_PROVIDER_UNAVAILABLE');
    this.logger.error(
      { operation, stripeRequestId: e.requestId, status: e.statusCode, type: e.type },
      'Stripe rejected a request',
    );
    return error instanceof Error ? error : new Error(String(error));
  }
}
