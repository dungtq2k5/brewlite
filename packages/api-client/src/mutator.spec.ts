import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiClientError } from './api-client-error.js';
import { configureApiClient } from './configure.js';
import { apiFetch } from './mutator.js';

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  configureApiClient({
    baseUrl: 'http://gateway.test/api/v1',
    getRequestHeaders: async () => ({ Authorization: 'Bearer t', 'X-Request-Id': 'req-1' }),
  });
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('apiFetch', () => {
  it('prefixes the base URL, applies the supplied headers and never caches', async () => {
    fetchMock.mockResolvedValueOnce(json(200, { data: { id: 1 } }));
    await apiFetch('/orders/me', { method: 'GET' });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://gateway.test/api/v1/orders/me');
    expect(init.cache).toBe('no-store');
    const headers = new Headers(init.headers);
    expect(headers.get('Authorization')).toBe('Bearer t');
    expect(headers.get('X-Request-Id')).toBe('req-1');
  });

  it('sets JSON content type for a body, and keeps a caller-supplied Idempotency-Key', async () => {
    fetchMock.mockResolvedValueOnce(json(201, { data: {} }));
    await apiFetch('/orders', {
      method: 'POST',
      body: '{}',
      headers: { 'Idempotency-Key': 'k-1' },
    });
    const headers = new Headers((fetchMock.mock.calls[0] as [string, RequestInit])[1].headers);
    expect(headers.get('Content-Type')).toBe('application/json');
    expect(headers.get('Idempotency-Key')).toBe('k-1');
  });

  it('returns Orval’s { data, status, headers } with the envelope left whole', async () => {
    fetchMock.mockResolvedValueOnce(json(200, { data: [1], meta: { nextCursor: null } }));
    const result = await apiFetch<{ data: unknown; status: number; headers: Headers }>('/x');
    expect(result.status).toBe(200);
    expect(result.data).toEqual({ data: [1], meta: { nextCursor: null } });
    expect(result.headers).toBeInstanceOf(Headers);
  });

  it('a 204 has no body', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    const result = await apiFetch<{ data: unknown; status: number }>('/x', { method: 'DELETE' });
    expect(result).toMatchObject({ status: 204, data: undefined });
  });

  it('an error envelope becomes ApiClientError with its fields', async () => {
    fetchMock.mockResolvedValueOnce(
      json(409, {
        error: { code: 'ORDER_NOT_PAYABLE', details: { status: 'CANCELLED' }, requestId: 'r-9' },
      }),
    );
    const error = await apiFetch('/payments').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiClientError);
    expect(error).toMatchObject({
      status: 409,
      code: 'ORDER_NOT_PAYABLE',
      details: { status: 'CANCELLED' },
      requestId: 'r-9',
    });
  });

  it('a non-JSON error body (a proxy’s HTML) is INTERNAL', async () => {
    fetchMock.mockResolvedValueOnce(new Response('<html>502</html>', { status: 502 }));
    const error = await apiFetch('/x').catch((e: unknown) => e);
    expect(error).toMatchObject({ status: 502, code: 'INTERNAL' });
  });

  it('unconfigured → throws', async () => {
    vi.resetModules();
    const fresh = await import('./mutator.js');
    await expect(fresh.apiFetch('/x')).rejects.toThrow('not configured');
  });
});
