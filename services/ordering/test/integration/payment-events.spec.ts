import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newId, OrderStatus, PaymentFailureReason, PaymentMethod } from '@brewlite/contracts';
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

async function seedOrder(overrides: Partial<Record<string, unknown>> = {}) {
  return prisma.order.create({
    data: {
      id: newId(),
      userId: newId(),
      subtotalVnd: 50_000,
      totalVnd: 50_000,
      idempotencyKey: newId(),
      requestHash: 'x'.repeat(64),
      expiresAt: new Date(Date.now() + 900_000),
      ...overrides,
    },
  });
}

function succeededPayload(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    eventId: newId(),
    occurredAt: new Date().toISOString(),
    paymentId: newId(),
    orderId: newId(),
    userId: newId(),
    amountVnd: 50_000,
    method: PaymentMethod.FAKE,
    ...overrides,
  };
}

function failedPayload(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    eventId: newId(),
    occurredAt: new Date().toISOString(),
    paymentId: newId(),
    orderId: newId(),
    reason: PaymentFailureReason.SIMULATED,
    ...overrides,
  };
}

describe('OrdersService.applyPaymentSucceeded', () => {
  let app: Awaited<ReturnType<typeof buildModule>>;
  let orders: OrdersService;

  beforeAll(async () => {
    app = await buildModule();
    orders = app.get(OrdersService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('missing order — PoisonMessage', async () => {
    await expect(
      orders.applyPaymentSucceeded(succeededPayload({ orderId: newId() })),
    ).rejects.toThrow();
  });

  it('amount mismatch — PoisonMessage, no write', async () => {
    const order = await seedOrder();
    await expect(
      orders.applyPaymentSucceeded(succeededPayload({ orderId: order.id, amountVnd: 1 })),
    ).rejects.toThrow();

    const fresh = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(fresh.status).toBe(OrderStatus.PENDING);
  });

  it('PENDING → PAID, one EARN, and the reservation-confirming outbox row', async () => {
    const order = await seedOrder();
    const paymentId = newId();

    await orders.applyPaymentSucceeded(
      succeededPayload({
        orderId: order.id,
        userId: order.userId,
        paymentId,
        amountVnd: order.totalVnd,
      }),
    );

    const fresh = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(fresh.status).toBe(OrderStatus.PAID);
    expect(fresh.currentPaymentId).toBe(paymentId);
    expect(fresh.paidAt).not.toBeNull();

    const earns = await prisma.loyaltyTransaction.count({
      where: { orderId: order.id, kind: 'EARN' },
    });
    expect(earns).toBe(1);
  });

  it('credits points ONCE when an order becomes PAID — the same event twice gives one EARN', async () => {
    const order = await seedOrder();
    const payload = succeededPayload({
      orderId: order.id,
      userId: order.userId,
      amountVnd: order.totalVnd,
    });

    await orders.applyPaymentSucceeded(payload);
    // A redelivery of the same succeeded event — the order is already PAID.
    await orders.applyPaymentSucceeded(payload);

    const earns = await prisma.loyaltyTransaction.count({
      where: { orderId: order.id, kind: 'EARN' },
    });
    expect(earns).toBe(1);
  });

  it('a stale succeeded after PAID — nothing changes', async () => {
    const order = await seedOrder();
    const first = succeededPayload({
      orderId: order.id,
      userId: order.userId,
      paymentId: newId(),
      amountVnd: order.totalVnd,
    });
    await orders.applyPaymentSucceeded(first);

    const stalePaymentId = newId();
    await orders.applyPaymentSucceeded(
      succeededPayload({
        orderId: order.id,
        userId: order.userId,
        paymentId: stalePaymentId,
        amountVnd: order.totalVnd,
      }),
    );

    const fresh = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(fresh.currentPaymentId).toBe(first.paymentId);
  });

  it('CANCELLED order — one ordering.payment.rejected row, order stays CANCELLED', async () => {
    const order = await seedOrder({
      status: OrderStatus.CANCELLED,
      cancelledAt: new Date(),
      cancelReason: 'CUSTOMER',
    });
    const paymentId = newId();

    await orders.applyPaymentSucceeded(
      succeededPayload({
        orderId: order.id,
        userId: order.userId,
        paymentId,
        amountVnd: order.totalVnd,
      }),
    );

    const fresh = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(fresh.status).toBe(OrderStatus.CANCELLED);

    const row = await prisma.outboxEvent.findFirstOrThrow({
      where: { subject: 'ordering.payment.rejected', aggregateId: order.id },
    });
    expect(row.payload).toMatchObject({ orderId: order.id, paymentId, orderStatus: 'CANCELLED' });
  });
});

describe('OrdersService.applyPaymentFailed', () => {
  let app: Awaited<ReturnType<typeof buildModule>>;
  let orders: OrdersService;

  beforeAll(async () => {
    app = await buildModule();
    orders = app.get(OrdersService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('PENDING with the matching current payment → PAYMENT_FAILED, with the reason noted', async () => {
    const paymentId = newId();
    const order = await seedOrder({ currentPaymentId: paymentId });

    await orders.applyPaymentFailed(failedPayload({ orderId: order.id, paymentId }));

    const fresh = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(fresh.status).toBe(OrderStatus.PAYMENT_FAILED);

    const history = await prisma.orderStatusHistory.findFirstOrThrow({
      where: { orderId: order.id, toStatus: OrderStatus.PAYMENT_FAILED },
    });
    expect(history.note).toBe(PaymentFailureReason.SIMULATED);
  });

  it('a failure for an old (no-longer-current) payment — no-op', async () => {
    const order = await seedOrder({ currentPaymentId: newId() });

    await orders.applyPaymentFailed(failedPayload({ orderId: order.id, paymentId: newId() }));

    const fresh = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(fresh.status).toBe(OrderStatus.PENDING);
  });

  it('an order that no longer exists — no-op, never throws', async () => {
    await expect(
      orders.applyPaymentFailed(failedPayload({ orderId: newId() })),
    ).resolves.toBeUndefined();
  });
});
