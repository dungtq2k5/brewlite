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
});
