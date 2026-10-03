import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { connect, type JetStreamClient, type NatsConnection } from 'nats';
import { compareStrings, newId } from '@brewlite/contracts';
import { OutboxRelay } from '@brewlite/nest-common';
import { prisma } from '../setup/per-file.js';
import { testEnv } from '../setup/env.js';

const ROW_COUNT = 120;

function recordingJsc(real: JetStreamClient, counts: Map<string, number>): JetStreamClient {
  return {
    ...real,
    publish: (subject: string, data: Uint8Array, opts: { msgID: string }) => {
      counts.set(opts.msgID, (counts.get(opts.msgID) ?? 0) + 1);
      return real.publish(subject, data, opts);
    },
  } as unknown as JetStreamClient;
}

async function waitUntilAllPublished(timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const [{ count }] = await prisma.$queryRaw<
      { count: bigint }[]
    >`SELECT count(*)::bigint AS count FROM outbox_events WHERE published_at IS NULL`;
    if (count === 0n) return;
    if (Date.now() > deadline) throw new Error(`still ${count} unpublished after ${timeoutMs}ms`);
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

describe('OutboxRelay — claim race (rdm-spec §2.7)', () => {
  let nc: NatsConnection;

  beforeAll(async () => {
    nc = await connect({ servers: testEnv.NATS_URL_TEST });
  });

  afterAll(async () => {
    await nc.close();
  });

  it('every row is published exactly once under two concurrent relays', async () => {
    const ids = Array.from({ length: ROW_COUNT }, () => newId()).sort(compareStrings);
    await prisma.outboxEvent.createMany({
      data: ids.map((id) => ({
        id,
        subject: 'ordering.order.status_changed',
        payload: { orderId: newId(), note: id },
        aggregateId: newId(),
        requestId: null,
      })),
    });

    const counts = new Map<string, number>();
    const jsc = recordingJsc(nc.jetstream(), counts);
    const relayA = new OutboxRelay(prisma, jsc);
    const relayB = new OutboxRelay(prisma, jsc);
    relayA.start();
    relayB.start();

    await waitUntilAllPublished(15_000);
    await Promise.all([relayA.stop(), relayB.stop()]);

    for (const id of ids) {
      expect(counts.get(id), `row ${id} published ${counts.get(id) ?? 0} times`).toBe(1);
    }

    const rows = await prisma.outboxEvent.findMany({
      where: { id: { in: ids } },
      select: { publishedAt: true },
    });
    expect(rows.every((row) => row.publishedAt !== null)).toBe(true);
  }, 20_000);
});
