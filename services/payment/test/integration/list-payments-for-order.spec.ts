import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { newId } from '@brewlite/contracts';
import { envSchema } from '../../src/config/env.schema.js';
import { OrderingGrpcClient } from '../../src/modules/payments/ordering-grpc.client.js';
import { PaymentsModule } from '../../src/modules/payments/payments.module.js';
import { PaymentsService } from '../../src/modules/payments/payments.service.js';
import { PrismaModule } from '../../src/modules/prisma/prisma.module.js';
import { prisma } from '../setup/per-file.js';
import { testEnv } from '../setup/env.js';

async function buildModule() {
  const configModule = ConfigModule.forRoot({
    isGlobal: true,
    validate: () =>
      envSchema.parse({
        ...testEnv,
        DATABASE_URL: testEnv.DATABASE_URL_TEST,
        NODE_ENV: 'development',
      }),
  });
  const moduleRef = await Test.createTestingModule({
    imports: [configModule, PrismaModule, PaymentsModule],
  })
    .overrideProvider(OrderingGrpcClient)
    .useValue({ beginPayment: vi.fn() })
    .compile();
  const app = moduleRef.createNestApplication();
  await app.init();
  return app;
}

const seedPayment = (orderId: string, overrides: Record<string, unknown> = {}) =>
  prisma.payment.create({
    data: {
      id: newId(),
      orderId,
      userId: newId(), // not the admin's — the list has no ownership scope
      amountVnd: 50_000,
      provider: 'STRIPE',
      status: 'PENDING',
      idempotencyKey: newId(),
      requestHash: 'x'.repeat(64),
      stripeCheckoutSessionId: `cs_test_${newId()}`,
      ...overrides,
    },
  });

describe('PaymentsService.listPaymentsForOrder', () => {
  let app: Awaited<ReturnType<typeof buildModule>>;
  let payments: PaymentsService;

  beforeAll(async () => {
    app = await buildModule();
    payments = app.get(PaymentsService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns every payment of the order, newest first, whoever made them', async () => {
    const orderId = newId();
    const first = await seedPayment(orderId, { status: 'FAILED', failureReason: 'ASYNC_FAILED' });
    const second = await seedPayment(orderId, {
      status: 'SUCCEEDED',
      method: 'CARD',
      succeededAt: new Date(),
    });
    await seedPayment(newId()); // another order's

    const { payments: listed } = await payments.listPaymentsForOrder({ orderId });
    expect(listed.map((p) => p.id)).toEqual([second.id, first.id]);
    expect(listed[0]).toMatchObject({ orderId, status: 'SUCCEEDED', amountVnd: '50000' });
  });

  it('never carries a client secret — not even for a PENDING Stripe payment', async () => {
    const orderId = newId();
    await seedPayment(orderId, { status: 'PENDING' });
    const { payments: listed } = await payments.listPaymentsForOrder({ orderId });
    expect(listed).toHaveLength(1);
    expect(listed[0]!.clientSecret).toBeUndefined();
  });

  it('is an empty list for an order with none, not an error', async () => {
    expect(await payments.listPaymentsForOrder({ orderId: newId() })).toEqual({ payments: [] });
  });
});
