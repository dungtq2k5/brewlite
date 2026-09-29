import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newId, OrderStatus } from '@brewlite/contracts';
import { envSchema } from '../../src/config/env.schema.js';
import { OrdersModule } from '../../src/modules/orders/orders.module.js';
import { PrismaModule } from '../../src/modules/prisma/prisma.module.js';
import { OrdersExpireJob } from '../../src/jobs/orders-expire.job.js';
import { prisma } from '../setup/per-file.js';
import { testEnv } from '../setup/env.js';

async function buildModule() {
  const configModule = ConfigModule.forRoot({
    isGlobal: true,
    validate: () =>
      envSchema.parse({
        ...testEnv,
        DATABASE_URL: testEnv.DATABASE_URL_TEST,
      }),
  });
  const moduleRef = await Test.createTestingModule({
    imports: [configModule, PrismaModule, OrdersModule],
    providers: [OrdersExpireJob],
  }).compile();
  const app = moduleRef.createNestApplication();
  await app.init();
  return app;
}

async function seedOrder(status: OrderStatus, expiresAt: Date) {
  return prisma.order.create({
    data: {
      id: newId(),
      userId: newId(),
      status,
      subtotalVnd: 20_000,
      totalVnd: 20_000,
      idempotencyKey: newId(),
      requestHash: 'x'.repeat(64),
      expiresAt,
    },
  });
}

describe('OrdersExpireJob', () => {
  let app: Awaited<ReturnType<typeof buildModule>>;
  let job: OrdersExpireJob;

  beforeAll(async () => {
    app = await buildModule();
    job = app.get(OrdersExpireJob);
  });

  afterAll(async () => {
    await app.close();
  });

  it('expires only past-deadline unpaid orders, writing history and one outbox row', async () => {
    const now = new Date();
    const expired = await seedOrder(OrderStatus.PENDING, new Date(now.getTime() - 1000));
    const notYet = await seedOrder(OrderStatus.PENDING, new Date(now.getTime() + 900_000));
    const alreadyPaid = await seedOrder(OrderStatus.PAID, new Date(now.getTime() - 1000));

    await job.run(now);

    const expiredRow = await prisma.order.findUniqueOrThrow({ where: { id: expired.id } });
    expect(expiredRow.status).toBe(OrderStatus.CANCELLED);
    expect(expiredRow.cancelReason).toBe('EXPIRED');

    const history = await prisma.orderStatusHistory.findMany({ where: { orderId: expired.id } });
    expect(history).toHaveLength(1);
    expect(history[0]?.actorType).toBe('SYSTEM');

    const outboxRows = await prisma.outboxEvent.findMany({ where: { aggregateId: expired.id } });
    expect(outboxRows).toHaveLength(1);

    const notYetRow = await prisma.order.findUniqueOrThrow({ where: { id: notYet.id } });
    expect(notYetRow.status).toBe(OrderStatus.PENDING);

    const paidRow = await prisma.order.findUniqueOrThrow({ where: { id: alreadyPaid.id } });
    expect(paidRow.status).toBe(OrderStatus.PAID);
  });

  it('an order whose deadline was already pushed forward by a payment attempt is left alone', async () => {
    // `transition()`'s own concurrent-tap race is proven directly in
    // orders-transition.spec.ts; this confirms orders-expire never touches a row once its
    // expiresAt has moved past `now`, whichever side of the race wrote it last.
    const now = new Date();
    const order = await seedOrder(OrderStatus.PENDING, new Date(now.getTime() - 1000));

    await prisma.order.update({
      where: { id: order.id },
      data: { expiresAt: new Date(now.getTime() + 900_000) },
    });

    await job.run(now);

    const row = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(row.status).toBe(OrderStatus.PENDING);
  });
});
