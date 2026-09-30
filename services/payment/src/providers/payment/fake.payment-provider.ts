import { Injectable } from '@nestjs/common';
import { PaymentProvider as PaymentProviderKind } from '@brewlite/contracts';
import type {
  PaymentProvider,
  StartCheckoutInput,
  StartCheckoutResult,
} from './payment-provider.interface.js';

/** Nothing to start — the page shows the two simulate buttons. */
@Injectable()
export class FakePaymentProvider implements PaymentProvider {
  readonly kind = PaymentProviderKind.FAKE;

  async startCheckout(_input: StartCheckoutInput): Promise<StartCheckoutResult> {
    return { sessionId: null, clientSecret: null, expiresAt: null };
  }
}
