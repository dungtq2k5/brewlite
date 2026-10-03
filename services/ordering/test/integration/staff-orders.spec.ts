import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { Metadata } from '@grpc/grpc-js';
import type { RpcException } from '@nestjs/microservices';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newId, OrderStatus, PaymentMethod, Role } from '@brewlite/contracts';
import type { Caller } from '@brewlite/nest-common';
import { envSchema } from '../../src/config/env.schema.js';
import { OrdersModule } from '../../src/modules/orders/orders.module.js';
import { OrdersService } from '../../src/modules/orders/orders.service.js';
import { PrismaModule } from '../../src/modules/prisma/prisma.module.js';
import { StaffOrdersModule } from '../../src/modules/staff-orders/staff-orders.module.js';
import { StaffOrdersService } from '../../src/modules/staff-orders/staff-orders.service.js';
import { prisma } from '../setup/per-file.js';
import { testEnv } from '../setup/env.js';

async function buildModule() {
  const configModule = ConfigModule.forRoot({
    isGlobal: true,
    validate: () => envSchema.parse({ ...testEnv, DATABASE_URL: testEnv.DATABASE_URL_TEST }),
  });
  const moduleRef = await Test.createTestingModule({
    imports: [configModule, PrismaModule, OrdersModule, StaffOrdersModule],
  }).compile();
  const app = moduleRef.createNestApplication();
  await app.init();
  return app;
}

function errorOf(exception: unknown): { code?: string; status?: string } {
  if (!(exception && typeof exception === 'object' && 'getError' in exception)) return {};
  const { metadata } = (exception as RpcException).getError() as { metadata: Metadata };
  const raw = metadata.get('bl-error-details-bin')[0] as Buffer | undefined;
  return {
    code: metadata.get('bl-error-code')[0] as string | undefined,
    status: raw ? (JSON.parse(raw.toString('utf8')) as { status?: string }).status : undefined,
  };
}

const staff: Caller = { kind: 'USER', userId: newId(), role: Role.STAFF };

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

