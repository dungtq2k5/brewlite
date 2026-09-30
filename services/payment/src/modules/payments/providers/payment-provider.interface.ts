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

/** Two implementations once 08 lands — `StripePaymentProvider` is the only file that will import `stripe` (conventions §10.2). */
export interface PaymentProvider {
  readonly kind: PaymentProviderKind;
  startCheckout(input: StartCheckoutInput): Promise<StartCheckoutResult>;
}

export const PAYMENT_PROVIDER_TOKEN = Symbol('PAYMENT_PROVIDER_TOKEN');
