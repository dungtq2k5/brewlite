import { describe, expect, it } from 'vitest';
import { compareStrings, normalizeText, zText } from './text.js';

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

describe('compareStrings', () => {
  it('sorts in UTF-16 code-unit order', () => {
    expect(['b', 'a', 'C'].toSorted(compareStrings)).toEqual(['C', 'a', 'b']);
  });
});
