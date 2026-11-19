import type { Metadata } from '@grpc/grpc-js';
import type { RpcException } from '@nestjs/microservices';
import Stripe from 'stripe';
import { describe, expect, it, vi } from 'vitest';
import { CHECKOUT_SESSION_TTL_MS, newId, PaymentMethod } from '@brewlite/contracts';
import { STRIPE_API_VERSION, StripePaymentProvider } from './stripe.payment-provider.js';

function codeOf(exception: unknown): string | undefined {
  if (!(exception && typeof exception === 'object' && 'getError' in exception)) return undefined;
  const { metadata } = (exception as RpcException).getError() as { metadata: Metadata };
  return metadata.get('bl-error-code')[0] as string | undefined;
}

function build(stripe: Record<string, unknown>) {
  return new StripePaymentProvider(stripe as never, 'http://web.test', 'whsec_test');
}

const input = {
  paymentId: newId(),
  orderId: newId(),
  orderNo: '1042',
  amountVnd: 52_200,
  idempotencyKey: newId(),
};

describe('StripePaymentProvider.startCheckout', () => {
  it('sends the đồng total as-is, no payment_method_types, and the request key', async () => {
    const create = vi.fn().mockResolvedValue({
      id: 'cs_test_1',
      client_secret: 'cs_secret',
      expires_at: 1_900_000_000,
    });
    const before = Date.now();
    const result = await build({ checkout: { sessions: { create } } }).startCheckout(input);

    const [params, options] = create.mock.calls[0] as [
      Record<string, unknown> & { expires_at: number; payment_intent_data: { metadata: unknown } },
      { idempotencyKey: string },
    ];
    expect(params.line_items).toEqual([
      {
        quantity: 1,
        price_data: {
          currency: 'vnd',
          unit_amount: 52_200,
          product_data: { name: 'BrewLite order #1042' },
        },
      },
    ]);
    expect(params).not.toHaveProperty('payment_method_types');
    expect(params.mode).toBe('payment');
    expect(params.client_reference_id).toBe(input.paymentId);
    expect(params.metadata).toEqual({ paymentId: input.paymentId, orderId: input.orderId });
    expect(params.payment_intent_data.metadata).toEqual(params.metadata);
    expect(params.return_url).toBe(
      `http://web.test/orders/${input.orderId}?payment=${input.paymentId}`,
    );
    expect(params.expires_at * 1000).toBeGreaterThanOrEqual(
      before + CHECKOUT_SESSION_TTL_MS - 1_000,
    );
    expect(options).toEqual({ idempotencyKey: input.idempotencyKey });
    expect(result).toEqual({
      sessionId: 'cs_test_1',
      clientSecret: 'cs_secret',
      expiresAt: new Date(1_900_000_000_000),
    });
  });

  it.each(['StripeConnectionError', 'StripeAPIError'])(
    'a %s is PAYMENT_PROVIDER_UNAVAILABLE',
    async (type) => {
      const create = vi.fn().mockRejectedValue(Object.assign(new Error('x'), { type }));
      const error = await build({ checkout: { sessions: { create } } })
        .startCheckout(input)
        .catch((e: unknown) => e);
      expect(codeOf(error)).toBe('PAYMENT_PROVIDER_UNAVAILABLE');
    },
  );

  it('a 4xx from Stripe is our bug — rethrown, not reported as unavailable', async () => {
    const create = vi.fn().mockRejectedValue(
      Object.assign(new Error('bad amount'), {
        type: 'StripeInvalidRequestError',
        statusCode: 400,
      }),
    );
    const error = await build({ checkout: { sessions: { create } } })
      .startCheckout(input)
      .catch((e: unknown) => e);
    expect(codeOf(error)).toBeUndefined();
    expect((error as Error).message).toBe('bad amount');
  });
});

