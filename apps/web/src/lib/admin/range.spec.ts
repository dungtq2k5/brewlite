import { describe, expect, it } from 'vitest';
import { checkRange, resolveRange, shiftDay, weekStart } from './range';

describe('range', () => {
  it('shifts across month and year ends', () => {
    expect(shiftDay('2026-03-01', -1)).toBe('2026-02-28');
    expect(shiftDay('2026-12-31', 1)).toBe('2027-01-01');
  });
  it('starts the week on Monday', () => {
    expect(weekStart('2026-11-01')).toBe('2026-10-26'); // a Sunday
    expect(weekStart('2026-10-26')).toBe('2026-10-26'); // a Monday
    expect(weekStart('2026-10-28')).toBe('2026-10-26');
  });
  it('resolves the presets', () => {
    const today = '2026-11-04'; // a Wednesday
    expect(resolveRange('today', today)).toEqual({ from: today, to: today });
    expect(resolveRange('7d', today)).toEqual({ from: '2026-10-29', to: today });
    expect(resolveRange('30d', today)).toEqual({ from: '2026-10-06', to: today });
    expect(resolveRange('month', today)).toEqual({ from: '2026-11-01', to: today });
    expect(resolveRange('thisWeek', today)).toEqual({ from: '2026-11-02', to: today });
    expect(resolveRange('lastWeek', today)).toEqual({ from: '2026-10-26', to: '2026-11-01' });
  });
  it('allows 93 days and flags 94', () => {
    expect(checkRange('2026-01-01', '2026-04-03')).toEqual({ ok: true, days: 93 });
    expect(checkRange('2026-01-01', '2026-04-04')).toEqual({
      ok: false,
      reason: 'tooLong',
      days: 94,
    });
  });
  it('refuses unreal or reversed ranges', () => {
    expect(checkRange('2026-02-30', '2026-03-01')).toEqual({ ok: false, reason: 'invalid' });
    expect(checkRange('2026-03-02', '2026-03-01')).toEqual({ ok: false, reason: 'invalid' });
  });
});
