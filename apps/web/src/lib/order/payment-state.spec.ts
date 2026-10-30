import type { PaymentResponseDto } from '@brewlite/api-client';
import { describe, expect, it } from 'vitest';
import { choosePaymentView, type PaymentViewInput } from './payment-state';

const payment = (over: Partial<PaymentResponseDto> = {}): PaymentResponseDto => ({
  id: 'p1',
  orderId: 'o1',
  status: 'PENDING',
  provider: 'STRIPE',
  amountVnd: 51_000,
  method: null,
  clientSecret: 'cs_x',
  expiresAt: null,
  createdAt: '2026-10-30T07:00:00Z',
  ...over,
});

const view = (over: Partial<PaymentViewInput> = {}) =>
  choosePaymentView({
    orderStatus: 'PENDING',
    payment: payment(),
    starting: false,
    startError: null,
    deadlinePassed: false,
    returned: false,
    justConfirmed: false,
    hasStripeKey: true,
    ...over,
  });

describe('choosePaymentView', () => {
  it.each(['PAID', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED'])('no frame for %s', (s) => {
    expect(view({ orderStatus: s, returned: true })).toBe('none');
  });

  it('mounts Stripe for a pending Stripe payment with a secret and a key', () => {
    expect(view()).toBe('stripe');
  });

  it('is unavailable when Stripe has no secret or no publishable key', () => {
    expect(view({ payment: payment({ clientSecret: null }) })).toBe('unavailable');
    expect(view({ hasStripeKey: false })).toBe('unavailable');
  });

  it('shows the fake provider without needing a Stripe key', () => {
    expect(
      view({ payment: payment({ provider: 'FAKE', clientSecret: null }), hasStripeKey: false }),
    ).toBe('fake');
  });

  it('loads while starting or before there is a payment', () => {
    expect(view({ payment: null })).toBe('loading');
    expect(view({ starting: true, payment: null })).toBe('loading');
  });

  it('confirms on a return from Stripe, a just-simulated success, or a succeeded payment', () => {
    expect(view({ returned: true })).toBe('confirming');
    expect(view({ justConfirmed: true, payment: payment({ provider: 'FAKE' }) })).toBe(
      'confirming',
    );
    expect(view({ payment: payment({ status: 'SUCCEEDED' }) })).toBe('confirming');
    expect(view({ orderStatus: 'PAYMENT_FAILED', returned: true })).toBe('confirming');
  });

  it('separates a failed payment from a closed session after PAYMENT_FAILED', () => {
    expect(view({ orderStatus: 'PAYMENT_FAILED', payment: payment({ status: 'FAILED' }) })).toBe(
      'failed',
    );
    expect(view({ orderStatus: 'PAYMENT_FAILED', payment: payment({ status: 'EXPIRED' }) })).toBe(
      'closed',
    );
  });

  it('a passed deadline or a refused start beats the payment, but not confirming', () => {
    expect(view({ deadlinePassed: true })).toBe('notPayable');
    expect(view({ startError: 'notPayable', payment: null })).toBe('notPayable');
    expect(view({ startError: 'unavailable', payment: null })).toBe('unavailable');
    expect(view({ deadlinePassed: true, returned: true })).toBe('confirming');
  });
});
