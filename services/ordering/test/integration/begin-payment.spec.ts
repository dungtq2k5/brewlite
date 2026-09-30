import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { Metadata } from '@grpc/grpc-js';
import type { RpcException } from '@nestjs/microservices';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newId, OrderStatus, PAYMENT_WINDOW_MS } from '@brewlite/contracts';
import { envSchema } from '../../src/config/env.schema.js';
import { OrdersModule } from '../../src/modules/orders/orders.module.js';
import { OrdersService } from '../../src/modules/orders/orders.service.js';
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

function errorCodeAndDetails(exception: unknown): {
  code?: string;
  details?: Record<string, unknown>;
} {
  if (!(exception && typeof exception === 'object' && 'getError' in exception)) return {};
  const { metadata } = (exception as RpcException).getError() as { metadata: Metadata };
  const code = metadata.get('bl-error-code')[0] as string | undefined;
  const raw = metadata.get('bl-error-details-bin')[0] as Buffer | undefined;
  const details = raw ? (JSON.parse(raw.toString('utf8')) as Record<string, unknown>) : undefined;
  return { code, details };
}

async function seedOrder(overrides: Partial<Record<string, unknown>> = {}) {
  return prisma.order.create({
    data: {
      id: newId(),
      userId: newId(),
      subtotalVnd: 20_000,
      totalVnd: 20_000,
      idempotencyKey: newId(),
      requestHash: 'x'.repeat(64),
      expiresAt: new Date(Date.now() + 900_000),
      ...overrides,
    },
  });
}

describe('OrdersService.beginPayment', () => {
  let app: Awaited<ReturnType<typeof buildModule>>;
  let orders: OrdersService;

  beforeAll(async () => {
    app = await buildModule();
    orders = app.get(OrdersService);
  });

  afterAll(async () => {
    await app.close();
  });

  it("not the caller's order — 404 RESOURCE_NOT_FOUND", async () => {
    const order = await seedOrder();
    const error = await orders
      .beginPayment({ orderId: order.id, userId: newId(), paymentId: newId() })
      .catch((e: unknown) => e);
    expect(errorCodeAndDetails(error).code).toBe('RESOURCE_NOT_FOUND');
  });

  it.each([
    OrderStatus.PAID,
    OrderStatus.PREPARING,
    OrderStatus.READY,
    OrderStatus.COMPLETED,
    OrderStatus.CANCELLED,
  ])('status %s — 409 ORDER_NOT_PAYABLE with that status', async (status) => {
    const order = await seedOrder({
      status,
      ...(status === OrderStatus.CANCELLED && {
        cancelledAt: new Date(),
        cancelReason: 'CUSTOMER',
      }),
    });
    const error = await orders
      .beginPayment({ orderId: order.id, userId: order.userId, paymentId: newId() })
      .catch((e: unknown) => e);
    expect(errorCodeAndDetails(error)).toEqual({ code: 'ORDER_NOT_PAYABLE', details: { status } });
  });

  it('a past deadline — 409 ORDER_NOT_PAYABLE with the current status', async () => {
    const order = await seedOrder({ expiresAt: new Date(Date.now() - 1000) });
    const error = await orders
      .beginPayment({ orderId: order.id, userId: order.userId, paymentId: newId() })
      .catch((e: unknown) => e);
    expect(errorCodeAndDetails(error)).toEqual({
      code: 'ORDER_NOT_PAYABLE',
      details: { status: OrderStatus.PENDING },
    });
  });

  it('PENDING: sets current_payment_id and raises expires_at, no history row', async () => {
    const order = await seedOrder();
    const paymentId = newId();
    const response = await orders.beginPayment({
      orderId: order.id,
      userId: order.userId,
      paymentId,
    });
    expect(response).toEqual({ orderNo: order.orderNo.toString(), totalVnd: '20000' });

    const updated = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(updated.currentPaymentId).toBe(paymentId);
    expect(updated.status).toBe(OrderStatus.PENDING);
    expect(updated.expiresAt.getTime()).toBeGreaterThanOrEqual(
      Date.now() + PAYMENT_WINDOW_MS - 1000,
    );

    const history = await prisma.orderStatusHistory.findMany({ where: { orderId: order.id } });
    expect(history).toHaveLength(0);
  });

  it('never lowers expires_at — a still-far-off deadline is kept', async () => {
    const farFuture = new Date(Date.now() + 10 * PAYMENT_WINDOW_MS);
    const order = await seedOrder({ expiresAt: farFuture });
    await orders.beginPayment({ orderId: order.id, userId: order.userId, paymentId: newId() });
    const updated = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(updated.expiresAt.getTime()).toBe(farFuture.getTime());
  });

  it('PAYMENT_FAILED: transitions to PENDING through transition() — history row and one outbox event', async () => {
    const order = await seedOrder({ status: OrderStatus.PAYMENT_FAILED });
    const paymentId = newId();
    await orders.beginPayment({ orderId: order.id, userId: order.userId, paymentId });

    const updated = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(updated.status).toBe(OrderStatus.PENDING);
    expect(updated.currentPaymentId).toBe(paymentId);

    const history = await prisma.orderStatusHistory.findMany({ where: { orderId: order.id } });
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ fromStatus: 'PAYMENT_FAILED', toStatus: 'PENDING' });

    const outbox = await prisma.outboxEvent.findMany({ where: { aggregateId: order.id } });
    expect(outbox).toHaveLength(1);
  });

  it('races orders-expire: with both conditional updates, exactly one side wins', async () => {
    // Still valid by the real wall clock beginPayment reads (expires 50ms from now), but
    // the job is handed a "now" already past that deadline — simulating the exact
    // same-tick race the doc describes, without depending on which transaction actually
    // commits first.
    const order = await seedOrder({ expiresAt: new Date(Date.now() + 5000) });
    const job = app.get(OrdersExpireJob);
    const jobNow = new Date(order.expiresAt.getTime() + 1000);

    const [beginResult] = await Promise.allSettled([
      orders.beginPayment({ orderId: order.id, userId: order.userId, paymentId: newId() }),
      job.run(jobNow),
    ]);

    const updated = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    if (beginResult.status === 'fulfilled') {
      // beginPayment's write committed first — the job's own conditional update then
      // matched nothing (it re-reads and finds PENDING, not eligible any more).
      expect(updated.status).toBe(OrderStatus.PENDING);
      expect(updated.currentPaymentId).not.toBeNull();
    } else {
      // The job's cancel committed first — beginPayment's own conditional write then
      // matched nothing and it threw.
      expect(updated.status).toBe(OrderStatus.CANCELLED);
    }
  });
});
