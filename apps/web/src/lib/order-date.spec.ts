import { describe, expect, it } from 'vitest';
import { formatOrderDate } from './order-date';

// 21 Oct 2026, 10:00 in Vietnam.
const NOW = new Date('2026-10-21T03:00:00Z');

describe('formatOrderDate', () => {
  it('says Today and Yesterday, with the Vietnam clock time', () => {
    expect(formatOrderDate('2026-10-21T07:20:00Z', 'en', NOW)).toBe('Today, 14:20');
    expect(formatOrderDate('2026-10-20T01:12:00Z', 'en', NOW)).toBe('Yesterday, 08:12');
    expect(formatOrderDate('2026-10-21T07:20:00Z', 'vi', NOW)).toBe('Hôm nay, 14:20');
    expect(formatOrderDate('2026-10-20T01:12:00Z', 'vi', NOW)).toBe('Hôm qua, 08:12');
  });

  it('writes an older date as 21 Oct / 21/10', () => {
    expect(formatOrderDate('2026-10-18T10:45:00Z', 'en', NOW)).toBe('18 Oct, 17:45');
    expect(formatOrderDate('2026-10-18T10:45:00Z', 'vi', NOW)).toBe('18/10, 17:45');
  });

  it('adds the year to a date from another year', () => {
    expect(formatOrderDate('2025-12-30T10:45:00Z', 'en', NOW)).toBe('30 Dec 2025, 17:45');
    expect(formatOrderDate('2025-12-30T10:45:00Z', 'vi', NOW)).toBe('30/12/2025, 17:45');
  });

  it('flips at Vietnam midnight (17:00 UTC), not UTC midnight', () => {
    // 20 Oct 23:59 VN is still yesterday when "now" is 21 Oct; 00:00 VN on the 21st is today.
    expect(formatOrderDate('2026-10-20T16:59:00Z', 'en', NOW)).toBe('Yesterday, 23:59');
    expect(formatOrderDate('2026-10-20T17:00:00Z', 'en', NOW)).toBe('Today, 00:00');
    // And "now" itself just either side of its own midnight.
    const justBefore = new Date('2026-10-21T16:59:59Z');
    const justAfter = new Date('2026-10-21T17:00:00Z');
    expect(formatOrderDate('2026-10-21T10:00:00Z', 'en', justBefore)).toBe('Today, 17:00');
    expect(formatOrderDate('2026-10-21T10:00:00Z', 'en', justAfter)).toBe('Yesterday, 17:00');
  });
});
