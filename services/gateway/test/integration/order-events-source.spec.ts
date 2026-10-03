import { connect, type NatsConnection } from 'nats';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newId, OrderStatus } from '@brewlite/contracts';
import { OrderEventsSource } from '../../src/events/order-events.source.js';
import type { OrderStatusFrame } from '../../src/events/order-status-frame.js';
import { testEnv } from '../setup/env.js';

/** The one test that runs the real ordered consumer against the test broker. */
describe('OrderEventsSource against nats-test', () => {
  const source = new OrderEventsSource({ get: () => testEnv.NATS_URL_TEST } as never);
  let nc: NatsConnection;

  beforeAll(async () => {
    nc = await connect({ servers: testEnv.NATS_URL_TEST });
    source.onModuleInit();
    for (let i = 0; i < 100 && !(await source.readinessCheck()()); i++) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  });

  afterAll(async () => {
    await source.onApplicationShutdown();
    await nc.drain();
  });

  it('delivers a published status_changed as a frame', async () => {
    const received = new Promise<OrderStatusFrame>((resolve) => {
      source.frames$.subscribe(resolve);
    });
    const orderId = newId();
    const eventId = newId();
    // deliver policy `new` — publish repeatedly until the consumer is attached and sees one.
    const publisher = setInterval(() => {
      void nc.jetstream().publish(
        'ordering.order.status_changed',
        JSON.stringify({
          eventId,
          occurredAt: new Date().toISOString(),
          orderId,
          orderNo: '1042',
          userId: newId(),
          from: OrderStatus.PAID,
          to: OrderStatus.READY,
          actorType: 'STAFF',
        }),
        { msgID: newId() },
      );
    }, 200);
    const frame = await received.finally(() => clearInterval(publisher));
    expect(frame).toMatchObject({ id: eventId, orderId, orderNo: 1042, status: 'READY' });
  }, 15_000);
});
