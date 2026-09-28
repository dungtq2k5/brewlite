import { describe, expect, it } from 'vitest';
import { zLocalizedText } from './localized-text.js';

describe('zLocalizedText', () => {
  it('requires both languages', () => {
    expect(zLocalizedText(60).safeParse({ en: 'Coffee' }).success).toBe(false);
  });

  it('trims and NFC-normalises each language', () => {
    const result = zLocalizedText(60).safeParse({ en: '  Coffee  ', vi: '  Cà phê  ' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual({ en: 'Coffee', vi: 'Cà phê' });
  });

  it('refuses an unknown key', () => {
    expect(zLocalizedText(60).safeParse({ en: 'Coffee', vi: 'Cà phê', fr: 'Café' }).success).toBe(
      false,
    );
  });
});
