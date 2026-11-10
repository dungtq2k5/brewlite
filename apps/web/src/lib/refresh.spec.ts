import { describe, expect, it, vi } from 'vitest';
import { refreshAccessToken } from './refresh';

const reply = (status: number, body?: unknown) =>
  vi.fn(async () => new Response(body ? JSON.stringify(body) : null, { status }));

describe('refreshAccessToken', () => {
  it('returns the new access token', async () => {
    const fetchImpl = reply(200, { data: { accessToken: 'a', accessTokenExpiresAt: 'iso' } });
    expect(await refreshAccessToken('http://api', 'rt', '9.9.9.9', fetchImpl)).toEqual({
      kind: 'refreshed',
      accessToken: 'a',
      accessTokenExpiresAt: 'iso',
    });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://api/auth/refresh');
    expect((init.headers as Record<string, string>)['X-Forwarded-For']).toBe('9.9.9.9');
    expect(init.body).toBe(JSON.stringify({ refreshToken: 'rt' }));
  });
  it('401 ends the session', async () => {
    expect(await refreshAccessToken('http://api', 'rt', undefined, reply(401))).toEqual({
      kind: 'expired',
    });
  });
  it('leaves the cookies alone on a network failure or another answer', async () => {
    const down = vi.fn(async () => Promise.reject(new TypeError('fetch failed')));
    expect(await refreshAccessToken('http://api', 'rt', undefined, down)).toEqual({
      kind: 'unchanged',
    });
    expect(await refreshAccessToken('http://api', 'rt', undefined, reply(503))).toEqual({
      kind: 'unchanged',
    });
    expect(await refreshAccessToken('http://api', 'rt', undefined, reply(200, {}))).toEqual({
      kind: 'unchanged',
    });
  });
});
