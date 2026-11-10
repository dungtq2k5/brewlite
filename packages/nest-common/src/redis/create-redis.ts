import type { EventEmitter } from 'node:events';
import { Logger } from '@nestjs/common';
import { Redis, type RedisOptions } from 'ioredis';

interface ErrorEmitter {
  on(event: 'error', listener: (error: Error) => void): unknown;
}

type OutageLogger = Pick<Logger, 'error' | 'warn' | 'log'>;

/**
 * One line when a Redis outage starts, one when it ends — ioredis retries every few hundred
 * milliseconds, and a line per retry would flood the logs (conventions §13.1).
 */
export class RedisOutageLog {
  private downSince?: number;
  private ended = false;

  constructor(
    private readonly name: string,
    private readonly logger: OutageLogger,
    private readonly now: () => number = Date.now,
  ) {}

  error(error: Error & { code?: string }): void {
    if (this.downSince !== undefined) return;
    this.downSince = this.now();
    this.logger.error({ client: this.name, code: error.code ?? error.name }, 'redis unreachable');
  }

  ready(): void {
    if (this.downSince === undefined) return;
    const downMs = this.now() - this.downSince;
    this.downSince = undefined;
    this.ended = false;
    this.logger.log({ client: this.name, downMs }, 'redis reconnected');
  }

  /** The client gave up — only with a retry strategy that stops; ours do not (a safety net). */
  end(): void {
    if (this.ended) return;
    this.ended = true;
    this.logger.warn({ client: this.name }, 'redis connection ended');
  }
}

const outages = new WeakMap<
  Redis,
  { outage: RedisOutageLog; logger: OutageLogger; name: string }
>();

/** Attaches the outage log to a client — `error`, `ready`, `end`. Exported for tests. */
export function attachOutageLog(client: Pick<EventEmitter, 'on'>, outage: RedisOutageLog): void {
  client.on('error', (error: Error) => outage.error(error));
  client.on('ready', () => outage.ready());
  client.on('end', () => outage.end());
}

/**
 * Every long-lived Redis client: ioredis with its listeners attached before it connects, so a
 * stopped Redis reaches the structured logs once per outage and never stderr
 * ("Unhandled error event"). The options are the caller's, unchanged.
 */
export function createRedis(
  url: string,
  options: RedisOptions,
  { name, logger = new Logger('Redis') }: { name: string; logger?: OutageLogger },
): Redis {
  const client = new Redis(url, options);
  const outage = new RedisOutageLog(name, logger);
  attachOutageLog(client, outage);
  outages.set(client, { outage, logger, name });
  return client;
}

/** A failure to reach Redis (a system `E…` code, or ioredis' closed connection), not a command error. */
export function isConnectionError(error: Error & { code?: unknown }): boolean {
  return (
    (typeof error.code === 'string' && /^E[A-Z_]+$/.test(error.code)) ||
    error.message.includes('Connection is closed')
  );
}

/**
 * BullMQ re-emits its connections' failures on each `Queue` / `Worker`; without a listener it
 * falls back to `console.error`. A connection failure joins the client's outage log (one outage,
 * one line) — or, once the client is back, is a straggler from BullMQ's own duplicate connection
 * and is dropped. Any other error is BullMQ's own and is logged as it comes.
 */
export function watchRedisErrors(emitter: ErrorEmitter, client: Redis): void {
  const watched = outages.get(client);
  if (!watched) throw new Error('watchRedisErrors: the client was not made by createRedis');
  emitter.on('error', (error) => {
    if (!isConnectionError(error)) {
      watched.logger.error({ client: watched.name, err: error }, 'redis client error');
    } else if (client.status !== 'ready') {
      watched.outage.error(error);
    }
  });
}
