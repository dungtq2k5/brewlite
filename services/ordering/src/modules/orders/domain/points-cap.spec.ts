import { describe, expect, it } from 'vitest';
import { PointsCapReason } from '@brewlite/contracts';
import { pointsApplied, pointsCap } from './points-cap.js';

describe('pointsCap (ADR 0035)', () => {
  it('₫236,000 with 60 points — the balance is the limit', () => {
    expect(pointsCap({ balance: 60, subtotalVnd: 236_000, promoDiscountVnd: 0 })).toEqual({
      cap: 60,
      reason: PointsCapReason.BALANCE,
    });
  });

  it('₫102,000 with 300 points — half the subtotal is the limit', () => {
    expect(pointsCap({ balance: 300, subtotalVnd: 102_000, promoDiscountVnd: 0 })).toEqual({
      cap: 51,
      reason: PointsCapReason.PERCENT,
    });
  });

  it('₫35,000 with WELCOME10 (₫3,500) and 300 points — the ₫15,000 floor is the limit', () => {
    expect(pointsCap({ balance: 300, subtotalVnd: 35_000, promoDiscountVnd: 3_500 })).toEqual({
      cap: 16,
      reason: PointsCapReason.FLOOR,
    });
  });

  it('no account (balance 0) caps at 0, by balance', () => {
    expect(pointsCap({ balance: 0, subtotalVnd: 236_000, promoDiscountVnd: 0 })).toEqual({
      cap: 0,
      reason: PointsCapReason.BALANCE,
    });
  });

  it('a ₫15,000 subtotal leaves nothing above the floor', () => {
    expect(pointsCap({ balance: 50, subtotalVnd: 15_000, promoDiscountVnd: 0 })).toEqual({
      cap: 0,
      reason: PointsCapReason.FLOOR,
    });
  });

  it('a tie goes to the first reason in BALANCE → PERCENT → FLOOR order', () => {
    // 51 by balance and 51 by percent (₫102,000) — BALANCE wins.
    expect(pointsCap({ balance: 51, subtotalVnd: 102_000, promoDiscountVnd: 0 }).reason).toBe(
      PointsCapReason.BALANCE,
    );
    // ₫30,000: 15 by percent, 15 by floor — PERCENT wins.
    expect(pointsCap({ balance: 99, subtotalVnd: 30_000, promoDiscountVnd: 0 })).toEqual({
      cap: 15,
      reason: PointsCapReason.PERCENT,
    });
  });

  it('applies the request clipped to the cap; absent is none', () => {
    expect(pointsApplied(undefined, 60)).toBe(0);
    expect(pointsApplied(10, 60)).toBe(10);
    expect(pointsApplied(300, 51)).toBe(51);
  });
});
