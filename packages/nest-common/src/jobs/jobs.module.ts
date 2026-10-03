import {
  Inject,
  Injectable,
  Logger,
  Module,
  type DynamicModule,
  type OnModuleDestroy,
  type OnModuleInit,
  type Type,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';

/** A job is a class with `run(now)` — tests call it directly, no worker involved (conventions §8.3). */
export interface RunnableJob {
  run(now?: Date): Promise<void>;
}

export interface JobDefinition {
  name: string;
  everyMs: number;
  job: Type<RunnableJob>;
}

export const JOBS_REDIS_CLIENT = Symbol('JOBS_REDIS_CLIENT');
const JOB_DEFINITIONS = Symbol('JOB_DEFINITIONS');
const JOBS_QUEUE_NAME = Symbol('JOBS_QUEUE_NAME');

/**
 * Registers each job's `upsertJobScheduler` and runs one `Worker` that dispatches by job
 * name to the class's `run()` (architecture §2.6). `moduleRef.get(..., { strict: false })`
 * searches the whole application, not just this dynamic module — the job classes are
 * providers of the *importing* service's own module tree (they need that service's
 * `PrismaModule` etc., which nest-common cannot import), never of `JobsModule` itself.
 */
@Injectable()
class JobsRunner implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(JobsRunner.name);
  private queue?: Queue;
  private worker?: Worker;

  constructor(
    @Inject(JOBS_REDIS_CLIENT) private readonly connection: Redis,
    @Inject(JOB_DEFINITIONS) private readonly definitions: JobDefinition[],
    @Inject(JOBS_QUEUE_NAME) private readonly queueName: string,
    private readonly moduleRef: ModuleRef,
  ) {}

  async onModuleInit(): Promise<void> {
    if (this.definitions.length === 0) return;
    this.queue = new Queue(this.queueName, { connection: this.connection });
    for (const def of this.definitions) {
      await this.queue.upsertJobScheduler(def.name, { every: def.everyMs }, { name: def.name });
    }
    this.worker = new Worker(
      this.queueName,
      async (bullJob) => {
        const def = this.definitions.find((d) => d.name === bullJob.name);
        if (!def) throw new Error(`JobsModule: no job registered for "${bullJob.name}"`);
        this.logger.log(`running ${def.name} (pid ${process.pid})`);
        const instance = this.moduleRef.get(def.job, { strict: false });
        await instance.run(new Date());
      },
      { connection: this.connection },
    );
  }

  /**
   * The worker closes before the queue, before the connection. BullMQ never closes a
   * `connection` it was handed (it assumes the caller owns it) — skipping `quit()` here
   * leaves the process unable to exit on its own.
   */
  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
    await this.connection.quit();
  }
}

/**
 * BullMQ, once (architecture §2.6). Its own Redis connection built from `REDIS_URL` —
 * `maxRetriesPerRequest: null`, waits for Redis instead of failing fast, the opposite of
 * the cache's/rate limiter's fail-fast client, and never shared with them. `stableConnection`
 * lets a readiness check `PING` the same client this module uses.
 */
@Module({})
export class JobsModule {
  static forRoot(options: {
    queue: string;
    jobs: JobDefinition[];
    imports?: DynamicModule['imports'];
  }): DynamicModule {
    return {
      module: JobsModule,
      global: true, // JOBS_REDIS_CLIENT and the job classes must reach OpsModule's readiness factory too — a sibling import cannot see them otherwise (Nest module encapsulation).
      imports: [ConfigModule, ...(options.imports ?? [])],
      providers: [
        ...options.jobs.map((d) => d.job),
        { provide: JOB_DEFINITIONS, useValue: options.jobs },
        { provide: JOBS_QUEUE_NAME, useValue: options.queue },
        {
          provide: JOBS_REDIS_CLIENT,
          inject: [ConfigService],
          useFactory: (config: ConfigService<{ REDIS_URL: string }, true>): Redis =>
            new Redis(config.get('REDIS_URL', { infer: true }), { maxRetriesPerRequest: null }),
        },
        JobsRunner,
      ],
      exports: [JOBS_REDIS_CLIENT, ...options.jobs.map((d) => d.job)],
    };
  }
}
