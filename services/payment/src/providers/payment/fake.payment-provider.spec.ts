import { describe, expect, it } from 'vitest';
import { PaymentProvider as PaymentProviderKind } from '@brewlite/contracts';
import { FakePaymentProvider } from './fake.payment-provider.js';

describe('FakePaymentProvider', () => {
  it('returns three nulls — there is nothing to start', async () => {
    const provider = new FakePaymentProvider();
    expect(provider.kind).toBe(PaymentProviderKind.FAKE);

    const result = await provider.startCheckout({
      paymentId: 'p1',
      orderId: 'o1',
      orderNo: '1001',
      amountVnd: 50_000,
      idempotencyKey: 'k1',
    });

    expect(result).toEqual({ sessionId: null, clientSecret: null, expiresAt: null });
  });

  it('has no client secret to read, and a refund succeeds at once with no provider id', async () => {
    const provider = new FakePaymentProvider();
    expect(await provider.readClientSecret('cs_any')).toBeNull();
    expect(
      await provider.refund({ refundId: 'r1', paymentIntentId: null, amountVnd: 50_000 }),
    ).toEqual({ stripeRefundId: null, status: 'SUCCEEDED' });
  });
});
