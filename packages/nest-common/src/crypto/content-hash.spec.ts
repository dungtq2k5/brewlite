import { describe, expect, it } from 'vitest';
import { contentHash } from './content-hash.js';

describe('contentHash', () => {
  it('key order does not change the hash', () => {
    expect(contentHash({ a: 1, b: 2 })).toBe(contentHash({ b: 2, a: 1 }));
  });

  it('array order does change the hash', () => {
    expect(contentHash({ items: [1, 2] })).not.toBe(contentHash({ items: [2, 1] }));
  });

  it('an undefined-valued key is the same as an absent one', () => {
    expect(contentHash({ a: undefined })).toBe(contentHash({}));
  });

  it('is stable and deterministic for the same nested value', () => {
    const value = { items: [{ b: 1, a: 2 }], note: 'x' };
    expect(contentHash(value)).toBe(contentHash(value));
  });

  it('a different value hashes differently', () => {
    expect(contentHash({ a: 1 })).not.toBe(contentHash({ a: 2 }));
  });
});
