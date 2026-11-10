import { describe, expect, it } from 'vitest';
import { capLineFor, choiceAfterBalanceChange, pointsToRedeemFor } from './points';

const quote = (o: Partial<Record<string, unknown>> = {}) =>
  ({
    pointsBalance: 60,
    pointsRedeemable: 60,
    pointsRedeemed: 60,
    pointsCapReason: 'BALANCE',
    ...o,
  }) as Parameters<typeof capLineFor>[0];

describe('pointsToRedeemFor', () => {
  it('sends nothing when off, the balance for all, the number for some', () => {
    expect(pointsToRedeemFor({ mode: 'off' }, 60)).toBeUndefined();
    expect(pointsToRedeemFor({ mode: 'all' }, 60)).toBe(60);
    expect(pointsToRedeemFor({ mode: 'some', n: 20 }, 60)).toBe(20);
  });
  it('sends nothing for zero (the API refuses 0)', () => {
    expect(pointsToRedeemFor({ mode: 'all' }, 0)).toBeUndefined();
    expect(pointsToRedeemFor({ mode: 'some', n: 0 }, 60)).toBeUndefined();
  });
});

describe('capLineFor', () => {
  it('shows the reason when the cap bites', () => {
    expect(capLineFor(quote(), { mode: 'all' })).toBe('BALANCE');
    expect(
      capLineFor(
        quote({
          pointsBalance: 300,
          pointsRedeemable: 51,
          pointsRedeemed: 51,
          pointsCapReason: 'PERCENT',
        }),
        { mode: 'all' },
      ),
    ).toBe('PERCENT');
    expect(
      capLineFor(
        quote({
          pointsBalance: 300,
          pointsRedeemable: 16,
          pointsRedeemed: 16,
          pointsCapReason: 'FLOOR',
        }),
        { mode: 'some', n: 99 },
      ),
    ).toBe('FLOOR');
  });
  it('hides it when fewer were asked, or when off', () => {
    expect(capLineFor(quote({ pointsRedeemed: 20 }), { mode: 'some', n: 20 })).toBeNull();
    expect(capLineFor(quote({ pointsRedeemed: 0 }), { mode: 'off' })).toBeNull();
  });
});

describe('choiceAfterBalanceChange', () => {
  it('resets to all against what is left, or off at zero', () => {
    expect(choiceAfterBalanceChange(30)).toEqual({ mode: 'all' });
    expect(choiceAfterBalanceChange(0)).toEqual({ mode: 'off' });
  });
});
