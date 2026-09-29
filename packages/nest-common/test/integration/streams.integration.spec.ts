import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { connect, nanos, type JetStreamManager, type NatsConnection } from 'nats';
import { ensureStreams } from '../../src/jetstream/streams.js';
import { NATS_URL_TEST } from '../setup/env.js';

describe('ensureStreams', () => {
  let nc: NatsConnection;
  let jsm: JetStreamManager;

  beforeAll(async () => {
    nc = await connect({ servers: NATS_URL_TEST });
    jsm = await nc.jetstreamManager();
  });

  afterAll(async () => {
    await nc.close();
  });

  beforeEach(async () => {
    await jsm.streams.delete('ORDERING').catch(() => {});
  });

  it('creates a missing stream matching STREAMS', async () => {
    await ensureStreams(jsm, ['ORDERING']);
    const info = await jsm.streams.info('ORDERING');
    expect(info.config.subjects).toEqual(['ordering.>']);
    expect(info.config.duplicate_window).toBe(nanos(2 * 60_000));
  });

  it('accepts a stream whose config already matches', async () => {
    await ensureStreams(jsm, ['ORDERING']);
    await expect(ensureStreams(jsm, ['ORDERING'])).resolves.toBeUndefined();
  });

  it('throws when a live stream has drifted from STREAMS', async () => {
    await ensureStreams(jsm, ['ORDERING']);
    await jsm.streams.update('ORDERING', { max_age: nanos(3 * 24 * 60 * 60_000) });
    await expect(ensureStreams(jsm, ['ORDERING'])).rejects.toThrow(/max_age/);
  });
});
