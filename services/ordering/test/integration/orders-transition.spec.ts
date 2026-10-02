import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { Metadata } from '@grpc/grpc-js';
import type { RpcException } from '@nestjs/microservices';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { canTransition, newId, OrderActorType, OrderStatus } from '@brewlite/contracts';
import { envSchema } from '../../src/config/env.schema.js';
import { OrdersModule } from '../../src/modules/orders/orders.module.js';
import { OrdersService } from '../../src/modules/orders/orders.service.js';
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
      }),
  });
  const moduleRef = await Test.createTestingModule({
    imports: [configModule, PrismaModule, OrdersModule],
  }).compile();
  const app = moduleRef.createNestApplication();
  await app.init();
  return app;
}

function errorCodeOf(exception: unknown): string | undefined {
  if (!(exception && typeof exception === 'object' && 'getError' in exception)) return undefined;
  const { metadata } = (exception as RpcException).getError() as { metadata: Metadata };
  return metadata.get('bl-error-code')[0] as string | undefined;
}

async function seedOrder(status: OrderStatus) {
  return prisma.order.create({
    data: {
      id: newId(),
      userId: newId(),
      status,
      subtotalVnd: 20_000,
      totalVnd: 20_000,
      idempotencyKey: newId(),
      requestHash: 'x'.repeat(64),
      expiresAt: new Date(Date.now() + 900_000),
      ...(status === OrderStatus.CANCELLED && {
        cancelledAt: new Date(),
        cancelReason: 'CUSTOMER',
      }),
    },
  });
}

describe('OrdersService.transition', () => {
  let app: Awaited<ReturnType<typeof buildModule>>;
  let orders: OrdersService;

  beforeAll(async () => {
    app = await buildModule();
    orders = app.get(OrdersService);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('proof (a): refuses an ILLEGAL transition, over every pair not in ORDER_TRANSITIONS', () => {
    const statuses = Object.values(OrderStatus);
    for (const from of statuses) {
      for (const to of statuses) {
        if (canTransition(from, to)) continue;

        it(`${from} -> ${to} is INVALID_STATE, the row and its history unchanged`, async () => {
          const order = await seedOrder(from);

          const error = await prisma
            .$transaction((tx) =>
              orders.transition(tx, order.id, {}, to, { type: OrderActorType.SYSTEM }),
            )
            .catch((e: unknown) => e);
          expect(errorCodeOf(error)).toBe('INVALID_STATE');

          const row = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
          expect(row.status).toBe(from);
          const historyCount = await prisma.orderStatusHistory.count({
            where: { orderId: order.id },
          });
          expect(historyCount).toBe(0);
        });
      }
    }
  });

  it('a legal transition updates the row, records history, and writes an outbox row', async () => {
    const order = await seedOrder(OrderStatus.PENDING);

    await prisma.$transaction((tx) =>
      orders.transition(
        tx,
        order.id,
        {},
        OrderStatus.CANCELLED,
        { type: OrderActorType.CUSTOMER, userId: order.userId },
        { cancelledAt: new Date(), cancelReason: 'CUSTOMER' },
      ),
    );

    const row = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(row.status).toBe('CANCELLED');

    const history = await prisma.orderStatusHistory.findMany({ where: { orderId: order.id } });
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      fromStatus: 'PENDING',
      toStatus: 'CANCELLED',
      actorType: 'CUSTOMER',
      actorUserId: order.userId,
    });

    const outboxRows = await prisma.outboxEvent.findMany({ where: { aggregateId: order.id } });
    expect(outboxRows).toHaveLength(1);
    expect(outboxRows[0]?.subject).toBe('ordering.order.status_changed');
    expect(outboxRows[0]?.publishedAt).toBeNull();
  });

  it('a concurrent tap racing the same order: one succeeds, the other is INVALID_STATE with the new status', async () => {
    const order = await seedOrder(OrderStatus.PENDING);

    const results = await Promise.allSettled([
      prisma.$transaction((tx) =>
        orders.transition(
          tx,
          order.id,
          {},
          OrderStatus.CANCELLED,
          { type: OrderActorType.CUSTOMER, userId: order.userId },
          { cancelledAt: new Date(), cancelReason: 'CUSTOMER' },
        ),
      ),
      prisma.$transaction((tx) =>
        orders.transition(
          tx,
          order.id,
          {},
          OrderStatus.PAID,
          { type: OrderActorType.PAYMENT },
          { paidAt: new Date() },
        ),
      ),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const history = await prisma.orderStatusHistory.count({ where: { orderId: order.id } });
    expect(history).toBe(1);
  });

  it('RESOURCE_NOT_FOUND for an unknown order', async () => {
    const error = await prisma
      .$transaction((tx) =>
        orders.transition(tx, newId(), {}, OrderStatus.CANCELLED, { type: OrderActorType.SYSTEM }),
      )
      .catch((e: unknown) => e);
    expect(errorCodeOf(error)).toBe('RESOURCE_NOT_FOUND');
  });
});
