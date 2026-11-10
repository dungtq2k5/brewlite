import { describe, expect, it } from 'vitest';
import { withRequestId } from './with-request-id';

describe('withRequestId', () => {
  it('makes the request id the error digest', () => {
    const error = Object.assign(new Error('503 UPSTREAM_UNAVAILABLE'), { requestId: 'req-1' });
    expect((withRequestId(error) as { digest?: string }).digest).toBe('req-1');
  });
  it('leaves errors without a request id alone', () => {
    const error = new TypeError('fetch failed');
    expect((withRequestId(error) as { digest?: string }).digest).toBeUndefined();
    expect(withRequestId('x')).toBe('x');
  });
});
