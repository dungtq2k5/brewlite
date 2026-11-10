import type { OrderResponseDto, PaymentResponseDto } from '@brewlite/api-client';

/** Which of the payment frame's states the order page shows (the table of §4.3). */
export type PaymentView =
  | 'none' // the order is not waiting for payment — no frame
  | 'confirming'
  | 'notPayable'
  | 'unavailable'
  | 'closed'
  | 'failed'
  | 'loading'
  | 'stripe'
  | 'fake';

export interface PaymentViewInput {
  orderStatus: OrderResponseDto['status'];
  payment: PaymentResponseDto | null;
  /** `startPayment` is in flight. */
  starting: boolean;
  /** `startPayment` was refused with PAYMENT_PROVIDER_UNAVAILABLE. */
  startError: 'unavailable' | 'notPayable' | null;
  deadlinePassed: boolean;
  /** The URL carries `?payment=` — Stripe sent the customer back. */
  returned: boolean;
  /** *Simulate success* was just tapped. */
  justConfirmed: boolean;
  /** The Stripe publishable key is configured on this device. */
  hasStripeKey: boolean;
}

const PAYABLE = new Set(['PENDING', 'PAYMENT_FAILED']);

/**
 * The browser never decides that a payment worked (§4.5): *confirming* is shown while the order is
 * still unpaid and any sign says the money may be on its way; the stream brings the real status.
 */
export function choosePaymentView(i: PaymentViewInput): PaymentView {
  if (!PAYABLE.has(i.orderStatus)) return 'none';
  if (i.returned || i.justConfirmed || i.payment?.status === 'SUCCEEDED') return 'confirming';
  if (i.startError === 'notPayable' || i.deadlinePassed) return 'notPayable';
  if (i.startError === 'unavailable') return 'unavailable';
  if (i.orderStatus === 'PAYMENT_FAILED') {
    return i.payment?.status === 'EXPIRED' ? 'closed' : 'failed';
  }
  if (i.starting || !i.payment) return 'loading';
  if (i.payment.provider === 'FAKE') return 'fake';
  if (i.payment.status !== 'PENDING') return 'loading';
  return i.payment.clientSecret && i.hasStripeKey ? 'stripe' : 'unavailable';
}
