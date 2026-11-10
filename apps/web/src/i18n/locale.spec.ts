import { describe, expect, it } from 'vitest';
import { resolveLocale } from './locale';

describe('resolveLocale', () => {
  it('uses a supported cookie, else English', () => {
    expect(resolveLocale('vi')).toBe('vi');
    expect(resolveLocale('en')).toBe('en');
    expect(resolveLocale('fr')).toBe('en');
    expect(resolveLocale(undefined)).toBe('en');
  });
});
