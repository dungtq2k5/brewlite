import { describe, expect, it } from 'vitest';
import { isLongWait, msToNextWaitMinute, waitLabel, waitMinutes } from './wait';

const PAID = '2026-10-31T05:00:00Z';
const at = (seconds: number) => new Date(PAID).getTime() + seconds * 1000;

describe('waitMinutes', () => {
  it('counts whole minutes, rounding down', () => {
    expect(waitMinutes(PAID, at(0))).toBe(0);
    expect(waitMinutes(PAID, at(59))).toBe(0);
    expect(waitMinutes(PAID, at(60))).toBe(1);
    expect(waitMinutes(PAID, at(4 * 60 + 59))).toBe(4);
  });

  it('is never negative when the tablet clock is behind', () => {
    expect(waitMinutes(PAID, at(-30))).toBe(0);
  });
});

describe('isLongWait', () => {
  it('turns at ten minutes, not before', () => {
    expect(isLongWait(9)).toBe(false);
    expect(isLongWait(10)).toBe(true);
    expect(isLongWait(25)).toBe(true);
  });
});

describe('waitLabel', () => {
  it('says now under a minute and N min after', () => {
    expect(waitLabel(0)).toEqual({ key: 'now' });
    expect(waitLabel(4)).toEqual({ key: 'min', count: 4 });
  });
});

describe('msToNextWaitMinute', () => {
  it('is the time until the wait ticks over', () => {
    expect(msToNextWaitMinute(PAID, at(0))).toBe(60_000);
    expect(msToNextWaitMinute(PAID, at(20))).toBe(40_000);
    expect(msToNextWaitMinute(PAID, at(125))).toBe(55_000);
  });

  it('waits a full minute for a paidAt in the future', () => {
    expect(msToNextWaitMinute(PAID, at(-5))).toBe(60_000);
  });
});
