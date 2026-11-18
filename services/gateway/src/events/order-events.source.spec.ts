import { Logger } from '@nestjs/common';
import type { NatsConnection } from 'nats';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { newId, OrderStatus } from '@brewlite/contracts';
import { connectNats } from '@brewlite/nest-common';
import type * as NestCommon from '@brewlite/nest-common';
import { OrderEventsSource } from './order-events.source.js';

vi.mock('@brewlite/nest-common', async (importOriginal) => ({
  ...(await importOriginal<typeof NestCommon>()),
  connectNats: vi.fn(),
}));

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

describe('OrderEventsSource — the connect loop', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.mocked(connectNats).mockReset();
  });

  /** A connect attempt the test settles by hand. */
  function pendingConnect() {
    let fail!: (error: Error) => void;
    vi.mocked(connectNats).mockImplementationOnce(
      () => new Promise<NatsConnection>((_resolve, reject) => (fail = reject)),
    );
    return { fail: (error: Error) => fail(error) };
  }

  it('warns and RETRIES after 5 s when the broker connection fails', async () => {
    vi.useFakeTimers();
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const first = pendingConnect();
    pendingConnect();
    const source = new OrderEventsSource({ get: () => 'nats://127.0.0.1:1' } as never);

    source.onModuleInit();
    first.fail(new Error('connection refused'));
    await vi.advanceTimersByTimeAsync(4_999);
    expect(warn).toHaveBeenCalledWith(expect.anything(), 'order events source failed; retrying');
    expect(connectNats).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    expect(connectNats).toHaveBeenCalledTimes(2);
    expect(connectNats).toHaveBeenLastCalledWith('nats://127.0.0.1:1', { resilient: true });
    expect(await source.readinessCheck()()).toBe(false);
    await source.onApplicationShutdown();
  });

  it('stops SILENTLY when a connect fails after shutdown began', async () => {
    vi.useFakeTimers();
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const attempt = pendingConnect();
    const source = new OrderEventsSource({ get: () => 'nats://127.0.0.1:1' } as never);
    const completed = vi.fn();
    source.frames$.subscribe({ complete: completed });

    source.onModuleInit();
    await source.onApplicationShutdown();
    attempt.fail(new Error('connection closed'));
    await vi.advanceTimersByTimeAsync(10_000);

    expect(warn).not.toHaveBeenCalled();
    expect(connectNats).toHaveBeenCalledTimes(1);
    expect(completed).toHaveBeenCalledOnce();
  });
});
