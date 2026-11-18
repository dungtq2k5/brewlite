import type { Metadata } from '@grpc/grpc-js';
import type { RpcException } from '@nestjs/microservices';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { newId, Role } from '@brewlite/contracts';
import type { Caller } from '@brewlite/nest-common';
import { PaymentsService } from '../../src/modules/payments/payments.service.js';
import { prisma } from '../setup/per-file.js';
import { buildStripeApp, buildStripeStub } from '../support/stripe-app.js';

function codeOf(exception: unknown): string | undefined {
  if (!(exception && typeof exception === 'object' && 'getError' in exception)) return undefined;
  const { metadata } = (exception as RpcException).getError() as { metadata: Metadata };
  return metadata.get('bl-error-code')[0] as string | undefined;
}

const caller: Caller = { kind: 'USER', userId: newId(), role: Role.CUSTOMER };

async function seedPayment(overrides: Partial<Record<string, unknown>> = {}) {
  return prisma.payment.create({
    data: {
      id: newId(),
      orderId: newId(),
      userId: caller.kind === 'USER' ? caller.userId : '',
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

describe('PaymentsService.getPayment — real DB, Stripe stubbed', () => {
  const { stripe, calls } = buildStripeStub();
  let app: Awaited<ReturnType<typeof buildStripeApp>>;
  let payments: PaymentsService;

  beforeAll(async () => {
    app = await buildStripeApp(stripe);
    payments = app.get(PaymentsService);
  });

  beforeEach(() => {
    calls.retrieveSession.mockClear();
  });

  afterAll(async () => {
    await app.close();
  });

  it('a PENDING Stripe payment carries its client secret, RE-READ from the session', async () => {
    const payment = await seedPayment();
    const { payment: read } = await payments.getPayment({ id: payment.id }, caller);
    expect(read).toMatchObject({ id: payment.id, status: 'PENDING', clientSecret: 'cs_secret' });
    expect(calls.retrieveSession).toHaveBeenCalledWith(payment.stripeCheckoutSessionId);
  });

  it('a settled payment has no client secret, and Stripe is not asked', async () => {
    const payment = await seedPayment({
      status: 'SUCCEEDED',
      method: 'CARD',
      succeededAt: new Date(),
    });
    const { payment: read } = await payments.getPayment({ id: payment.id }, caller);
    expect(read).toMatchObject({ status: 'SUCCEEDED', method: 'CARD' });
    expect(read?.clientSecret).toBeUndefined();
    expect(calls.retrieveSession).not.toHaveBeenCalled();
  });

  it('a PENDING payment without a session (the fake provider) has no client secret', async () => {
    const payment = await seedPayment({ provider: 'FAKE', stripeCheckoutSessionId: null });
    const { payment: read } = await payments.getPayment({ id: payment.id }, caller);
    expect(read?.clientSecret).toBeUndefined();
    expect(calls.retrieveSession).not.toHaveBeenCalled();
  });

  it("another user's payment is RESOURCE_NOT_FOUND, as is one that does not exist", async () => {
    const theirs = await seedPayment({ userId: newId() });
    for (const id of [theirs.id, newId()]) {
      const error = await payments.getPayment({ id }, caller).catch((e: unknown) => e);
      expect(codeOf(error)).toBe('RESOURCE_NOT_FOUND');
    }
    expect(calls.retrieveSession).not.toHaveBeenCalled();
  });
});
