import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { connect, type NatsConnection } from 'nats';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newId, OrderStatus, PaymentFailureReason } from '@brewlite/contracts';
import { envSchema } from '../../src/config/env.schema.js';
import { NATS_CONNECTION, NatsModule } from '../../src/nats/nats.module.js';
import { CatalogMenuGrpcClient } from '../../src/modules/orders/catalog-menu-grpc.client.js';
import { CatalogStockGrpcClient } from '../../src/modules/orders/catalog-stock-grpc.client.js';
import { PrismaModule } from '../../src/modules/prisma/prisma.module.js';
import { prisma } from '../setup/per-file.js';
import { testEnv } from '../setup/env.js';

/** The four durables `NatsModule` starts on `PAYMENT` — `<service>-<subject, dots as dashes>`. */
const DURABLES = [
  'ordering-payment-payment-succeeded',
  'ordering-payment-payment-failed',
  'ordering-payment-refund-succeeded',
  'ordering-payment-refund-failed',
];

/** The real module, booted against the TEST broker — never the dev one. */
async function buildModule() {
  const configModule = ConfigModule.forRoot({
    isGlobal: true,
    validate: () =>
      envSchema.parse({
        ...testEnv,
        DATABASE_URL: testEnv.DATABASE_URL_TEST,
        NATS_URL: testEnv.NATS_URL_TEST,
      }),
  });
  const moduleRef = await Test.createTestingModule({
    imports: [configModule, PrismaModule, NatsModule],
  })
    .overrideProvider(CatalogMenuGrpcClient)
    .useValue({})
    .overrideProvider(CatalogStockGrpcClient)
    .useValue({})
    .compile();
  const app = moduleRef.createNestApplication();
  await app.init();
  return app;
}

async function waitFor<T>(read: () => Promise<T>, done: (value: T) => boolean): Promise<T> {
  const deadline = Date.now() + 10_000;
  for (;;) {
    const value = await read();
    if (done(value) || Date.now() > deadline) return value;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

describe('NatsModule — on the test broker', () => {
  let app: Awaited<ReturnType<typeof buildModule>>;
  let moduleNc: NatsConnection;
  /** The test's own connection, to publish and inspect — the module's is closed by the last test. */
  let nc: NatsConnection;
  const published: number[] = [];

  beforeAll(async () => {
    nc = await connect({ servers: testEnv.NATS_URL_TEST, timeout: 5000 });
    app = await buildModule();
    moduleNc = app.get<NatsConnection>(NATS_CONNECTION);
  });

  afterAll(async () => {
    try {
      if (!moduleNc.isClosed()) await app.close(); // the last test closes it on success
    } finally {
      // Leave the test broker as found: no durables of ours, none of the messages we published.
      const jsm = await nc.jetstreamManager();
      for (const seq of published) await jsm.streams.deleteMessage('PAYMENT', seq).catch(() => {});
      for (const durable of DURABLES) {
        await jsm.consumers.delete('PAYMENT', durable).catch(() => {});
      }
      await nc.close();
    }
  });

  it('starts one durable per payment event on PAYMENT at boot', async () => {
    const jsm = await nc.jetstreamManager();
    const names: string[] = [];
    for await (const info of jsm.consumers.list('PAYMENT')) names.push(info.name);
    expect(names).toEqual(expect.arrayContaining(DURABLES));
  });

  it('a payment.failed event on the broker reaches the order, and the relay publishes the status change', async () => {
    const paymentId = newId();
    const order = await prisma.order.create({
      data: {
        id: newId(),
        userId: newId(),
        subtotalVnd: 50_000,
        totalVnd: 50_000,
        idempotencyKey: newId(),
        requestHash: 'x'.repeat(64),
        expiresAt: new Date(Date.now() + 900_000),
        currentPaymentId: paymentId,
      },
    });

    const eventId = newId();
    const ack = await nc.jetstream().publish(
      'payment.payment.failed',
      new TextEncoder().encode(
        JSON.stringify({
          eventId,
          occurredAt: new Date().toISOString(),
          paymentId,
          orderId: order.id,
          reason: PaymentFailureReason.SIMULATED,
        }),
      ),
      { msgID: eventId },
    );
    published.push(ack.seq);

    const fresh = await waitFor(
      () => prisma.order.findUniqueOrThrow({ where: { id: order.id } }),
      (row) => row.status === OrderStatus.PAYMENT_FAILED,
    );
    expect(fresh.status).toBe(OrderStatus.PAYMENT_FAILED);

    // The transition's outbox row goes out through the relay the module started.
    const row = await waitFor(
      () =>
        prisma.outboxEvent.findFirstOrThrow({
          where: { aggregateId: order.id, subject: 'ordering.order.status_changed' },
        }),
      (r) => r.publishedAt !== null,
    );
    expect(row.publishedAt).not.toBeNull();
  });

  it('shutdown stops the relay and the consumers, then drains its connection', async () => {
    await app.close();
    expect(moduleNc.isClosed()).toBe(true);

    // With the relay stopped, a new outbox row stays unpublished.
    const outbox = await prisma.outboxEvent.create({
      data: {
        subject: 'ordering.order.status_changed',
        payload: {},
        aggregateId: newId(),
      },
    });
    await new Promise((resolve) => setTimeout(resolve, 500));
    const row = await prisma.outboxEvent.findUniqueOrThrow({ where: { id: outbox.id } });
    expect(row.publishedAt).toBeNull();
  });
});
