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

  /** deliver policy `new` — publishes repeatedly until the consumer is attached and sees one. */
  async function publishUntilFramed(): Promise<{
    frame: OrderStatusFrame;
    orderId: string;
    eventId: string;
  }> {
    const orderId = newId();
    const eventId = newId();
    const received = new Promise<OrderStatusFrame>((resolve) => {
      const sub = source.frames$.subscribe((frame) => {
        if (frame.orderId !== orderId) return;
        sub.unsubscribe();
        resolve(frame);
      });
    });
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
    return { frame, orderId, eventId };
  }

  it('delivers a published status_changed as a frame', async () => {
    const { frame, orderId, eventId } = await publishUntilFramed();
    expect(frame).toMatchObject({ id: eventId, orderId, orderNo: 1042, status: 'READY' });
  }, 15_000);

  it('RE-SUBSCRIBES after its consumer is deleted under it', async () => {
    await publishUntilFramed();
    const jsm = await nc.jetstreamManager();
    // Ephemeral consumers on status_changed are only ever a gateway's ordered consumer — this
    // one's, or another gateway spec's in the same run, which re-subscribes just the same.
    const ordered = (await jsm.consumers.list('ORDERING').next()).filter(
      (info) =>
        !info.config.durable_name &&
        [info.config.filter_subject, ...(info.config.filter_subjects ?? [])].includes(
          'ordering.order.status_changed',
        ),
    );
    expect(ordered.length).toBeGreaterThan(0);
    for (const info of ordered)
      await jsm.consumers.delete('ORDERING', info.name).catch(() => false);

    const { frame, orderId } = await publishUntilFramed();
    expect(frame).toMatchObject({ orderId, status: 'READY' });
  }, 30_000);
});
