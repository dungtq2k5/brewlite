import { describe, expect, it } from 'vitest';
import { PaymentMethod } from '@brewlite/contracts';
import { toPaymentMethod } from './payment-method.js';

describe('toPaymentMethod', () => {
  it.each([
    [{ type: 'card', card: { wallet: null } }, PaymentMethod.CARD],
    [{ type: 'card', card: {} }, PaymentMethod.CARD],
    [{ type: 'card', card: { wallet: { type: 'google_pay' } } }, PaymentMethod.GOOGLE_PAY],
    [{ type: 'card', card: { wallet: { type: 'apple_pay' } } }, PaymentMethod.APPLE_PAY],
    [{ type: 'card', card: { wallet: { type: 'samsung_pay' } } }, PaymentMethod.CARD],
    [{ type: 'link' }, PaymentMethod.LINK],
    [{ type: 'us_bank_account' }, PaymentMethod.OTHER],
    [null, PaymentMethod.OTHER],
    [undefined, PaymentMethod.OTHER],
  ])('%j → %s', (details, expected) => {
    expect(toPaymentMethod(details)).toBe(expected);
  });
});
