import { describe, expect, it } from 'vitest';
import { clockTime, deadlineView, msToNextMinute } from './deadline';

// 14:35 in Vietnam is 07:35Z.
const EXPIRES = '2026-10-30T07:35:00Z';
const at = (hhmmss: string) => new Date(`2026-10-30T${hhmmss}Z`).getTime();

describe('clockTime', () => {
  it('is Vietnam time, 24-hour', () => {
    expect(clockTime(EXPIRES)).toBe('14:35');
    expect(clockTime('2026-10-30T16:59:00Z')).toBe('23:59');
    expect(clockTime('2026-10-30T17:05:00Z')).toBe('00:05');
  });
});

describe('deadlineView', () => {
  it('counts down in whole minutes, rounded up', () => {
    expect(deadlineView(EXPIRES, at('07:23:00'))).toEqual({
      state: 'counting',
      time: '14:35',
      minutes: 12,
    });
    expect(deadlineView(EXPIRES, at('07:23:01'))).toMatchObject({ minutes: 12 });
    expect(deadlineView(EXPIRES, at('07:34:59'))).toMatchObject({ minutes: 1 });
  });

  it('warns under three minutes, not at three', () => {
    expect(deadlineView(EXPIRES, at('07:32:00'))).toMatchObject({ state: 'counting', minutes: 3 });
    expect(deadlineView(EXPIRES, at('07:32:01'))).toMatchObject({ state: 'warning', minutes: 3 });
    expect(deadlineView(EXPIRES, at('07:33:00'))).toMatchObject({ state: 'warning', minutes: 2 });
  });

  it('has passed at and after the deadline', () => {
    expect(deadlineView(EXPIRES, at('07:35:00'))).toEqual({ state: 'passed', time: '14:35' });
    expect(deadlineView(EXPIRES, at('08:00:00')).state).toBe('passed');
  });
});

describe('msToNextMinute', () => {
  it('is the wait until the countdown changes', () => {
    expect(msToNextMinute(EXPIRES, at('07:23:00'))).toBe(60_000);
    expect(msToNextMinute(EXPIRES, at('07:23:20'))).toBe(40_000);
    expect(msToNextMinute(EXPIRES, at('07:36:00'))).toBe(0);
  });
});
