import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newId, OrderActorType, OrderStatus, ReservationStatus } from '@brewlite/contracts';
import { envSchema } from '../../src/config/env.schema.js';
import { StockModule } from '../../src/modules/stock/stock.module.js';
import { OrderStatusConsumer } from '../../src/modules/stock/order-status.consumer.js';
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
        REDIS_URL: testEnv.REDIS_URL_TEST,
      }),
  });
  const moduleRef = await Test.createTestingModule({
    imports: [configModule, PrismaModule, StockModule],
  }).compile();
  const app = moduleRef.createNestApplication();
  await app.init();
  return app;
}

function statusChangedPayload(overrides: { orderId: string; from: OrderStatus; to: OrderStatus }) {
  return {
    eventId: newId(),
    occurredAt: new Date().toISOString(),
    orderId: overrides.orderId,
    orderNo: '1000',
    userId: newId(),
    from: overrides.from,
    to: overrides.to,
    actorType: OrderActorType.SYSTEM,
  };
}

async function seedHeldReservation(orderId: string, qty = 1) {
  const category = await prisma.category.create({
    data: { id: newId(), nameEn: `Cat ${newId()}`, nameVi: `Danh muc ${newId()}` },
  });
  const product = await prisma.product.create({
    data: {
      id: newId(),
      categoryId: category.id,
      nameEn: `P ${newId()}`,
      nameVi: `S ${newId()}`,
      basePriceVnd: 29_000,
      stockQty: 4,
    },
  });
  await prisma.stockReservation.create({
    data: { orderId, productId: product.id, qty, status: ReservationStatus.HELD },
  });
  return product;
}

describe('OrderStatusConsumer', () => {
  let app: Awaited<ReturnType<typeof buildModule>>;
  let consumer: OrderStatusConsumer;

  beforeAll(async () => {
    app = await buildModule();
    consumer = app.get(OrderStatusConsumer);
  });

  afterAll(async () => {
    await app.close();
  });

  it('PAID confirms the HELD reservation', async () => {
    const orderId = newId();
    await seedHeldReservation(orderId);

    await consumer.handle(
      statusChangedPayload({ orderId, from: OrderStatus.PENDING, to: OrderStatus.PAID }),
    );

    const row = await prisma.stockReservation.findFirstOrThrow({ where: { orderId } });
    expect(row.status).toBe(ReservationStatus.CONFIRMED);
  });

  it('CANCELLED releases the reservation and returns the stock', async () => {
    const orderId = newId();
    const product = await seedHeldReservation(orderId, 2);

    await consumer.handle(
      statusChangedPayload({ orderId, from: OrderStatus.PENDING, to: OrderStatus.CANCELLED }),
    );

    const row = await prisma.stockReservation.findFirstOrThrow({ where: { orderId } });
    expect(row.status).toBe(ReservationStatus.RELEASED);
    const updated = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(updated.stockQty).toBe(6); // 4 + 2 released
  });

  it('the same event applied twice has one effect', async () => {
    const orderId = newId();
    const product = await seedHeldReservation(orderId, 1);
    const payload = statusChangedPayload({
      orderId,
      from: OrderStatus.PENDING,
      to: OrderStatus.CANCELLED,
    });

    await consumer.handle(payload);
    await consumer.handle(payload); // a redelivery of the same event

    const updated = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(updated.stockQty).toBe(5); // 4 + 1, not 4 + 1 + 1
  });

  it('a stale PAID after CANCELLED finds nothing to confirm', async () => {
    const orderId = newId();
    await seedHeldReservation(orderId);
    await consumer.handle(
      statusChangedPayload({ orderId, from: OrderStatus.PENDING, to: OrderStatus.CANCELLED }),
    );

    await consumer.handle(
      statusChangedPayload({ orderId, from: OrderStatus.PENDING, to: OrderStatus.PAID }),
    );

    const row = await prisma.stockReservation.findFirstOrThrow({ where: { orderId } });
    expect(row.status).toBe(ReservationStatus.RELEASED); // untouched by the stale PAID
  });

  it('any other transition does nothing', async () => {
    const orderId = newId();
    await seedHeldReservation(orderId);

    await consumer.handle(
      statusChangedPayload({ orderId, from: OrderStatus.PAID, to: OrderStatus.PREPARING }),
    );

    const row = await prisma.stockReservation.findFirstOrThrow({ where: { orderId } });
    expect(row.status).toBe(ReservationStatus.HELD);
  });
});
