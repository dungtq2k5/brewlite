import { describe, expect, it } from 'vitest';
import { newId, zUuidV7 } from './ids.js';

describe('zUuidV7', () => {
  it('accepts newId()', () => {
    expect(zUuidV7.safeParse(newId()).success).toBe(true);
  });

  it('refuses a valid v4 UUID', () => {
    // A well-formed UUIDv4 — version nibble is 4, not 7.
    expect(zUuidV7.safeParse('550e8400-e29b-41d4-a716-446655440000').success).toBe(false);
  });

  it('refuses a non-UUID string', () => {
    expect(zUuidV7.safeParse('not-a-uuid').success).toBe(false);
  });
});
