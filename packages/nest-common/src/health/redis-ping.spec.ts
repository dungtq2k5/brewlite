import type { Redis } from 'ioredis';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { redisPingCheck } from './redis-ping.js';

const redisWith = (ping: () => Promise<string>) => ({ ping: vi.fn(ping) }) as unknown as Redis;

describe('redisPingCheck', () => {
  afterEach(() => vi.useRealTimers());

  it('is ready when PING answers', async () => {
    const redis = redisWith(() => Promise.resolve('PONG'));
    await expect(redisPingCheck(redis)()).resolves.toBe(true);
    expect(redis.ping).toHaveBeenCalledOnce();
  });

  it('is NOT ready when PING fails', async () => {
    const redis = redisWith(() => Promise.reject(new Error('ECONNREFUSED')));
    await expect(redisPingCheck(redis)()).resolves.toBe(false);
  });

  it('is NOT ready when PING hangs past the TIMEOUT, and never later flips to ready', async () => {
    vi.useFakeTimers();
    let answer!: (v: string) => void;
    const redis = redisWith(() => new Promise<string>((resolve) => (answer = resolve)));
    const result = redisPingCheck(redis, 200)();

    await vi.advanceTimersByTimeAsync(199);
    let settled = false;
    void result.then(() => (settled = true));
    await Promise.resolve();
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    answer('PONG'); // a late answer must not change the outcome
    await expect(result).resolves.toBe(false);
  });

  it('waits 500 ms by default', async () => {
    vi.useFakeTimers();
    const redis = redisWith(() => new Promise<string>(() => {}));
    const result = redisPingCheck(redis)();
    await vi.advanceTimersByTimeAsync(500);
    await expect(result).resolves.toBe(false);
  });
});
