import { Metadata, status } from '@grpc/grpc-js';
import { describe, expect, it } from 'vitest';
import { localErrorCode } from '@brewlite/nest-common';
import { rethrowOrderingError } from './ordering-errors.js';

/** What grpc-js rejects with on the client: `code`, `details`, `metadata` — no `RpcException`. */
function serviceError(code: number, entries: Record<string, string | Buffer> = {}) {
  const metadata = new Metadata();
  for (const [key, value] of Object.entries(entries)) metadata.set(key, value);
  return Object.assign(new Error('from ordering'), { code, details: 'from ordering', metadata });
}

function caught(error: unknown): unknown {
  try {
    rethrowOrderingError(error);
  } catch (e) {
    return e;
  }
  throw new Error('rethrowOrderingError returned');
}

function detailsOf(error: unknown): unknown {
  const { metadata } = (error as { getError(): { metadata: Metadata } }).getError();
  const raw = metadata.get('bl-error-details-bin')[0];
  return raw === undefined ? undefined : JSON.parse(raw.toString());
}

describe('rethrowOrderingError', () => {
  it("rebuilds ordering's refusal as payment's own error, its code and details UNCHANGED", () => {
    const original = serviceError(status.FAILED_PRECONDITION, {
      'bl-error-code': 'INVALID_STATE',
      'bl-error-details-bin': Buffer.from(JSON.stringify({ status: 'PAID' })),
    });

    const error = caught(original);

    expect(error).not.toBe(original);
    expect(localErrorCode(error)).toBe('INVALID_STATE');
    expect(detailsOf(error)).toEqual({ status: 'PAID' });
  });

  it('rebuilds a refusal that carries no details', () => {
    const error = caught(serviceError(status.NOT_FOUND, { 'bl-error-code': 'ROUTE_NOT_FOUND' }));
    expect(localErrorCode(error)).toBe('ROUTE_NOT_FOUND');
    expect(detailsOf(error)).toBeUndefined();
  });

  it.each([
    ['an UNAVAILABLE peer, no bl-error-code', serviceError(status.UNAVAILABLE)],
    ['an UNKNOWN code', serviceError(status.INTERNAL, { 'bl-error-code': 'NOT_A_CODE' })],
    ['a plain Error (a bug)', new Error('boom')],
    ['a non-error value', 'boom'],
  ])('rethrows %s as-is', (_label, original) => {
    expect(caught(original)).toBe(original);
  });
});
