import { describe, expect, it } from 'vitest';
import { formatDateTime, formatVnd, localized } from './format';

describe('formatVnd', () => {
  it('puts the symbol first in English and last in Vietnamese', () => {
    expect(formatVnd(29000, 'en')).toBe('₫29,000');
    expect(formatVnd('29000', 'vi').replace(/\s/g, ' ')).toBe('29.000 ₫');
  });
});

describe('formatDateTime', () => {
  it('is always Vietnam time', () => {
    // 17:30 UTC on 20 Oct is 00:30 on 21 Oct in Ho Chi Minh City.
    expect(formatDateTime('2026-10-20T17:30:00Z', 'en')).toBe('00:30, 21 Oct');
    expect(formatDateTime('2026-10-20T17:30:00Z', 'vi')).toBe('00:30, 21/10');
  });
  it('rolls the day at midnight UTC+7, not UTC', () => {
    expect(formatDateTime('2026-10-20T16:59:00Z', 'vi')).toBe('23:59, 20/10');
    expect(formatDateTime('2026-10-20T17:00:00Z', 'vi')).toBe('00:00, 21/10');
  });
  it('shows the handoff example', () => {
    expect(formatDateTime('2026-10-21T07:30:00Z', 'en')).toBe('14:30, 21 Oct');
  });
});

describe('localized', () => {
  it('picks the viewer language', () => {
    const name = { en: 'Milk tea', vi: 'Trà sữa' };
    expect(localized(name, 'en')).toBe('Milk tea');
    expect(localized(name, 'vi')).toBe('Trà sữa');
  });
});
