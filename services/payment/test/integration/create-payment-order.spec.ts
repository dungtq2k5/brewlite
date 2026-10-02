import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { newId, PaymentProvider as ProviderKind, Role } from '@brewlite/contracts';
import type { Caller } from '@brewlite/nest-common';
import { envSchema } from '../../src/config/env.schema.js';
import { PaymentsModule } from '../../src/modules/payments/payments.module.js';
import { PaymentsService } from '../../src/modules/payments/payments.service.js';
import { OrderingGrpcClient } from '../../src/modules/payments/ordering-grpc.client.js';
import { PAYMENT_PROVIDER_TOKEN } from '../../src/providers/payment/payment-provider.interface.js';
import { PrismaModule } from '../../src/modules/prisma/prisma.module.js';
import { prisma } from '../setup/per-file.js';
import { testEnv } from '../setup/env.js';

const caller: Caller = { kind: 'USER', userId: newId(), role: Role.CUSTOMER };

describe('CreatePayment — our row before the provider (conventions §10.2)', () => {
  const startCheckout = vi.fn();
  let app: Awaited<ReturnType<typeof build>>;
  let payments: PaymentsService;

  async function build() {
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
      .useValue({ beginPayment: vi.fn().mockResolvedValue({ orderNo: '1000', totalVnd: '50000' }) })
      .overrideProvider(PAYMENT_PROVIDER_TOKEN)
      .useValue({
        kind: ProviderKind.STRIPE,
        startCheckout,
        readClientSecret: vi.fn().mockResolvedValue('cs_secret'),
        refund: vi.fn(),
      })
      .compile();
    const nest = moduleRef.createNestApplication();
    await nest.init();
    return nest;
  }

  beforeAll(async () => {
    app = await build();
    payments = app.get(PaymentsService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('inserts P-1 before calling the provider, then stores the session id on that row', async () => {
    startCheckout.mockResolvedValueOnce({
      sessionId: 'cs_test_1',
      clientSecret: 'cs_secret',
      expiresAt: new Date(Date.now() + 1_800_000),
    });
    // `update` after the provider call can only succeed if the row was inserted first.
    const result = await payments.createPayment(
      { orderId: newId(), idempotencyKey: newId() },
      caller,
    );
    expect(result.created).toBe(true);
    expect(result.payment?.clientSecret).toBe('cs_secret');
    const row = await prisma.payment.findUniqueOrThrow({ where: { id: result.payment!.id } });
    expect(row.stripeCheckoutSessionId).toBe('cs_test_1');
    expect(row.expiresAt).not.toBeNull();
  });

  it('a provider failure rolls the row back', async () => {
    startCheckout.mockRejectedValueOnce(new Error('stripe down'));
    const orderId = newId();
    await expect(
      payments.createPayment({ orderId, idempotencyKey: newId() }, caller),
    ).rejects.toThrow();
    expect(await prisma.payment.count({ where: { orderId } })).toBe(0);
  });

  it('a replay re-reads the client secret from the session', async () => {
    startCheckout.mockResolvedValueOnce({
      sessionId: 'cs_test_2',
      clientSecret: 'cs_secret',
      expiresAt: null,
    });
    const request = { orderId: newId(), idempotencyKey: newId() };
    await payments.createPayment(request, caller);
    const again = await payments.createPayment(request, caller);
    expect(again.created).toBe(false);
    expect(again.payment?.clientSecret).toBe('cs_secret');
    expect(startCheckout).toHaveBeenCalledTimes(3);
  });
});
