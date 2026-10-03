import { describe, expect, it, vi } from 'vitest';
import { newId, OrderStatus } from '@brewlite/contracts';
import { OrderEventsSource } from './order-events.source.js';

const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));

describe('OrderEventsSource', () => {
  it('drops an invalid payload and still delivers the next valid one', () => {
    const source = new OrderEventsSource({ get: () => 'nats://unused' } as never);
    const seen = vi.fn();
    source.frames$.subscribe(seen);
    const publish = (data: Uint8Array) =>
      (source as unknown as { publish(d: Uint8Array): void }).publish(data);

    publish(encode({ orderId: 'not-a-uuid' }));
    publish(new TextEncoder().encode('not json'));
    expect(seen).not.toHaveBeenCalled();

    publish(
      encode({
        eventId: newId(),
        occurredAt: new Date().toISOString(),
        orderId: newId(),
        orderNo: '1042',
        userId: newId(),
        from: OrderStatus.PAID,
        to: OrderStatus.READY,
        actorType: 'STAFF',
      }),
    );
    expect(seen).toHaveBeenCalledOnce();
  });
});
