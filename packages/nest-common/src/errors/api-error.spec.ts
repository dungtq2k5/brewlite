import { describe, expect, it } from 'vitest';
import { apiError, ApiError } from './api-error.js';

describe('apiError', () => {
  it('builds an ApiError with the code and parsed details', () => {
    const error = apiError('RATE_LIMITED', { retryAfterSeconds: 30 });
    expect(error).toBeInstanceOf(ApiError);
    expect(error.code).toBe('RATE_LIMITED');
    expect(error.details).toEqual({ retryAfterSeconds: 30 });
  });

  it('a code with no details schema carries none', () => {
    const error = apiError('UNAUTHENTICATED');
    expect(error.details).toBeUndefined();
  });

  it('refuses details for a code that takes none — at compile time AND at runtime', () => {
    expect(() =>
      // @ts-expect-error — UNAUTHENTICATED takes no details
      apiError('UNAUTHENTICATED', { x: 1 }),
    ).toThrow('UNAUTHENTICATED takes no details');
  });

  it('is a compile error to omit required details', () => {
    expect(() => {
      // @ts-expect-error — RATE_LIMITED requires details
      apiError('RATE_LIMITED');
    }).toThrow();
  });

  it('throws when details do not match the code schema', () => {
    expect(() =>
      // @ts-expect-error — deliberately the wrong shape
      apiError('RATE_LIMITED', { wrong: true }),
    ).toThrow();
  });
});
