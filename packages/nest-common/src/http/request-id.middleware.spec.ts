import { describe, expect, it, vi } from 'vitest';
import { requestIdMiddleware } from './request-id.middleware.js';

function fakeReq(headerValue?: string) {
  return { header: (_name: string) => headerValue, id: undefined as unknown } as never;
}

function fakeRes() {
  const headers: Record<string, string> = {};
  return { setHeader: (key: string, value: string) => (headers[key] = value), headers } as never;
}

describe('requestIdMiddleware', () => {
  it('keeps a valid X-Request-Id header', () => {
    const req = fakeReq('check-6') as { id?: string };
    const res = fakeRes() as { headers: Record<string, string> };
    const next = vi.fn();
    requestIdMiddleware(req as never, res as never, next);
    expect(req.id).toBe('check-6');
    expect(res.headers['X-Request-Id']).toBe('check-6');
    expect(next).toHaveBeenCalledOnce();
  });

  it('replaces an invalid header with a generated UUIDv7', () => {
    const req = fakeReq('has spaces!!') as { id?: string };
    const res = fakeRes() as { headers: Record<string, string> };
    requestIdMiddleware(req as never, res as never, vi.fn());
    expect(req.id).not.toBe('has spaces!!');
    expect(req.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('generates a UUIDv7 when no header is sent', () => {
    const req = fakeReq(undefined) as { id?: string };
    const res = fakeRes() as { headers: Record<string, string> };
    requestIdMiddleware(req as never, res as never, vi.fn());
    expect(req.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.headers['X-Request-Id']).toBe(req.id);
  });
});
