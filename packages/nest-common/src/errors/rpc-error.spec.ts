import { status, type Metadata } from '@grpc/grpc-js';
import { describe, expect, it } from 'vitest';
import { rpcError } from './rpc-error.js';

describe('rpcError', () => {
  it('puts bl-error-code in a real grpc-js Metadata', () => {
    const exception = rpcError('ROUTE_NOT_FOUND');
    const error = exception.getError() as { code: number; metadata: Metadata };
    expect(error.code).toBe(status.NOT_FOUND);
    expect(error.metadata.get('bl-error-code')).toEqual(['ROUTE_NOT_FOUND']);
    expect(error.metadata.get('bl-error-details-bin')).toEqual([]);
  });

  it('puts details as UTF-8 JSON in bl-error-details-bin', () => {
    const exception = rpcError('VALIDATION_FAILED', {
      issues: [{ path: '/name', code: 'invalid_type' }],
    });
    const error = exception.getError() as { metadata: Metadata };
    const [raw] = error.metadata.get('bl-error-details-bin');
    const buffer = Buffer.isBuffer(raw) ? raw : Buffer.from(raw as string, 'binary');
    expect(JSON.parse(buffer.toString('utf8'))).toEqual({
      issues: [{ path: '/name', code: 'invalid_type' }],
    });
  });

  it('parses and round-trips valid details through the code schema', () => {
    const exception = rpcError('OUT_OF_STOCK', {
      products: [{ productId: '01a0d799-fda1-7c3e-8da5-3b5de192d879', available: 0 }],
    });
    const error = exception.getError() as { metadata: Metadata };
    const [raw] = error.metadata.get('bl-error-details-bin');
    const buffer = Buffer.isBuffer(raw) ? raw : Buffer.from(raw as string, 'binary');
    expect(JSON.parse(buffer.toString('utf8'))).toEqual({
      products: [{ productId: '01a0d799-fda1-7c3e-8da5-3b5de192d879', available: 0 }],
    });
  });

  it('throws when details do not match the code schema', () => {
    expect(() =>
      // @ts-expect-error — deliberately the wrong shape, to prove the runtime check too
      rpcError('OUT_OF_STOCK', { wrong: true }),
    ).toThrow();
  });

  it('is a compile error to omit required details', () => {
    expect(() => {
      // @ts-expect-error — OUT_OF_STOCK requires details
      rpcError('OUT_OF_STOCK');
    }).toThrow();
  });

  it('refuses details for a code that takes none — at compile time AND at runtime', () => {
    expect(() =>
      // @ts-expect-error — INTERNAL takes no details
      rpcError('INTERNAL', { x: 1 }),
    ).toThrow('INTERNAL takes no details');
  });
});
