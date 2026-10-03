import type { Metadata } from '@grpc/grpc-js';
import type { RpcException } from '@nestjs/microservices';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { newId, PaymentStatus } from '@brewlite/contracts';
import { WebhookService } from '../../src/modules/payments/webhook.service.js';
import { prisma } from '../setup/per-file.js';
import { buildStripeApp, buildStripeStub, signedEvent } from '../support/stripe-app.js';

function codeOf(exception: unknown): string | undefined {
  if (!(exception && typeof exception === 'object' && 'getError' in exception)) return undefined;
  const { metadata } = (exception as RpcException).getError() as { metadata: Metadata };
  return metadata.get('bl-error-code')[0] as string | undefined;
}

async function seedPayment(overrides: Partial<Record<string, unknown>> = {}) {
  return prisma.payment.create({
    data: {
      id: newId(),
      orderId: newId(),
      userId: newId(),
      amountVnd: 50_000,
      provider: 'STRIPE',
      status: 'PENDING',
      idempotencyKey: newId(),
      requestHash: 'x'.repeat(64),
      stripeCheckoutSessionId: `cs_${newId()}`,
      ...overrides,
    },
  });
}

const session = (payment: { stripeCheckoutSessionId: string | null }, extra = {}) => ({
  id: payment.stripeCheckoutSessionId,
  payment_status: 'paid',
  payment_intent: 'pi_test_1',
  ...extra,
});

describe('WebhookService.handleStripeEvent — events signed by the SDK', () => {
  const { stripe, calls } = buildStripeStub();
  let app: Awaited<ReturnType<typeof buildStripeApp>>;
  let webhook: WebhookService;

  beforeAll(async () => {
    app = await buildStripeApp(stripe);
    webhook = app.get(WebhookService);
  });

  beforeEach(() => {
    calls.retrieveIntent.mockClear();
  });

  afterAll(async () => {
    await app.close();
  });

  it.each([['checkout.session.completed'], ['checkout.session.async_payment_succeeded']])(
    '%s marks the payment SUCCEEDED with its method, stores the intent, writes one outbox row',
    async (type) => {
      const payment = await seedPayment();
      await webhook.handleStripeEvent(signedEvent(stripe, type, session(payment)).request);

      const row = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
      expect(row).toMatchObject({
        status: 'SUCCEEDED',
        method: 'CARD',
        stripePaymentIntentId: 'pi_test_1',
      });
      const events = await prisma.outboxEvent.findMany({ where: { aggregateId: payment.id } });
      expect(events.map((e) => e.subject)).toEqual(['payment.payment.succeeded']);
      expect(await prisma.stripeEvent.count()).toBe(1);
    },
  );

  it('a completed session that is still unpaid does nothing (an async method is settling)', async () => {
    const payment = await seedPayment();
    await webhook.handleStripeEvent(
      signedEvent(
        stripe,
        'checkout.session.completed',
        session(payment, { payment_status: 'unpaid' }),
      ).request,
    );
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe(
      'PENDING',
    );
    expect(await prisma.stripeEvent.count()).toBe(1);
  });

  it('async_payment_failed → FAILED / ASYNC_FAILED, expired → EXPIRED', async () => {
    const failed = await seedPayment();
    await webhook.handleStripeEvent(
      signedEvent(stripe, 'checkout.session.async_payment_failed', session(failed)).request,
    );
    expect(await prisma.payment.findUniqueOrThrow({ where: { id: failed.id } })).toMatchObject({
      status: PaymentStatus.FAILED,
      failureReason: 'ASYNC_FAILED',
    });

    const expired = await seedPayment();
    await webhook.handleStripeEvent(
      signedEvent(stripe, 'checkout.session.expired', session(expired)).request,
    );
    expect(await prisma.payment.findUniqueOrThrow({ where: { id: expired.id } })).toMatchObject({
      status: PaymentStatus.EXPIRED,
      failureReason: 'EXPIRED',
    });
  });

  it('the same event twice → one P-3 row, one effect, no second API call', async () => {
    const payment = await seedPayment();
    const delivery = signedEvent(stripe, 'checkout.session.completed', session(payment));
    await webhook.handleStripeEvent(delivery.request);
    await webhook.handleStripeEvent(delivery.request);

    expect(await prisma.stripeEvent.count({ where: { id: delivery.id } })).toBe(1);
    expect(await prisma.outboxEvent.count({ where: { aggregateId: payment.id } })).toBe(1);
    expect(calls.retrieveIntent).toHaveBeenCalledTimes(1);
  });

  it('a late duplicate for a payment already out of PENDING (a different event id) succeeds quietly', async () => {
    const payment = await seedPayment();
    await webhook.handleStripeEvent(
      signedEvent(stripe, 'checkout.session.completed', session(payment)).request,
    );
    await webhook.handleStripeEvent(
      signedEvent(stripe, 'checkout.session.async_payment_succeeded', session(payment)).request,
    );
    expect(await prisma.outboxEvent.count({ where: { aggregateId: payment.id } })).toBe(1);
    expect(await prisma.stripeEvent.count()).toBe(2);
  });

  it('a bad signature is WEBHOOK_SIGNATURE_INVALID and records nothing', async () => {
    const payment = await seedPayment();
    const delivery = signedEvent(stripe, 'checkout.session.completed', session(payment));
    const error = await webhook
      .handleStripeEvent({ payload: delivery.request.payload, signature: 't=1,v1=bad' })
      .catch((e: unknown) => e);
    expect(codeOf(error)).toBe('WEBHOOK_SIGNATURE_INVALID');
    expect(await prisma.stripeEvent.count()).toBe(0);
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe(
      'PENDING',
    );
  });

  it('a body altered after signing is refused', async () => {
    const payment = await seedPayment();
    const { request } = signedEvent(stripe, 'checkout.session.completed', session(payment));
    const error = await webhook
      .handleStripeEvent({
        payload: Buffer.from(request.payload.toString().replace('paid', 'pAid')),
        signature: request.signature,
      })
      .catch((e: unknown) => e);
    expect(codeOf(error)).toBe('WEBHOOK_SIGNATURE_INVALID');
  });

  it("an effect that throws leaves no P-3 row, so Stripe's retry is processed", async () => {
    const payment = await seedPayment();
    const delivery = signedEvent(stripe, 'checkout.session.completed', session(payment));
    calls.retrieveIntent.mockRejectedValueOnce(
      Object.assign(new Error('down'), { type: 'StripeConnectionError' }),
    );

    await expect(webhook.handleStripeEvent(delivery.request)).rejects.toThrow();
    expect(await prisma.stripeEvent.count()).toBe(0);
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe(
      'PENDING',
    );

    await webhook.handleStripeEvent(delivery.request);
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe(
      'SUCCEEDED',
    );
    expect(await prisma.stripeEvent.count()).toBe(1);
  });

  it('an unknown session is answered (permanent), logged, and recorded', async () => {
    const delivery = signedEvent(
      stripe,
      'checkout.session.completed',
      session({ stripeCheckoutSessionId: 'cs_nobody' }),
    );
    await expect(webhook.handleStripeEvent(delivery.request)).resolves.toEqual({});
    expect(await prisma.stripeEvent.count({ where: { id: delivery.id } })).toBe(1);
  });

  it('an unhandled type is recorded and answered', async () => {
    const delivery = signedEvent(stripe, 'customer.created', { id: 'cus_1' });
    await expect(webhook.handleStripeEvent(delivery.request)).resolves.toEqual({});
    expect(
      await prisma.stripeEvent.count({ where: { id: delivery.id, type: 'customer.created' } }),
    ).toBe(1);
  });
});
