import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import { attachOutageLog, isConnectionError, RedisOutageLog } from './create-redis.js';

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
