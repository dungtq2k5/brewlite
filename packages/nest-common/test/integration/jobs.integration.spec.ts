import { Inject, Injectable, Module, type INestApplicationContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { Job, Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { JOBS_REDIS_CLIENT, JobsModule, type JobDefinition } from '../../src/jobs/jobs.module.js';

// Redis database 13 of the test Redis is this suite's alone (catalog uses 15, the gateway 14).
const REDIS_URL = process.env.REDIS_URL_TEST_NEST_COMMON ?? 'redis://localhost:26379/13';

const RUNS = Symbol('RUNS');
type Runs = { name: string; now: Date }[];

/** A provider of the importing service's own module tree — the job depends on it. */
@Module({ providers: [{ provide: RUNS, useFactory: (): Runs => [] }], exports: [RUNS] })
class RunsModule {}

@Injectable()
class TickJob {
  constructor(@Inject(RUNS) private readonly runs: Runs) {}
  async run(now = new Date()): Promise<void> {
    this.runs.push({ name: 'tick', now });
  }
}

let seq = 0;
const queueName = () => `nest-common-jobs-it-${process.pid}-${++seq}`;

async function boot(queue: string, jobs: JobDefinition[]): Promise<INestApplicationContext> {
  const moduleRef = await Test.createTestingModule({
    imports: [JobsModule.forRoot({ queue, jobs, imports: [RunsModule] })],
  })
    // Never `process.env`: a REDIS_URL from the shell would point this at the dev Redis.
    .overrideProvider(ConfigService)
    .useValue({ get: (key: string) => (key === 'REDIS_URL' ? REDIS_URL : undefined) })
    .compile();
  await moduleRef.init();
  return moduleRef;
}

describe('JobsModule', () => {
  let admin: Redis;
  let app: INestApplicationContext | undefined;

  beforeAll(async () => {
    admin = new Redis(REDIS_URL);
    await admin.flushdb();
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    await app?.close();
    app = undefined;
  });
  afterAll(async () => {
    await admin.flushdb();
    await admin.quit();
  });

  it('builds its OWN blocking connection from REDIS_URL and exports it', async () => {
    app = await boot(queueName(), []);
    const client = app.get<Redis>(JOBS_REDIS_CLIENT);
    expect(client.options.db).toBe(13);
    expect(client.options.maxRetriesPerRequest).toBeNull();
    expect(await client.ping()).toBe('PONG');
  });

  it('registers ONE scheduler per job, at its interval', async () => {
    const queue = queueName();
    app = await boot(queue, [
      { name: 'tick', everyMs: 60_000, job: TickJob },
      { name: 'tock', everyMs: 120_000, job: TickJob },
    ]);
    const q = new Queue(queue, { connection: admin.duplicate() });
    const schedulers = await q.getJobSchedulers();
    await q.close();
    await (q.opts.connection as Redis).quit();

    expect(schedulers.map((s) => [s.key, s.every])).toHaveLength(2);
    expect(schedulers.map((s) => [s.key, s.every])).toEqual(
      expect.arrayContaining([
        ['tick', 60_000],
        ['tock', 120_000],
      ]),
    );
  });

  it('dispatches each scheduled run to the job class’s run() with the current time', async () => {
    const before = Date.now();
    app = await boot(queueName(), [{ name: 'tick', everyMs: 60_000, job: TickJob }]);
    const runs = app.get<Runs>(RUNS);

    await vi.waitFor(() => expect(runs.length).toBeGreaterThan(0), { timeout: 5_000 });
    expect(runs[0]!.name).toBe('tick');
    expect(runs[0]!.now.getTime()).toBeGreaterThanOrEqual(before);
  });

  it('FAILS a job whose name no definition has, without running anything', async () => {
    const queue = queueName();
    app = await boot(queue, [{ name: 'tick', everyMs: 3_600_000, job: TickJob }]);
    const runs = app.get<Runs>(RUNS);
    await vi.waitFor(() => expect(runs).toHaveLength(1), { timeout: 5_000 }); // the first tick
    const q = new Queue(queue, { connection: admin.duplicate() });
    const ghost = await q.add('ghost', {});

    await vi.waitFor(async () => expect(await q.getJobState(ghost.id!)).toBe('failed'), {
      timeout: 5_000,
    });
    const failed = (await Job.fromId(q, ghost.id!))!;
    await q.close();
    await (q.opts.connection as Redis).quit();

    expect(failed.failedReason).toBe('JobsModule: no job registered for "ghost"');
    expect(runs).toHaveLength(1);
  });

  it('with NO jobs, creates no queue and no worker, and still releases the connection', async () => {
    const queue = queueName();
    const workerClose = vi.spyOn(Worker.prototype, 'close');
    app = await boot(queue, []);
    const client = app.get<Redis>(JOBS_REDIS_CLIENT);

    expect(await admin.keys(`bull:${queue}:*`)).toEqual([]);
    await app.close();
    app = undefined;
    expect(workerClose).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(client.status).toBe('end'));
  });

  it('shuts down worker, then queue, then the connection', async () => {
    const order: string[] = [];
    const workerClose = Worker.prototype.close;
    const queueClose = Queue.prototype.close;
    vi.spyOn(Worker.prototype, 'close').mockImplementation(function (this: Worker, ...args) {
      order.push('worker');
      return workerClose.apply(this, args);
    });
    vi.spyOn(Queue.prototype, 'close').mockImplementation(function (this: Queue) {
      order.push('queue');
      return queueClose.apply(this);
    });
    app = await boot(queueName(), [{ name: 'tick', everyMs: 3_600_000, job: TickJob }]);
    const client = app.get<Redis>(JOBS_REDIS_CLIENT);
    const quit = client.quit.bind(client);
    vi.spyOn(client, 'quit').mockImplementation(() => {
      order.push('connection');
      return quit();
    });

    await app.close();
    app = undefined;

    expect(order).toEqual(['worker', 'queue', 'connection']);
    await vi.waitFor(() => expect(client.status).toBe('end'));
  });
});
