import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newId, OrderRefundStatus, OrderStatus } from '@brewlite/contracts';
import { envSchema } from '../../src/config/env.schema.js';
import { OrdersModule } from '../../src/modules/orders/orders.module.js';
import { OrdersService } from '../../src/modules/orders/orders.service.js';
import { PrismaModule } from '../../src/modules/prisma/prisma.module.js';
import { prisma } from '../setup/per-file.js';
import { testEnv } from '../setup/env.js';

async function seedCancelled(refundStatus: string) {
  return prisma.order.create({
    data: {
      id: newId(),
      userId: newId(),
      status: OrderStatus.CANCELLED,
      subtotalVnd: 50_000,
      totalVnd: 50_000,
      cancelledAt: new Date(),
      cancelReason: 'STAFF',
      refundStatus,
      idempotencyKey: newId(),
      requestHash: 'x'.repeat(64),
      expiresAt: new Date(Date.now() + 900_000),
    },
  });
}

describe('OrdersService.applyRefundOutcome', () => {
  let app: Awaited<ReturnType<typeof build>>;
  let orders: OrdersService;

  async function build() {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          validate: () => envSchema.parse({ ...testEnv, DATABASE_URL: testEnv.DATABASE_URL_TEST }),
        }),
        PrismaModule,
        OrdersModule,
      ],
    }).compile();
    const nest = moduleRef.createNestApplication();
    await nest.init();
    return nest;
  }

  beforeAll(async () => {
    app = await build();
    orders = app.get(OrdersService);
  });

  afterAll(async () => {
    await app.close();
  });

  const refundStatusOf = async (id: string) =>
    (await prisma.order.findUniqueOrThrow({ where: { id } })).refundStatus;

  it('PENDING → REFUNDED, and a duplicate changes nothing', async () => {
    const order = await seedCancelled('PENDING');
    await orders.applyRefundOutcome(order.id, OrderRefundStatus.REFUNDED);
    await orders.applyRefundOutcome(order.id, OrderRefundStatus.REFUNDED);
    expect(await refundStatusOf(order.id)).toBe('REFUNDED');
  });

  it('PENDING → FAILED, and a late succeeded never overwrites it', async () => {
    const order = await seedCancelled('PENDING');
    await orders.applyRefundOutcome(order.id, OrderRefundStatus.FAILED);
    await orders.applyRefundOutcome(order.id, OrderRefundStatus.REFUNDED);
    expect(await refundStatusOf(order.id)).toBe('FAILED');
  });

  it("a rejected payment's refund leaves an order at NONE alone", async () => {
    const order = await seedCancelled('NONE');
    await orders.applyRefundOutcome(order.id, OrderRefundStatus.REFUNDED);
    expect(await refundStatusOf(order.id)).toBe('NONE');
  });

  it('an unknown order is a no-op', async () => {
    await expect(
      orders.applyRefundOutcome(newId(), OrderRefundStatus.REFUNDED),
    ).resolves.toBeUndefined();
  });
});
