import type { Metadata } from '@grpc/grpc-js';
import type { RpcException } from '@nestjs/microservices';
import { describe, expect, it, vi } from 'vitest';
import { CHECKOUT_SESSION_TTL_MS, newId } from '@brewlite/contracts';
import { StripePaymentProvider } from './stripe.payment-provider.js';

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
