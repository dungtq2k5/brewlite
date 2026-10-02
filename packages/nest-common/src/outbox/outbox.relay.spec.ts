import { describe, expect, it, vi } from 'vitest';
import type { JetStreamClient } from 'nats';
import {
  OUTBOX_BATCH_SIZE,
  OUTBOX_PUBLISH_TIMEOUT_MS,
  OutboxRelay,
  type OutboxRelayClient,
  type OutboxRelayTransactionClient,
} from './outbox.relay.js';

interface Row {
  id: string;
  subject: string;
  payload: unknown;
  request_id: string | null;
}

function fakeDb(rows: Row[]) {
  const executed: { sql: string; values: unknown[] }[] = [];
  const tx: OutboxRelayTransactionClient = {
    $queryRaw: vi.fn(async () => rows) as OutboxRelayTransactionClient['$queryRaw'],
    $executeRaw: vi.fn(async (query: TemplateStringsArray, ...values: unknown[]) => {
      executed.push({ sql: query.join('?'), values });
      return 1;
    }) as OutboxRelayTransactionClient['$executeRaw'],
  };
  let capturedTimeout: number | undefined;
  const db: OutboxRelayClient = {
    $transaction: vi.fn(async (fn, options) => {
      capturedTimeout = options?.timeout;
      return fn(tx);
    }),
  };
  return { db, tx, executed, getTimeout: () => capturedTimeout };
}

describe('OutboxRelay', () => {
  it('publishes every claimed row and marks all of them published', async () => {
    const rows: Row[] = [
      { id: 'a', subject: 'ordering.order.status_changed', payload: { x: 1 }, request_id: 'r1' },
      { id: 'b', subject: 'ordering.order.status_changed', payload: { x: 2 }, request_id: null },
    ];
    const { db, executed } = fakeDb(rows);
    const jsc = { publish: vi.fn().mockResolvedValue({}) } as unknown as JetStreamClient;

    const relay = new OutboxRelay(db, jsc);
    const claimed = await (relay as unknown as { runCycle(): Promise<number> }).runCycle();

    expect(claimed).toBe(2);
    expect(jsc.publish).toHaveBeenCalledTimes(2);
    expect(jsc.publish).toHaveBeenNthCalledWith(
      1,
      'ordering.order.status_changed',
      expect.any(Uint8Array),
      expect.objectContaining({ msgID: 'a', timeout: OUTBOX_PUBLISH_TIMEOUT_MS }),
    );
    const markCall = executed.find((call) => call.sql.includes('published_at'));
    expect(markCall?.values[0]).toEqual(['a', 'b']);
  });

  it('stops the batch at the first failure and marks only the acknowledged rows', async () => {
    const rows: Row[] = [
      { id: 'a', subject: 'ordering.order.status_changed', payload: {}, request_id: null },
      { id: 'b', subject: 'ordering.order.status_changed', payload: {}, request_id: null },
      { id: 'c', subject: 'ordering.order.status_changed', payload: {}, request_id: null },
    ];
    const { db, executed } = fakeDb(rows);
    const jsc = {
      publish: vi
        .fn()
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce(new Error('broker unreachable'))
        .mockResolvedValueOnce({}),
    } as unknown as JetStreamClient;

    const relay = new OutboxRelay(db, jsc);
    await (relay as unknown as { runCycle(): Promise<number> }).runCycle();

    // row 'c' is never attempted — the batch stops at the first failure.
    expect(jsc.publish).toHaveBeenCalledTimes(2);
    const markCall = executed.find((call) => call.sql.includes('published_at'));
    expect(markCall?.values[0]).toEqual(['a']);
    const failCall = executed.find((call) => call.sql.includes('attempts'));
    expect(failCall?.values).toEqual(['broker unreachable', 'b']);
  });

  it('sizes the transaction timeout from the batch size', async () => {
    const { db, getTimeout } = fakeDb([]);
    const jsc = { publish: vi.fn() } as unknown as JetStreamClient;

    const relay = new OutboxRelay(db, jsc);
    await (relay as unknown as { runCycle(): Promise<number> }).runCycle();

    expect(getTimeout()).toBe(OUTBOX_BATCH_SIZE * OUTBOX_PUBLISH_TIMEOUT_MS + 5_000);
  });
});