describe('StaffOrdersService', () => {
  let app: Awaited<ReturnType<typeof buildModule>>;
  let staffOrders: StaffOrdersService;
  let orders: OrdersService;

  beforeAll(async () => {
    app = await buildModule();
    staffOrders = app.get(StaffOrdersService);
    orders = app.get(OrdersService);
  });

  afterAll(async () => {
    await app.close();
  });

  async function paidOrder(overrides: Partial<Record<string, unknown>> = {}) {
    const order = await seedOrder(overrides);
    const paymentId = newId();
    await orders.applyPaymentSucceeded({
      eventId: newId(),
      occurredAt: new Date().toISOString(),
      paymentId,
      orderId: order.id,
      userId: order.userId,
      amountVnd: order.totalVnd,
      method: PaymentMethod.FAKE,
    });
    return { order, paymentId };
  }

  it('the board lists only board statuses, oldest first, and honours ?status', async () => {
    const first = await seedOrder({ status: OrderStatus.PAID, paidAt: new Date() });
    const second = await seedOrder({ status: OrderStatus.READY, paidAt: new Date() });
    await seedOrder({ status: OrderStatus.PENDING });
    await seedOrder({
      status: OrderStatus.COMPLETED,
      paidAt: new Date(),
    });

    const all = await staffOrders.listBoard({});
    expect(all.orders.map((o) => o.id)).toEqual([first.id, second.id]);
    expect(all.orders.every((o) => o.history.length === 0)).toBe(true);

    const onlyPaid = await staffOrders.listBoard({ status: OrderStatus.PAID });
    expect(onlyPaid.orders.map((o) => o.id)).toEqual([first.id]);
  });

  it('every legal move goes through; a skip and a double tap are INVALID_STATE with the current status', async () => {
    const { order } = await paidOrder();

    const preparing = await staffOrders.advanceStatus({ id: order.id, to: 'PREPARING' }, staff);
    expect(preparing.order?.status).toBe('PREPARING');

    const again = await staffOrders
      .advanceStatus({ id: order.id, to: 'PREPARING' }, staff)
      .catch((e: unknown) => e);
    expect(errorOf(again)).toEqual({ code: 'INVALID_STATE', status: 'PREPARING' });

    const skip = await staffOrders
      .advanceStatus({ id: order.id, to: 'COMPLETED' }, staff)
      .catch((e: unknown) => e);
    expect(errorOf(skip)).toEqual({ code: 'INVALID_STATE', status: 'PREPARING' });

    expect(
      (await staffOrders.advanceStatus({ id: order.id, to: 'READY' }, staff)).order?.status,
    ).toBe('READY');
    expect(
      (await staffOrders.advanceStatus({ id: order.id, to: 'COMPLETED' }, staff)).order?.status,
    ).toBe('COMPLETED');
  });

  it('CancelPaid: STAFF reason, note, refund PENDING, history note, EARN_REVERSED, promo use back, payment named', async () => {
    const promotion = await prisma.promotion.create({
      data: {
        id: newId(),
        code: 'OATMILK',
        discountType: 'PERCENT',
        discountValue: 10,
        startsAt: new Date(Date.now() - 86_400_000),
        endsAt: new Date(Date.now() + 86_400_000),
        usedCount: 1,
      },
    });
    const { order, paymentId } = await paidOrder({
      totalVnd: 50_000,
      promotionId: promotion.id,
      promoCode: 'OATMILK',
    });
    expect(
      await prisma.loyaltyTransaction.count({ where: { orderId: order.id, kind: 'EARN' } }),
    ).toBe(1);

    const result = await staffOrders.cancelPaid({ id: order.id, note: 'Out of oat milk' }, staff);
    expect(result.order).toMatchObject({
      status: 'CANCELLED',
      cancelReason: 'STAFF',
      cancelNote: 'Out of oat milk',
      refundStatus: 'PENDING',
    });

    const history = await prisma.orderStatusHistory.findFirstOrThrow({
      where: { orderId: order.id, toStatus: 'CANCELLED' },
    });
    expect(history.note).toBe('Out of oat milk');
    expect(history.actorType).toBe('STAFF');

    expect(
      await prisma.loyaltyTransaction.count({
        where: { orderId: order.id, kind: 'EARN_REVERSED' },
      }),
    ).toBe(1);
    const account = await prisma.loyaltyAccount.findUniqueOrThrow({
      where: { userId: order.userId },
    });
    expect(account.balance).toBe(0);
    expect(
      (await prisma.promotion.findUniqueOrThrow({ where: { id: promotion.id } })).usedCount,
    ).toBe(0);

    const event = await prisma.outboxEvent.findFirstOrThrow({
      where: { aggregateId: order.id, payload: { path: ['to'], equals: 'CANCELLED' } },
    });
    expect(event.payload).toMatchObject({ from: 'PAID', to: 'CANCELLED', paymentId });
  });

  it('CancelPaid from PENDING and PREPARING is INVALID_STATE and writes nothing', async () => {
    const pending = await seedOrder();
    const preparing = await seedOrder({ status: OrderStatus.PREPARING, paidAt: new Date() });

    for (const [order, status] of [
      [pending, 'PENDING'],
      [preparing, 'PREPARING'],
    ] as const) {
      const error = await staffOrders
        .cancelPaid({ id: order.id, note: 'x' }, staff)
        .catch((e: unknown) => e);
      expect(errorOf(error)).toEqual({ code: 'INVALID_STATE', status });
      expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe(
        status,
      );
    }
    expect(await prisma.outboxEvent.count()).toBe(0);
  });

  it('CancelPaid on an unknown order is RESOURCE_NOT_FOUND', async () => {
    const error = await staffOrders
      .cancelPaid({ id: newId(), note: 'x' }, staff)
      .catch((e: unknown) => e);
    expect(errorOf(error).code).toBe('RESOURCE_NOT_FOUND');
  });
});
