import { describe, expect, it, vi } from 'vitest';
import type { JetStreamClient, JsMsg } from 'nats';
import { newId, OrderActorType, OrderStatus, type EventPayload } from '@brewlite/contracts';
import { JetStreamConsumer, PoisonMessage } from './consumer.js';

const SUBJECT = 'ordering.order.status_changed' as const;

class TestConsumer extends JetStreamConsumer<typeof SUBJECT> {
  readonly service = 'catalog';
  readonly subject = SUBJECT;
  handleFn = vi.fn(async (_payload: EventPayload<typeof SUBJECT>): Promise<void> => {});

  async handle(payload: EventPayload<typeof SUBJECT>): Promise<void> {
    await this.handleFn(payload);
  }
}

function validPayload() {
  return {
    eventId: newId(),
    occurredAt: new Date().toISOString(),
    orderId: newId(),
    orderNo: '1000',
    userId: newId(),
    from: OrderStatus.PENDING,
    to: OrderStatus.PAID,
    actorType: OrderActorType.SYSTEM,
  };
}

function fakeMsg(
  payload: unknown,
  opts: { deliveryCount?: number; requestId?: string } = {},
): JsMsg {
  const headerValues: Record<string, string> = opts.requestId
    ? { 'x-request-id': opts.requestId }
    : {};
  return {
    data: new TextEncoder().encode(JSON.stringify(payload)),
    headers: {
      get: (key: string) => headerValues[key],
      [Symbol.iterator]: function* () {
        for (const [key, value] of Object.entries(headerValues)) yield [key, [value]];
      },
    },
    info: { deliveryCount: opts.deliveryCount ?? 1 },
    seq: 1,
    ack: vi.fn(),
    nak: vi.fn(),
    term: vi.fn(),
  } as unknown as JsMsg;
}

function fakeJsc(): JetStreamClient {
  return { publish: vi.fn().mockResolvedValue({}) } as unknown as JetStreamClient;
}

describe('JetStreamConsumer', () => {
  it('acks when the handler returns', async () => {
    const consumer = new TestConsumer();
    const jsc = fakeJsc();
    const msg = fakeMsg(validPayload());

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (consumer as any).handleOne(jsc, msg);

    expect(consumer.handleFn).toHaveBeenCalledOnce();
    expect(msg.ack).toHaveBeenCalledOnce();
    expect(msg.nak).not.toHaveBeenCalled();
    expect(msg.term).not.toHaveBeenCalled();
  });

  it('naks with a delay when the handler throws and delivery < max_deliver', async () => {
    const consumer = new TestConsumer();
    consumer.handleFn.mockRejectedValueOnce(new Error('transient'));
    const jsc = fakeJsc();
    const msg = fakeMsg(validPayload(), { deliveryCount: 2 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (consumer as any).handleOne(jsc, msg);

    expect(msg.nak).toHaveBeenCalledWith(5_000);
    expect(msg.ack).not.toHaveBeenCalled();
    expect(msg.term).not.toHaveBeenCalled();
    expect(jsc.publish).not.toHaveBeenCalled();
  });

  it('dead-letters on the final delivery', async () => {
    const consumer = new TestConsumer();
    consumer.handleFn.mockRejectedValueOnce(new Error('still failing'));
    const jsc = fakeJsc();
    const msg = fakeMsg(validPayload(), { deliveryCount: 10 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (consumer as any).handleOne(jsc, msg);

    expect(msg.term).toHaveBeenCalledOnce();
    expect(msg.nak).not.toHaveBeenCalled();
    expect(jsc.publish).toHaveBeenCalledWith(
      'dlq.catalog.catalog-ordering-order-status_changed',
      msg.data,
      expect.objectContaining({ headers: expect.anything() }),
    );
  });

  it('dead-letters a PoisonMessage regardless of delivery count', async () => {
    const consumer = new TestConsumer();
    consumer.handleFn.mockRejectedValueOnce(new PoisonMessage('bad domain state'));
    const jsc = fakeJsc();
    const msg = fakeMsg(validPayload(), { deliveryCount: 1 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (consumer as any).handleOne(jsc, msg);

    expect(msg.term).toHaveBeenCalledOnce();
    expect(jsc.publish).toHaveBeenCalledOnce();
  });

  it('treats a schema failure as poison, dead-lettering on the first delivery', async () => {
    const consumer = new TestConsumer();
    const jsc = fakeJsc();
    const msg = fakeMsg({ nope: 1 }, { deliveryCount: 1 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (consumer as any).handleOne(jsc, msg);

    expect(consumer.handleFn).not.toHaveBeenCalled();
    expect(msg.term).toHaveBeenCalledOnce();
    expect(jsc.publish).toHaveBeenCalledOnce();
  });
});
