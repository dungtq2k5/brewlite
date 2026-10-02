import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import Stripe from 'stripe';
import { vi } from 'vitest';
import { newId } from '@brewlite/contracts';
import { envSchema } from '../../src/config/env.schema.js';
import { PaymentsModule } from '../../src/modules/payments/payments.module.js';
import { PrismaModule } from '../../src/modules/prisma/prisma.module.js';
import { OrderingGrpcClient } from '../../src/modules/payments/ordering-grpc.client.js';
import { PAYMENT_PROVIDER_TOKEN } from '../../src/providers/payment/payment-provider.interface.js';
import { StripePaymentProvider } from '../../src/providers/payment/stripe.payment-provider.js';
import { testEnv } from '../setup/env.js';

export const WEBHOOK_SECRET = 'whsec_test_secret';

/**
 * A real `Stripe` instance — so the real signature verification runs — with only the calls
 * that would leave the machine replaced. No test calls Stripe (architecture §8).
 */
export function buildStripeStub() {
  const stripe = new Stripe('rk_test_unused', { apiVersion: '2026-08-26.dahlia' });
  const calls = {
    retrieveIntent: vi.fn().mockResolvedValue({
      latest_charge: { payment_method_details: { type: 'card', card: { wallet: null } } },
    }),
    createRefund: vi.fn().mockResolvedValue({ id: 're_test_1', status: 'succeeded' }),
    retrieveSession: vi.fn().mockResolvedValue({ status: 'open', client_secret: 'cs_secret' }),
    createSession: vi
      .fn()
      .mockResolvedValue({ id: 'cs_test', client_secret: 'cs_secret', expires_at: 1_900_000_000 }),
  };
  Object.assign(stripe.paymentIntents, { retrieve: calls.retrieveIntent });
  Object.assign(stripe.refunds, { create: calls.createRefund });
  Object.assign(stripe.checkout.sessions, {
    retrieve: calls.retrieveSession,
    create: calls.createSession,
  });
  return { stripe, calls };
}

export async function buildStripeApp(stripe: Stripe) {
  const moduleRef = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        validate: () => envSchema.parse({ ...testEnv, DATABASE_URL: testEnv.DATABASE_URL_TEST }),
      }),
      PrismaModule,
      PaymentsModule,
    ],
  })
    .overrideProvider(OrderingGrpcClient)
    .useValue({ beginPayment: vi.fn().mockResolvedValue({ orderNo: '1042', totalVnd: '50000' }) })
    .overrideProvider(PAYMENT_PROVIDER_TOKEN)
    .useValue(new StripePaymentProvider(stripe, 'http://web.test', WEBHOOK_SECRET))
    .compile();
  const app = moduleRef.createNestApplication();
  await app.init();
  return app;
}

/** A signed webhook delivery, exactly as Stripe would send it. */
export function signedEvent(
  stripe: Stripe,
  type: string,
  object: Record<string, unknown>,
  id = `evt_${newId()}`,
) {
  const payload = JSON.stringify({ id, object: 'event', type, data: { object } });
  const signature = stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET });
  return { id, request: { payload: Buffer.from(payload), signature } };
}
