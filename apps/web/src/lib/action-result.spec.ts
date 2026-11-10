import { describe, expect, it, vi } from 'vitest';

vi.mock('@brewlite/api-client', () => ({
  ApiClientError: class extends Error {
    constructor(
      readonly status: number,
      readonly code: string,
      readonly details: unknown,
      readonly requestId?: string,
    ) {
      super(`${status} ${code}`);
    }
  },
}));

const { toResult } = await import('./action-result');
const { ApiClientError } = await import('@brewlite/api-client');

describe('toResult', () => {
  it('wraps a success', async () => {
    expect(await toResult(async () => 7)).toEqual({ ok: true, data: 7 });
  });
  it('maps an API error to its code and details — it never throws into the UI', async () => {
    const result = await toResult(async () => {
      throw new ApiClientError(403, 'ACCOUNT_LOCKED', { lockedUntil: null }, 'r1');
    });
    expect(result).toEqual({ ok: false, code: 'ACCOUNT_LOCKED', details: { lockedUntil: null } });
  });
  it('maps anything else to INTERNAL', async () => {
    const result = await toResult(async () => {
      throw new TypeError('fetch failed');
    });
    expect(result).toEqual({ ok: false, code: 'INTERNAL' });
  });
});
