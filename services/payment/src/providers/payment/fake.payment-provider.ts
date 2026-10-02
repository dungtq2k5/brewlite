import { Injectable } from '@nestjs/common';
import { PaymentProvider as PaymentProviderKind } from '@brewlite/contracts';
import type {
  PaymentProvider,
  RefundInput,
  RefundResult,
  StartCheckoutInput,
  StartCheckoutResult,
} from './payment-provider.interface.js';

/** Nothing to start — the page shows the two simulate buttons; a refund succeeds at once. */
@Injectable()
export class FakePaymentProvider implements PaymentProvider {
  readonly kind = PaymentProviderKind.FAKE;

  async startCheckout(_input: StartCheckoutInput): Promise<StartCheckoutResult> {
    return { sessionId: null, clientSecret: null, expiresAt: null };
  }

  async readClientSecret(_sessionId: string): Promise<string | null> {
    return null;
  }

  async refund(_input: RefundInput): Promise<RefundResult> {
    return { stripeRefundId: null, status: 'SUCCEEDED' };
  }
}