describe('a Stripe that never answers', () => {
  it('is PAYMENT_PROVIDER_UNAVAILABLE after our own deadline, not a hang', async () => {
    vi.useFakeTimers();
    try {
      const create = vi.fn().mockReturnValue(new Promise(() => {}));
      const pending = build({ checkout: { sessions: { create } } })
        .startCheckout(input)
        .catch((e: unknown) => e);
      await vi.advanceTimersByTimeAsync(6_001);
      expect(codeOf(await pending)).toBe('PAYMENT_PROVIDER_UNAVAILABLE');
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('StripePaymentProvider.readClientSecret / refund', () => {
  it('returns the secret of an open session and null for a closed one', async () => {
    const retrieve = vi
      .fn()
      .mockResolvedValueOnce({ status: 'open', client_secret: 'cs_secret' })
      .mockResolvedValueOnce({ status: 'expired', client_secret: 'cs_secret' });
    const provider = build({ checkout: { sessions: { retrieve } } });
    expect(await provider.readClientSecret('cs_1')).toBe('cs_secret');
    expect(await provider.readClientSecret('cs_1')).toBeNull();
  });

  it('a Stripe that cannot be reached while reading the secret is PAYMENT_PROVIDER_UNAVAILABLE', async () => {
    const retrieve = vi
      .fn()
      .mockRejectedValue(Object.assign(new Error('x'), { type: 'StripeConnectionError' }));
    const error = await build({ checkout: { sessions: { retrieve } } })
      .readClientSecret('cs_1')
      .catch((e: unknown) => e);
    expect(codeOf(error)).toBe('PAYMENT_PROVIDER_UNAVAILABLE');
  });

  it('refunds the full amount with the refund row id as idempotency key', async () => {
    const create = vi.fn().mockResolvedValue({ id: 're_1', status: 'succeeded' });
    const result = await build({ refunds: { create } }).refund({
      refundId: 'refund-row-id',
      paymentIntentId: 'pi_1',
      amountVnd: 52_200,
    });
    expect(create).toHaveBeenCalledWith(
      { payment_intent: 'pi_1', amount: 52_200 },
      { idempotencyKey: 'refund-row-id' },
    );
    expect(result).toEqual({ stripeRefundId: 're_1', status: 'SUCCEEDED' });
  });

  it.each([
    ['pending', 'PENDING'],
    ['failed', 'FAILED'],
    ['canceled', 'FAILED'],
  ])('a %s refund is %s', async (stripeStatus, expected) => {
    const create = vi.fn().mockResolvedValue({ id: 're_2', status: stripeStatus });
    const result = await build({ refunds: { create } }).refund({
      refundId: 'r',
      paymentIntentId: 'pi_1',
      amountVnd: 10_000,
    });
    expect(result.status).toBe(expected);
  });
});

describe('StripePaymentProvider.refund — failures', () => {
  it('sends no payment_intent when the payment has none', async () => {
    const create = vi.fn().mockResolvedValue({ id: 're_3', status: 'succeeded' });
    await build({ refunds: { create } }).refund({
      refundId: 'r',
      paymentIntentId: null,
      amountVnd: 10_000,
    });
    expect(create).toHaveBeenCalledWith(
      { payment_intent: undefined, amount: 10_000 },
      { idempotencyKey: 'r' },
    );
  });

  it('a Stripe that cannot be reached is PAYMENT_PROVIDER_UNAVAILABLE', async () => {
    const create = vi
      .fn()
      .mockRejectedValue(Object.assign(new Error('x'), { type: 'StripeRateLimitError' }));
    const error = await build({ refunds: { create } })
      .refund({ refundId: 'r', paymentIntentId: 'pi_1', amountVnd: 10_000 })
      .catch((e: unknown) => e);
    expect(codeOf(error)).toBe('PAYMENT_PROVIDER_UNAVAILABLE');
  });

  it('a rejection that is not an Error is still rethrown as an Error', async () => {
    const create = vi.fn().mockRejectedValue('socket hang up');
    const error = await build({ refunds: { create } })
      .refund({ refundId: 'r', paymentIntentId: 'pi_1', amountVnd: 10_000 })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe('socket hang up');
    expect(codeOf(error)).toBeUndefined();
  });
});

describe('StripePaymentProvider.readPaymentMethod', () => {
  it('reads the method from the expanded latest charge', async () => {
    const retrieve = vi.fn().mockResolvedValue({
      latest_charge: {
        payment_method_details: { type: 'card', card: { wallet: { type: 'google_pay' } } },
      },
    });
    expect(await build({ paymentIntents: { retrieve } }).readPaymentMethod('pi_1')).toBe(
      PaymentMethod.GOOGLE_PAY,
    );
    expect(retrieve).toHaveBeenCalledWith('pi_1', { expand: ['latest_charge'] });
  });

  it('a charge left unexpanded (an id) is OTHER, not a crash', async () => {
    const retrieve = vi.fn().mockResolvedValue({ latest_charge: 'ch_1' });
    expect(await build({ paymentIntents: { retrieve } }).readPaymentMethod('pi_1')).toBe(
      PaymentMethod.OTHER,
    );
  });

  it('a Stripe that cannot be reached is PAYMENT_PROVIDER_UNAVAILABLE', async () => {
    const retrieve = vi
      .fn()
      .mockRejectedValue(Object.assign(new Error('x'), { type: 'StripeConnectionError' }));
    const error = await build({ paymentIntents: { retrieve } })
      .readPaymentMethod('pi_1')
      .catch((e: unknown) => e);
    expect(codeOf(error)).toBe('PAYMENT_PROVIDER_UNAVAILABLE');
  });
});

describe('StripePaymentProvider.verifyEvent — signed by the real SDK, nothing leaves the machine', () => {
  const secret = 'whsec_test';
  const stripe = new Stripe('rk_test_unused', { apiVersion: STRIPE_API_VERSION });
  const provider = new StripePaymentProvider(stripe, 'http://web.test', secret);

  function verify(type: string, object: Record<string, unknown>) {
    const payload = JSON.stringify({ id: 'evt_1', object: 'event', type, data: { object } });
    const signature = stripe.webhooks.generateTestHeaderString({ payload, secret });
    return provider.verifyEvent(Buffer.from(payload), signature);
  }

  it.each([
    ['an id', 'pi_1', 'pi_1'],
    ['an expanded object', { id: 'pi_2' }, 'pi_2'],
    ['absent', null, null],
  ])('reads the payment intent when it is %s', (_label, paymentIntent, expected) => {
    expect(
      verify('checkout.session.completed', {
        id: 'cs_1',
        payment_status: 'paid',
        payment_intent: paymentIntent,
      }),
    ).toEqual({
      id: 'evt_1',
      type: 'checkout.session',
      name: 'checkout.session.completed',
      sessionId: 'cs_1',
      paid: true,
      paymentIntentId: expected,
    });
  });

  it('an UNPAID session is not paid; no_payment_required counts as paid', () => {
    const unpaid = { id: 'cs_1', payment_status: 'unpaid', payment_intent: null };
    expect(verify('checkout.session.completed', unpaid)).toMatchObject({ paid: false });
    expect(
      verify('checkout.session.async_payment_failed', {
        ...unpaid,
        payment_status: 'no_payment_required',
      }),
    ).toMatchObject({ paid: true, name: 'checkout.session.async_payment_failed' });
  });

  it('a refund.updated carries the refund id and status; a missing status is pending', () => {
    expect(verify('refund.updated', { id: 're_1', status: 'failed' })).toEqual({
      id: 'evt_1',
      type: 'refund',
      name: 'refund.updated',
      stripeRefundId: 're_1',
      status: 'failed',
    });
    expect(verify('refund.updated', { id: 're_1', status: null })).toMatchObject({
      status: 'pending',
    });
  });

  it('any other type is other', () => {
    expect(verify('customer.created', { id: 'cus_1' })).toEqual({
      id: 'evt_1',
      type: 'other',
      name: 'customer.created',
    });
  });

  it('a signature from another secret is WEBHOOK_SIGNATURE_INVALID', () => {
    const payload = JSON.stringify({ id: 'evt_1', object: 'event', type: 'customer.created' });
    const signature = stripe.webhooks.generateTestHeaderString({
      payload,
      secret: 'whsec_other',
    });
    let error: unknown;
    try {
      provider.verifyEvent(Buffer.from(payload), signature);
    } catch (e) {
      error = e;
    }
    expect(codeOf(error)).toBe('WEBHOOK_SIGNATURE_INVALID');
  });
});
