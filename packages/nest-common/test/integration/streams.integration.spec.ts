import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { connect, nanos, type JetStreamManager, type NatsConnection } from 'nats';
import type { StreamDefinition } from '@brewlite/contracts';
import { ensureStreams } from '../../src/jetstream/streams.js';
import { NATS_URL_TEST } from '../setup/env.js';

// A private stream: the real ones (ORDERING, PAYMENT, DLQ) are shared with every other
// package's integration tests, which run in parallel — this must never delete or drift them.
const NAME = 'ENSURE_STREAMS_TEST';
const DEFINITIONS: readonly StreamDefinition[] = [
  {
    name: NAME,
    subjects: ['ensure-streams-test.>'],
    maxAgeMs: 7 * 24 * 60 * 60_000,
    duplicateWindowMs: 2 * 60_000,
  },
];

describe('ensureStreams', () => {
  let nc: NatsConnection;
  let jsm: JetStreamManager;

  beforeAll(async () => {
    nc = await connect({ servers: NATS_URL_TEST });
    jsm = await nc.jetstreamManager();
  });

  afterAll(async () => {
    await jsm.streams.delete(NAME).catch(() => {});
    await nc.close();
  });

  beforeEach(async () => {
    await jsm.streams.delete(NAME).catch(() => {});
  });

  it('creates a missing stream matching STREAMS', async () => {
    await ensureStreams(jsm, [NAME], DEFINITIONS);
    const info = await jsm.streams.info(NAME);
    expect(info.config.subjects).toEqual(['ensure-streams-test.>']);
    expect(info.config.duplicate_window).toBe(nanos(2 * 60_000));
  });

  it('accepts a stream whose config already matches', async () => {
    await ensureStreams(jsm, [NAME], DEFINITIONS);
    await expect(ensureStreams(jsm, [NAME], DEFINITIONS)).resolves.toBeUndefined();
  });

  it('throws when a live stream has drifted from STREAMS', async () => {
    await ensureStreams(jsm, [NAME], DEFINITIONS);
    await jsm.streams.update(NAME, { max_age: nanos(3 * 24 * 60 * 60_000) });
    await expect(ensureStreams(jsm, [NAME], DEFINITIONS)).rejects.toThrow(/max_age/);
  });
});
