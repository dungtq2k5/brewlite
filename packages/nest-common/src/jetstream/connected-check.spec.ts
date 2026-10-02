import { Events, type NatsConnection } from 'nats';
import { describe, expect, it, vi } from 'vitest';
import { NatsConnectionTracker } from './connected-check.js';

function connection(statuses: AsyncIterable<{ type: string }>, closed = false): NatsConnection {
  return { status: () => statuses, isClosed: () => closed } as unknown as NatsConnection;
}

async function* emit(...types: string[]): AsyncGenerator<{ type: string }> {
  for (const type of types) yield { type };
}

const settle = () => new Promise((resolve) => setImmediate(resolve));

describe('NatsConnectionTracker', () => {
  it('is ready before any event, and nothing runs until start()', async () => {
    const status = vi.fn(() => emit(Events.Disconnect));
    const tracker = new NatsConnectionTracker({
      status,
      isClosed: () => false,
    } as unknown as NatsConnection);
    expect(status).not.toHaveBeenCalled();
    expect(await tracker.readinessCheck()()).toBe(true);
  });

  it('a disconnect marks it not ready and a reconnect marks it ready again', async () => {
    const tracker = new NatsConnectionTracker(connection(emit(Events.Disconnect))).start();
    await settle();
    expect(await tracker.readinessCheck()()).toBe(false);

    const back = new NatsConnectionTracker(
      connection(emit(Events.Disconnect, Events.Reconnect)),
    ).start();
    await settle();
    expect(await back.readinessCheck()()).toBe(true);
  });

  it('start() is idempotent — one watcher however often it is called', () => {
    const status = vi.fn(() => emit());
    const tracker = new NatsConnectionTracker({
      status,
      isClosed: () => false,
    } as unknown as NatsConnection);
    tracker.start().start();
    expect(status).toHaveBeenCalledTimes(1);
  });

  it('a status stream that throws marks it not ready instead of crashing', async () => {
    async function* broken(): AsyncGenerator<{ type: string }> {
      yield await Promise.reject(new Error('stream broke'));
    }
    const tracker = new NatsConnectionTracker(connection(broken())).start();
    await settle();
    expect(await tracker.readinessCheck()()).toBe(false);
  });

  it('a closed connection is never ready', async () => {
    const tracker = new NatsConnectionTracker(connection(emit(), true)).start();
    expect(await tracker.readinessCheck()()).toBe(false);
  });
});
