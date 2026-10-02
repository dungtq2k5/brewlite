import type { PaymentProvider as PaymentProviderKind } from '@brewlite/contracts';

export interface StartCheckoutInput {
  paymentId: string;
  orderId: string;
  orderNo: string;
  amountVnd: number;
  idempotencyKey: string;
}

export interface StartCheckoutResult {
  sessionId: string | null;
  clientSecret: string | null;
  expiresAt: Date | null;
}

export interface RefundInput {
  /** The refund row's id — also the provider's idempotency key, so a retry never refunds twice. */
  refundId: string;
  paymentIntentId: string | null;
  amountVnd: number;
}

export interface RefundResult {
  stripeRefundId: string | null;
  status: 'SUCCEEDED' | 'PENDING' | 'FAILED';
}

/** Two implementations — `StripePaymentProvider` is the only file that imports `stripe` (conventions §10.2). */
export interface PaymentProvider {
  readonly kind: PaymentProviderKind;
  startCheckout(input: StartCheckoutInput): Promise<StartCheckoutResult>;
  /** A stored payment never holds its client secret — a replay re-reads it. `null` once the session is no longer open. */
  readClientSecret(sessionId: string): Promise<string | null>;
  refund(input: RefundInput): Promise<RefundResult>;
}

export const PAYMENT_PROVIDER_TOKEN = Symbol('PAYMENT_PROVIDER_TOKEN');
