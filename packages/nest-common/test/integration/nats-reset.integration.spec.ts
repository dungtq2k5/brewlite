import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { connect, type JetStreamClient, type JetStreamManager, type NatsConnection } from 'nats';
import type { EventPayload, StreamDefinition } from '@brewlite/contracts';
import { JetStreamConsumer, type ConsumerHandle } from '../../src/jetstream/consumer.js';
import { ensureStreams } from '../../src/jetstream/streams.js';
import {
  OutboxRelay,
  type OutboxRelayClient,
  type OutboxRelayTransactionClient,
} from '../../src/outbox/outbox.relay.js';
import { NATS_URL_TEST } from '../setup/env.js';

// NATS reset under a running service (fix batch 01): the stream is deleted after everything is up;
// the relay re-creates it on its next publish and the consumer resumes on its own. A private
// stream — the real ones are shared with the other packages' suites, which run in parallel.
const STREAM = 'NATS_RESET_TEST';
const SUBJECT = 'nats-reset-test.event';
const DEFINITIONS: readonly StreamDefinition[] = [
  {
    name: STREAM,
    subjects: ['nats-reset-test.>'],
    maxAgeMs: 60 * 60_000,
    duplicateWindowMs: 2 * 60_000,
  },
];

class TestConsumer extends JetStreamConsumer<never> {
  readonly service = 'nest-common-test';
  readonly subject = SUBJECT as never;
  readonly handled: string[] = [];
  protected override parse(raw: unknown): EventPayload<never> {
    return raw as EventPayload<never>;
  }
  async handle(payload: EventPayload<never>): Promise<void> {
    this.handled.push((payload as unknown as { n: string }).n);
  }
}

/** An outbox in memory, shaped like the three statements the relay runs. */
function memoryOutbox() {
  const rows: {
    id: string;
    subject: string;
    payload: unknown;
    request_id: null;
    published: boolean;
  }[] = [];
  const tx: OutboxRelayTransactionClient = {
    $queryRaw: (async () =>
      rows.filter((r) => !r.published)) as OutboxRelayTransactionClient['$queryRaw'],
    $executeRaw: (async (query: TemplateStringsArray, ...values: unknown[]) => {
      if (query.join('?').includes('published_at = now()')) {
        for (const id of values[0] as string[]) rows.find((r) => r.id === id)!.published = true;
      }
      return 1;
    }) as OutboxRelayTransactionClient['$executeRaw'],
  };
  const db: OutboxRelayClient = { $transaction: (fn) => fn(tx) };
  let seq = 0;
  return {
    db,
    rows,
    add: (n: string) =>
      rows.push({
        id: `00000000-0000-7000-8000-${String(++seq).padStart(12, '0')}`,
        subject: SUBJECT,
        payload: { n },
        request_id: null,
        published: false,
      }),
  };
}

const waitFor = async (check: () => boolean, ms = 20_000) => {
  const until = Date.now() + ms;
  while (!check()) {
    if (Date.now() > until) throw new Error('timed out');
    await new Promise((r) => setTimeout(r, 100));
  }
};

describe('a NATS reset under a running service heals by itself', () => {
  let nc: NatsConnection;
  let jsm: JetStreamManager;
  let jsc: JetStreamClient;
  let handle: ConsumerHandle;
  let relay: OutboxRelay;
  const consumer = new TestConsumer();
  const outbox = memoryOutbox();

  beforeAll(async () => {
    nc = await connect({ servers: NATS_URL_TEST });
    jsm = await nc.jetstreamManager();
    jsc = nc.jetstream();
    await jsm.streams.delete(STREAM).catch(() => {});
    await ensureStreams(jsm, [STREAM], DEFINITIONS);
    relay = new OutboxRelay(outbox.db, jsc, () => ensureStreams(jsm, [STREAM], DEFINITIONS));
    relay.start();
    handle = await consumer.start(jsc, jsm, STREAM, DEFINITIONS);
  });

  afterAll(async () => {
    await relay.stop();
    await handle.close();
    await jsm.streams.delete(STREAM).catch(() => {});
    await nc.close();
  });

  it('publishes and consumes, then — stream deleted — re-creates it and handles the next event exactly once', async () => {
    outbox.add('before');
    await waitFor(() => consumer.handled.includes('before'));

    await jsm.streams.delete(STREAM); // what a NATS restart without a volume does

    outbox.add('after-1');
    outbox.add('after-2');
    await waitFor(() => outbox.rows.every((r) => r.published));
    await expect(jsm.streams.info(STREAM)).resolves.toBeDefined(); // re-created by the relay

    await waitFor(() => consumer.handled.includes('after-2'), 45_000);
    expect(consumer.handled).toEqual(['before', 'after-1', 'after-2']); // in order, once each
  }, 60_000);
});
