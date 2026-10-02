import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { newId, RefundReason } from '@brewlite/contracts';
import { PoisonMessage } from '@brewlite/nest-common';
import { RefundService } from '../../src/modules/payments/refund.service.js';
import { WebhookService } from '../../src/modules/payments/webhook.service.js';
import { prisma } from '../setup/per-file.js';
import { buildStripeApp, buildStripeStub, signedEvent } from '../support/stripe-app.js';

async function seedPayment(status = 'SUCCEEDED') {
  return prisma.payment.create({
    data: {
      id: newId(),
      orderId: newId(),
      userId: newId(),
      amountVnd: 50_000,
      provider: 'STRIPE',
      status,
      method: status === 'SUCCEEDED' ? 'CARD' : undefined,
      succeededAt: status === 'SUCCEEDED' ? new Date() : undefined,
      failureReason: status === 'FAILED' ? 'SIMULATED' : undefined,
      idempotencyKey: newId(),
      requestHash: 'x'.repeat(64),
      stripeCheckoutSessionId: `cs_${newId()}`,
      stripePaymentIntentId: `pi_${newId()}`,
    },
  });
}

describe('RefundService', () => {
  const { stripe, calls } = buildStripeStub();
  let app: Awaited<ReturnType<typeof buildStripeApp>>;
  let refunds: RefundService;
  let webhook: WebhookService;

  beforeAll(async () => {
    app = await buildStripeApp(stripe);
    refunds = app.get(RefundService);
    webhook = app.get(WebhookService);
  });

  beforeEach(() => {
    calls.createRefund.mockReset().mockResolvedValue({ id: 're_test_1', status: 'succeeded' });
  });

  afterAll(async () => {
    await app.close();
  });

  it('a succeeded refund: one P-2 row SUCCEEDED for the full amount, one outbox row', async () => {
    const payment = await seedPayment();
    await refunds.refund(payment.id, RefundReason.STAFF_CANCELLED);

    const row = await prisma.refund.findUniqueOrThrow({ where: { paymentId: payment.id } });
    expect(row).toMatchObject({
      status: 'SUCCEEDED',
      reason: 'STAFF_CANCELLED',
      amountVnd: 50_000,
      stripeRefundId: 're_test_1',
      orderId: payment.orderId,
    });
    expect(calls.createRefund).toHaveBeenCalledWith(
      { payment_intent: payment.stripePaymentIntentId, amount: 50_000 },
      { idempotencyKey: row.id },
    );
    const events = await prisma.outboxEvent.findMany({ where: { aggregateId: payment.id } });
    expect(events.map((e) => e.subject)).toEqual(['payment.refund.succeeded']);
    expect(events[0]!.payload).toMatchObject({
      refundId: row.id,
      orderId: payment.orderId,
      amountVnd: 50_000,
    });
  });

  it('the same cancel delivered twice refunds once', async () => {
    const payment = await seedPayment();
    await refunds.refund(payment.id, RefundReason.STAFF_CANCELLED);
    await refunds.refund(payment.id, RefundReason.STAFF_CANCELLED);
    expect(calls.createRefund).toHaveBeenCalledTimes(1);
    expect(await prisma.refund.count()).toBe(1);
    expect(await prisma.outboxEvent.count()).toBe(1);
  });

  it('a crash after our row: the redelivery completes the PENDING row with the same key', async () => {
    const payment = await seedPayment();
    calls.createRefund.mockRejectedValueOnce(
      Object.assign(new Error('timeout'), { type: 'StripeConnectionError' }),
    );
    await expect(refunds.refund(payment.id, RefundReason.ORDER_NOT_PAYABLE)).rejects.toThrow();

    const pending = await prisma.refund.findUniqueOrThrow({ where: { paymentId: payment.id } });
    expect(pending.status).toBe('PENDING');

    await refunds.refund(payment.id, RefundReason.ORDER_NOT_PAYABLE);
    const keys = calls.createRefund.mock.calls.map(
      (c) => (c[1] as { idempotencyKey: string }).idempotencyKey,
    );
    expect(keys).toEqual([pending.id, pending.id]);
    expect((await prisma.refund.findUniqueOrThrow({ where: { id: pending.id } })).status).toBe(
      'SUCCEEDED',
    );
    expect(await prisma.refund.count()).toBe(1);
  });

  it('a pending refund waits for refund.updated, which resolves it; a duplicate changes nothing', async () => {
    const payment = await seedPayment();
    calls.createRefund.mockResolvedValueOnce({ id: 're_async', status: 'pending' });
    await refunds.refund(payment.id, RefundReason.STAFF_CANCELLED);
    expect(
      (await prisma.refund.findUniqueOrThrow({ where: { paymentId: payment.id } })).status,
    ).toBe('PENDING');
    expect(await prisma.outboxEvent.count()).toBe(0);

    const delivery = signedEvent(stripe, 'refund.updated', { id: 're_async', status: 'succeeded' });
    await webhook.handleStripeEvent(delivery.request);
    await webhook.handleStripeEvent(delivery.request);
    expect(
      (await prisma.refund.findUniqueOrThrow({ where: { paymentId: payment.id } })).status,
    ).toBe('SUCCEEDED');
    expect(await prisma.outboxEvent.count()).toBe(1);
  });

  it('a failed refund is FAILED with a refund.failed event (via the webhook or the call)', async () => {
    const viaCall = await seedPayment();
    calls.createRefund.mockResolvedValueOnce({ id: 're_bad', status: 'failed' });
    await refunds.refund(viaCall.id, RefundReason.STAFF_CANCELLED);
    expect(
      (await prisma.refund.findUniqueOrThrow({ where: { paymentId: viaCall.id } })).status,
    ).toBe('FAILED');

    const viaHook = await seedPayment();
    calls.createRefund.mockResolvedValueOnce({ id: 're_late', status: 'pending' });
    await refunds.refund(viaHook.id, RefundReason.STAFF_CANCELLED);
    await webhook.handleStripeEvent(
      signedEvent(stripe, 'refund.updated', { id: 're_late', status: 'canceled' }).request,
    );
    expect(
      (await prisma.refund.findUniqueOrThrow({ where: { paymentId: viaHook.id } })).status,
    ).toBe('FAILED');

    const subjects = (await prisma.outboxEvent.findMany()).map((e) => e.subject);
    expect(subjects).toEqual(['payment.refund.failed', 'payment.refund.failed']);
  });

  it('a refund for an unpaid payment is poison', async () => {
    const payment = await seedPayment('PENDING');
    await expect(refunds.refund(payment.id, RefundReason.STAFF_CANCELLED)).rejects.toBeInstanceOf(
      PoisonMessage,
    );
    await expect(refunds.refund(newId(), RefundReason.STAFF_CANCELLED)).rejects.toBeInstanceOf(
      PoisonMessage,
    );
    expect(await prisma.refund.count()).toBe(0);
  });

  it('a refund never trips payments_one_pending_per_order', async () => {
    const payment = await seedPayment();
    await refunds.refund(payment.id, RefundReason.STAFF_CANCELLED);
    await expect(
      prisma.payment.create({
        data: {
          id: newId(),
          orderId: payment.orderId,
          userId: payment.userId,
          amountVnd: 50_000,
          provider: 'STRIPE',
          status: 'PENDING',
          idempotencyKey: newId(),
          requestHash: 'x'.repeat(64),
        },
      }),
    ).resolves.toBeDefined();
  });

  it('the refund status and reason CHECKs refuse a bad value', async () => {
    const payment = await seedPayment();
    const base = {
      id: newId(),
      paymentId: payment.id,
      orderId: payment.orderId,
      amountVnd: 50_000,
    };
    await expect(prisma.refund.create({ data: { ...base, reason: 'BECAUSE' } })).rejects.toThrow();
    await expect(
      prisma.refund.create({ data: { ...base, reason: 'STAFF_CANCELLED', status: 'MAYBE' } }),
    ).rejects.toThrow();
  });
});
