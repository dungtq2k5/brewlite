import { ConfigModule } from '@nestjs/config';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { connect, type NatsConnection } from 'nats';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { OutboxRelay } from '@brewlite/nest-common';
import { envSchema } from '../../src/config/env.schema.js';
import { NATS_CONNECTION, NatsModule } from '../../src/nats/nats.module.js';
import { OrderCancelledConsumer } from '../../src/modules/payments/order-cancelled.consumer.js';
import { OrderingGrpcClient } from '../../src/modules/payments/ordering-grpc.client.js';
import { PaymentRejectedConsumer } from '../../src/modules/payments/payment-rejected.consumer.js';
import { testEnv } from '../setup/env.js';

/**
 * The module's own wiring against the TEST broker — never the dev one. The two consumers are
 * stubbed: their durables would replay the shared test ORDERING stream into this database.
 */
describe('NatsModule — boot and shutdown on the test broker', () => {
  const steps: string[] = [];
  const consumer = (name: string) => ({
    start: vi.fn().mockResolvedValue({
      close: vi.fn(async () => {
        steps.push(`${name} closed`);
      }),
    }),
  });
  const orderCancelled = consumer('orderCancelled');
  const paymentRejected = consumer('paymentRejected');
  let app: INestApplication;
  let nc: NatsConnection;
  let probe: NatsConnection;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          validate: () =>
            envSchema.parse({
              ...testEnv,
              DATABASE_URL: testEnv.DATABASE_URL_TEST,
              NATS_URL: testEnv.NATS_URL_TEST,
            }),
        }),
        NatsModule,
      ],
    })
      .overrideProvider(OrderingGrpcClient)
      .useValue({ beginPayment: vi.fn() })
      .overrideProvider(OrderCancelledConsumer)
      .useValue(orderCancelled)
      .overrideProvider(PaymentRejectedConsumer)
      .useValue(paymentRejected)
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
    nc = app.get<NatsConnection>(NATS_CONNECTION);
    probe = await connect({ servers: testEnv.NATS_URL_TEST });
  });

  afterAll(async () => {
    if (!nc.isClosed()) await app.close(); // the shutdown test failed before closing
    await probe.close();
  });

  it('connects to the configured broker and ensures every stream it touches', async () => {
    expect(nc.getServer()).toBe(new URL(testEnv.NATS_URL_TEST).host);
    const jsm = await probe.jetstreamManager();
    for (const name of ['PAYMENT', 'ORDERING', 'DLQ']) {
      expect((await jsm.streams.info(name)).config.name).toBe(name);
    }
  });

  it("starts both refund consumers on ORDERING over the module's own connection", () => {
    for (const c of [orderCancelled, paymentRejected]) {
      expect(c.start).toHaveBeenCalledTimes(1);
      expect(c.start.mock.calls[0]?.[2]).toBe('ORDERING');
    }
  });

  it('on shutdown stops the relay FIRST, then closes the consumers, then drains the connection', async () => {
    const relay = app.get(OutboxRelay);
    const stop = relay.stop.bind(relay);
    vi.spyOn(relay, 'stop').mockImplementation(async () => {
      steps.push(`relay stopped (connection closed: ${nc.isClosed()})`);
      await stop();
    });

    await app.close();

    expect(steps).toEqual([
      'relay stopped (connection closed: false)',
      'orderCancelled closed',
      'paymentRejected closed',
    ]);
    expect(nc.isClosed()).toBe(true);
  });
});
