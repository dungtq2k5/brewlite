import { NotFoundException, type ArgumentsHost } from '@nestjs/common';
import { Metadata } from '@grpc/grpc-js';
import { z } from 'zod';
import { ZodValidationException } from 'nestjs-zod';
import { describe, expect, it, vi } from 'vitest';
import { ErrorFilter } from './error.filter.js';

function fakeHost(): {
  host: ArgumentsHost;
  res: { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> };
} {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  const res = { status, json };
  const req = { id: 'req-1' };
  const host = {
    switchToHttp: () => ({ getResponse: () => res, getRequest: () => req }),
  } as unknown as ArgumentsHost;
  return { host, res };
}

function body(res: { json: ReturnType<typeof vi.fn> }) {
  return res.json.mock.calls[0]?.[0] as {
    error: { code: string; message: string; details?: unknown; requestId: string };
  };
}

function serviceError(code: number, metadataEntries: [string, string | Buffer][] = []) {
  const metadata = new Metadata();
  for (const [k, v] of metadataEntries) metadata.set(k, v as never);
  return Object.assign(new Error('boom'), { code, metadata, details: 'boom' });
}

describe('ErrorFilter', () => {
  it('maps a Zod validation exception to 400 VALIDATION_FAILED with issues', () => {
    const filter = new ErrorFilter(false);
    const { host, res } = fakeHost();
    const zodError = z.object({ name: z.string() }).safeParse({}).error!;
    filter.catch(new ZodValidationException(zodError), host);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(body(res).error.code).toBe('VALIDATION_FAILED');
    expect((body(res).error.details as { issues: unknown[] }).issues.length).toBeGreaterThan(0);
  });

  it('maps a body-parser failure to 400 MALFORMED_REQUEST', () => {
    const filter = new ErrorFilter(false);
    const { host, res } = fakeHost();
    filter.catch({ type: 'entity.parse.failed' }, host);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(body(res).error.code).toBe('MALFORMED_REQUEST');
  });

  it('maps NotFoundException to 404 ROUTE_NOT_FOUND', () => {
    const filter = new ErrorFilter(false);
    const { host, res } = fakeHost();
    filter.catch(new NotFoundException(), host);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(body(res).error.code).toBe('ROUTE_NOT_FOUND');
  });

  it('maps a ServiceError with a known bl-error-code to its ERRORS status', () => {
    const filter = new ErrorFilter(false);
    const { host, res } = fakeHost();
    filter.catch(serviceError(2, [['bl-error-code', 'ROUTE_NOT_FOUND']]), host);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(body(res).error.code).toBe('ROUTE_NOT_FOUND');
  });

  it('maps a ServiceError with an unknown bl-error-code to 500 INTERNAL', () => {
    const filter = new ErrorFilter(false);
    const { host, res } = fakeHost();
    filter.catch(serviceError(2, [['bl-error-code', 'NOT_A_REAL_CODE']]), host);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(body(res).error.code).toBe('INTERNAL');
  });

  it('maps a codeless UNAVAILABLE ServiceError to 503 UPSTREAM_UNAVAILABLE', () => {
    const filter = new ErrorFilter(false);
    const { host, res } = fakeHost();
    filter.catch(serviceError(14), host);
    expect(res.status).toHaveBeenCalledWith(503);
    expect(body(res).error.code).toBe('UPSTREAM_UNAVAILABLE');
  });

  it('maps a codeless DEADLINE_EXCEEDED ServiceError to 504 UPSTREAM_TIMEOUT', () => {
    const filter = new ErrorFilter(false);
    const { host, res } = fakeHost();
    filter.catch(serviceError(4), host);
    expect(res.status).toHaveBeenCalledWith(504);
    expect(body(res).error.code).toBe('UPSTREAM_TIMEOUT');
  });

  it('maps anything else to 500 INTERNAL', () => {
    const filter = new ErrorFilter(false);
    const { host, res } = fakeHost();
    filter.catch(new Error('unexpected'), host);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(body(res).error.code).toBe('INTERNAL');
  });

  it('every response carries requestId', () => {
    const filter = new ErrorFilter(false);
    const { host, res } = fakeHost();
    filter.catch(new Error('x'), host);
    expect(body(res).error.requestId).toBe('req-1');
  });

  it('in production, a 5xx gets a generic message but keeps its code', () => {
    const filter = new ErrorFilter(true);
    const { host, res } = fakeHost();
    filter.catch(new Error('leaky internal detail'), host);
    expect(body(res).error.code).toBe('INTERNAL');
    expect(body(res).error.message).not.toContain('leaky internal detail');
  });

  it('outside production, the message is the code', () => {
    const filter = new ErrorFilter(false);
    const { host, res } = fakeHost();
    filter.catch(new Error('x'), host);
    expect(body(res).error.message).toBe('INTERNAL');
  });
});
