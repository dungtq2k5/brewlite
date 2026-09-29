import { describe, expect, it } from 'vitest';
import { compareStrings, normalizeEmail, normalizeText, zEmail, zPassword, zText } from './text.js';

describe('normalizeText', () => {
  it('normalises to NFC and trims', () => {
    // "Cà" written as combining characters (NFD) vs precomposed (NFC).
    const nfd = 'Cà phê';
    expect(normalizeText(`  ${nfd}  `)).toBe(nfd.normalize('NFC'));
  });
});

describe('zText', () => {
  it('normalises before measuring bounds', () => {
    const schema = zText(10);
    const result = schema.safeParse('  Cà phê  ');
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe('Cà phê');
  });

  it('refuses a string shorter than min after normalising', () => {
    expect(zText(10, { min: 3 }).safeParse('  a  ').success).toBe(false);
  });

  it('refuses a string longer than max', () => {
    expect(zText(3).safeParse('abcd').success).toBe(false);
  });
});

describe('normalizeEmail', () => {
  it('trims and lower-cases', () => {
    expect(normalizeEmail('  Person@Example.com  ')).toBe('person@example.com');
  });
});

describe('zEmail', () => {
  it('lower-cases and trims before validating', () => {
    const result = zEmail.safeParse('  Person@Example.com  ');
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe('person@example.com');
  });

  it('refuses a malformed address', () => {
    expect(zEmail.safeParse('not-an-email').success).toBe(false);
  });
});

describe('zPassword', () => {
  it('passes 72 ASCII bytes', () => {
    expect(zPassword.safeParse('a'.repeat(72)).success).toBe(true);
  });

  it('refuses 25 × ệ (3 bytes each, 75 total)', () => {
    expect(zPassword.safeParse('ệ'.repeat(25)).success).toBe(false);
  });

  it('passes 8 bytes', () => {
    expect(zPassword.safeParse('a'.repeat(8)).success).toBe(true);
  });

  it('refuses 7 bytes', () => {
    expect(zPassword.safeParse('a'.repeat(7)).success).toBe(false);
  });

  it('is not trimmed or normalised', () => {
    const result = zPassword.safeParse('  password  ');
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe('  password  ');
  });
});

describe('compareStrings', () => {
  it('sorts in UTF-16 code-unit order', () => {
    expect(['b', 'a', 'C'].toSorted(compareStrings)).toEqual(['C', 'a', 'b']);
  });
});
