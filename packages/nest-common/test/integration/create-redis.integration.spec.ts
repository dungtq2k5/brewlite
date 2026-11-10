import { Queue } from 'bullmq';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRedis, watchRedisErrors } from '../../src/redis/create-redis.js';

// A Redis that is not there (a closed port): ioredis retries and fails again and again, and
// BullMQ re-emits each failure on its queue. One structured line for the outage, nothing on stderr.
const CLOSED = 'redis://127.0.0.1:25997';

const logger = () => ({ error: vi.fn(), warn: vi.fn(), log: vi.fn() });
// ioredis and BullMQ report through `console.error` (which Vitest captures before any
// `process.stderr.write`, so that one would pass vacuously).
const stderr = () => vi.spyOn(console, 'error');
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('createRedis against an unreachable Redis', () => {
  afterEach(() => vi.restoreAllMocks());

  it('logs one error for the whole outage and writes nothing to stderr', async () => {
    const err = stderr();
    const log = logger();
    const client = createRedis(
      CLOSED,
      { maxRetriesPerRequest: 1, enableOfflineQueue: false, connectTimeout: 200 },
      { name: 'it-cache', logger: log },
    );
    await wait(1_500); // several reconnect attempts
    client.disconnect();

    expect(log.error).toHaveBeenCalledOnce();
    expect(log.error).toHaveBeenCalledWith(
      { client: 'it-cache', code: 'ECONNREFUSED' },
      'redis unreachable',
    );
    expect(err).not.toHaveBeenCalled();
  });

  it('routes a BullMQ queue’s re-emitted failures into the same single line', async () => {
    const err = stderr();
    const log = logger();
    const client = createRedis(
      CLOSED,
      { maxRetriesPerRequest: null },
      { name: 'it-jobs', logger: log },
    );
    const queue = new Queue('it-create-redis', { connection: client });
    watchRedisErrors(queue, client);
    await wait(1_500);
    client.disconnect();
    await queue.close().catch(() => undefined);

    expect(log.error).toHaveBeenCalledOnce();
    expect(err).not.toHaveBeenCalled();
  });
});
