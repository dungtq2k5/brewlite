import { describe, expect, it } from 'vitest';
import {
  REPORT_MAX_DAYS,
  businessDay,
  businessDayCount,
  businessDayRange,
  isBusinessDay,
  listBusinessDays,
  zBusinessDayRange,
} from './business-day.js';

describe('businessDay', () => {
  it('flips at Vietnam midnight, 17:00 UTC — not at UTC midnight', () => {
    expect(businessDay(new Date('2026-10-20T16:59:59Z'))).toBe('2026-10-20');
    expect(businessDay(new Date('2026-10-20T17:00:00Z'))).toBe('2026-10-21');
    expect(businessDay(new Date('2026-10-21T00:00:00Z'))).toBe('2026-10-21');
    expect(businessDay(new Date('2026-10-21T16:59:59.999Z'))).toBe('2026-10-21');
  });

  it('crosses a month and a year the same way', () => {
    expect(businessDay(new Date('2026-12-31T17:00:00Z'))).toBe('2027-01-01');
    expect(businessDay(new Date('2028-02-28T17:00:00Z'))).toBe('2028-02-29');
  });
});

describe('businessDayRange', () => {
  it('is [from 00:00, to+1 00:00) in Vietnam time, as UTC instants', () => {
    const { start, end } = businessDayRange('2026-10-21', '2026-10-21');
    expect(start.toISOString()).toBe('2026-10-20T17:00:00.000Z');
    expect(end.toISOString()).toBe('2026-10-21T17:00:00.000Z');
  });

  it('puts the two sides of Vietnam midnight in different days', () => {
    const { start, end } = businessDayRange('2026-10-21', '2026-10-22');
    const before = new Date(start.getTime() - 1);
    const last = new Date(end.getTime() - 1);
    expect(businessDay(before)).toBe('2026-10-20');
    expect(businessDay(start)).toBe('2026-10-21');
    expect(businessDay(last)).toBe('2026-10-22');
    expect(businessDay(end)).toBe('2026-10-23');
  });
});

describe('helpers', () => {
  it('counts and lists days inclusively', () => {
    expect(businessDayCount('2026-10-01', '2026-10-01')).toBe(1);
    expect(businessDayCount('2026-10-01', '2026-10-31')).toBe(31);
    expect(listBusinessDays('2026-10-30', '2026-11-02')).toEqual([
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
      '2026-11-02',
    ]);
  });

  it('accepts real dates only', () => {
    expect(isBusinessDay('2026-10-21')).toBe(true);
    expect(isBusinessDay('2028-02-29')).toBe(true);
    for (const bad of ['2026-02-30', '2026-13-01', '2026-1-1', '21-10-2026', '', 'nope']) {
      expect(isBusinessDay(bad)).toBe(false);
    }
  });
});

describe('zBusinessDayRange', () => {
  it('allows 93 days and refuses 94', () => {
    expect(REPORT_MAX_DAYS).toBe(93);
    expect(zBusinessDayRange.safeParse({ from: '2026-07-01', to: '2026-10-01' }).success).toBe(
      true,
    ); // 93 days
    expect(zBusinessDayRange.safeParse({ from: '2026-07-01', to: '2026-10-02' }).success).toBe(
      false,
    ); // 94
  });

  it('refuses from after to, and a day that does not exist', () => {
    expect(zBusinessDayRange.safeParse({ from: '2026-10-02', to: '2026-10-01' }).success).toBe(
      false,
    );
    expect(zBusinessDayRange.safeParse({ from: '2026-02-30', to: '2026-03-01' }).success).toBe(
      false,
    );
    expect(zBusinessDayRange.safeParse({ from: '2026-10-01', to: '2026-10-01' }).success).toBe(
      true,
    );
  });
});
