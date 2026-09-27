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
});
