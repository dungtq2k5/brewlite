import { PaymentMethod } from '@brewlite/contracts';

/** The slice of a Stripe charge's `payment_method_details` this mapping reads. */
export interface PaymentMethodDetails {
  type?: string;
  card?: { wallet?: { type?: string } | null } | null;
}

/** rdm-spec P-1 `method` — a wallet is a card underneath, so its wallet type wins. */
export function toPaymentMethod(details: PaymentMethodDetails | null | undefined): PaymentMethod {
  if (!details) return PaymentMethod.OTHER;
  if (details.type === 'card') {
    switch (details.card?.wallet?.type) {
      case 'google_pay':
        return PaymentMethod.GOOGLE_PAY;
      case 'apple_pay':
        return PaymentMethod.APPLE_PAY;
      default:
        return PaymentMethod.CARD;
    }
  }
  if (details.type === 'link') return PaymentMethod.LINK;
  return PaymentMethod.OTHER;
}
