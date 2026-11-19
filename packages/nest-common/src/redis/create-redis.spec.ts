import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import { Redis } from 'ioredis';
import {
  attachOutageLog,
  createRedis,
  isConnectionError,
  RedisOutageLog,
  watchRedisErrors,
} from './create-redis.js';

function setup() {
  const logger = { error: vi.fn(), warn: vi.fn(), log: vi.fn() };
  let now = 1_000;
  const client = new EventEmitter();
  attachOutageLog(client, new RedisOutageLog('test-client', logger, () => now));
  const refused = Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' });
  return { logger, client, refused, advance: (ms: number) => (now += ms) };
}

describe('RedisOutageLog', () => {
  it('logs one error per outage and one info line with its length on recovery', () => {
    const { logger, client, refused, advance } = setup();
    client.emit('error', refused);
    advance(300);
    client.emit('error', refused);
    client.emit('error', refused);
    advance(29_700);
    client.emit('ready');

    expect(logger.error).toHaveBeenCalledOnce();
    expect(logger.error).toHaveBeenCalledWith(
      { client: 'test-client', code: 'ECONNREFUSED' },
      'redis unreachable',
    );
    expect(logger.log).toHaveBeenCalledOnce();
    expect(logger.log).toHaveBeenCalledWith(
      { client: 'test-client', downMs: 30_000 },
      'redis reconnected',
    );
  });

  it('logs a second outage again; a ready without an outage logs nothing', () => {
    const { logger, client, refused } = setup();
    client.emit('ready');
    expect(logger.log).not.toHaveBeenCalled();
    client.emit('error', refused);
    client.emit('ready');
    client.emit('error', refused);
    client.emit('ready');
    expect(logger.error).toHaveBeenCalledTimes(2);
    expect(logger.log).toHaveBeenCalledTimes(2);
  });

  it('warns once when the client gives up', () => {
    const { logger, client } = setup();
    client.emit('end');
    client.emit('end');
    expect(logger.warn).toHaveBeenCalledOnce();
  });
});

describe('isConnectionError', () => {
  const coded = (code: string) => Object.assign(new Error(code), { code });
  it('is a system code or a closed connection', () => {
    expect(isConnectionError(coded('ECONNREFUSED'))).toBe(true);
    expect(isConnectionError(coded('EAI_AGAIN'))).toBe(true);
    expect(isConnectionError(new Error('Connection is closed.'))).toBe(true);
  });
  it('is not a command or BullMQ error', () => {
    expect(isConnectionError(new Error('Missing lock for job 1'))).toBe(false);
    expect(isConnectionError(coded('NOSCRIPT'))).toBe(false);
  });
});

describe('watchRedisErrors', () => {
  // `lazyConnect`: the client never opens a connection — nothing here needs a Redis.
  function watched() {
    const logger = { error: vi.fn(), warn: vi.fn(), log: vi.fn() };
    const client = createRedis(
      'redis://127.0.0.1:1',
      { lazyConnect: true },
      { name: 'jobs', logger },
    );
    const queue = new EventEmitter();
    watchRedisErrors(queue, client);
    return { logger, client, queue };
  }

  it('refuses a client createRedis did not make', () => {
    const plain = new Redis({ lazyConnect: true });
    expect(() => watchRedisErrors(new EventEmitter(), plain)).toThrow(
      'watchRedisErrors: the client was not made by createRedis',
    );
  });

  it('logs a BullMQ error that is NOT a connection failure, every time', () => {
    const { logger, queue } = watched();
    const err = new Error('Missing lock for job 1');
    queue.emit('error', err);
    queue.emit('error', err);
    expect(logger.error).toHaveBeenCalledTimes(2);
    expect(logger.error).toHaveBeenCalledWith({ client: 'jobs', err }, 'redis client error');
  });

  it('folds a re-emitted connection failure into the client’s ONE outage line', () => {
    const { logger, client, queue } = watched();
    const refused = Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' });
    queue.emit('error', refused); // before the client itself has reported anything
    expect(logger.error).toHaveBeenCalledOnce();
    client.emit('error', refused);
    queue.emit('error', refused);
    expect(logger.error).toHaveBeenCalledOnce();
    expect(logger.error).toHaveBeenCalledWith(
      { client: 'jobs', code: 'ECONNREFUSED' },
      'redis unreachable',
    );
  });
});
