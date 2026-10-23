import { describe, expect, it } from 'vitest';
import { safeNextPath } from './safe-next-path';

describe('safeNextPath', () => {
  it.each([
    '//evil.com',
    '/\\evil.com',
    'https://evil.com',
    '',
    undefined,
    null,
    'checkout',
    '/a\nb',
  ])('refuses %j', (value) => expect(safeNextPath(value)).toBe('/'));
  it.each(['/checkout?x=1', '/orders/abc', '/'])('keeps %s', (value) =>
    expect(safeNextPath(value)).toBe(value),
  );
});
